import io
import json
import logging
import re
import threading
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
import numpy as np

from app.config import get_settings
from app.database import get_supabase

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
BACKUP_BUCKET = "chatbot-backup"
BACKUP_INDEX_PATH = "faiss_index.bin"
BACKUP_META_PATH = "metadata.json"


def _get_openai_client():
    import openai
    settings = get_settings()
    return openai.OpenAI(api_key=settings.openai_api_key)


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text)


def _count_tokens(text: str) -> int:
    try:
        import tiktoken
        enc = tiktoken.encoding_for_model("gpt-4o-mini")
        return len(enc.encode(text))
    except Exception:
        return len(text.split())


def _chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    try:
        import tiktoken
        enc = tiktoken.encoding_for_model("gpt-4o-mini")
        tokens = enc.encode(text)
    except Exception:
        words = text.split()
        chunks = []
        i = 0
        while i < len(words):
            chunk = " ".join(words[i:i + chunk_size])
            chunks.append(chunk)
            i += chunk_size - overlap
        return [c for c in chunks if c.strip()]

    chunks = []
    i = 0
    while i < len(tokens):
        chunk_tokens = tokens[i:i + chunk_size]
        chunk_text = enc.decode(chunk_tokens)
        chunks.append(chunk_text)
        i += chunk_size - overlap
    return [c for c in chunks if c.strip()]


def _extract_pdf(content: bytes) -> str:
    from PyPDF2 import PdfReader
    reader = PdfReader(io.BytesIO(content))
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    return text


def _extract_docx(content: bytes) -> str:
    from docx import Document
    doc = Document(io.BytesIO(content))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


def _extract_txt(content: bytes) -> str:
    return content.decode("utf-8", errors="replace")


class ChatbotService:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        import faiss
        self.index = faiss.IndexFlatIP(EMBEDDING_DIM)
        self.metadata: dict[int, dict] = {}
        self.next_id = 0
        self._initialized = True

    def _embed(self, texts: list[str]) -> np.ndarray:
        client = _get_openai_client()
        response = client.embeddings.create(model=EMBEDDING_MODEL, input=texts)
        embeddings = np.array([d.embedding for d in response.data], dtype="float32")
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        norms[norms == 0] = 1
        embeddings = embeddings / norms
        return embeddings

    def add_document(self, text: str, doc_id: str, filename: str) -> int:
        chunks = _chunk_text(text)
        if not chunks:
            return 0

        embeddings = self._embed(chunks)
        start_id = self.next_id
        self.index.add(embeddings)

        for i, chunk in enumerate(chunks):
            self.metadata[start_id + i] = {
                "doc_id": doc_id,
                "filename": filename,
                "chunk_text": chunk,
                "chunk_index": i,
            }
        self.next_id += len(chunks)
        return len(chunks)

    def remove_document(self, doc_id: str):
        import faiss
        keep_ids = []
        keep_meta = {}
        new_id = 0

        vectors_to_keep = []
        for idx in sorted(self.metadata.keys()):
            if self.metadata[idx]["doc_id"] != doc_id:
                vec = self.index.reconstruct(idx)
                vectors_to_keep.append(vec)
                keep_meta[new_id] = self.metadata[idx]
                new_id += 1

        self.index = faiss.IndexFlatIP(EMBEDDING_DIM)
        if vectors_to_keep:
            vectors = np.array(vectors_to_keep, dtype="float32")
            self.index.add(vectors)

        self.metadata = keep_meta
        self.next_id = new_id

    def search(self, query: str, top_k: int = 5) -> list[dict]:
        if self.index.ntotal == 0:
            return []

        query_vec = self._embed([query])
        k = min(top_k, self.index.ntotal)
        scores, indices = self.index.search(query_vec, k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0:
                continue
            meta = self.metadata.get(int(idx))
            if meta:
                results.append({
                    "score": float(score),
                    "chunk_text": meta["chunk_text"],
                    "filename": meta["filename"],
                    "doc_id": meta["doc_id"],
                })
        return results

    def chat(self, message: str, system_prompt: str, model: str = "gpt-4o-mini",
             temperature: float = 0.7, max_tokens: int = 500, top_k: int = 5) -> dict:
        clean_message = _strip_html(message)
        results = self.search(clean_message, top_k=top_k)

        context = ""
        if results:
            context = "\n\n---\n\n".join(
                f"[Source: {r['filename']}]\n{r['chunk_text']}" for r in results
            )

        messages = [
            {"role": "system", "content": system_prompt},
        ]
        if context:
            messages.append({
                "role": "system",
                "content": f"Use the following context to answer the user's question. If the context doesn't contain relevant information, say so.\n\n{context}",
            })
        messages.append({"role": "user", "content": clean_message})

        client = _get_openai_client()
        completion = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        sources = []
        seen = set()
        for r in results:
            if r["filename"] not in seen:
                sources.append({
                    "document": r["filename"],
                    "chunk_preview": r["chunk_text"][:100] + "..." if len(r["chunk_text"]) > 100 else r["chunk_text"],
                })
                seen.add(r["filename"])

        return {
            "response": completion.choices[0].message.content,
            "sources": sources,
        }

    def save_backup(self):
        import faiss
        db = get_supabase()

        index_bytes = faiss.serialize_index(self.index)
        meta_bytes = json.dumps(
            {str(k): v for k, v in self.metadata.items()}
        ).encode("utf-8")

        try:
            db.storage.from_(BACKUP_BUCKET).remove([BACKUP_INDEX_PATH])
        except Exception:
            pass
        try:
            db.storage.from_(BACKUP_BUCKET).remove([BACKUP_META_PATH])
        except Exception:
            pass

        db.storage.from_(BACKUP_BUCKET).upload(
            BACKUP_INDEX_PATH, index_bytes.tobytes(),
            {"content-type": "application/octet-stream"}
        )
        db.storage.from_(BACKUP_BUCKET).upload(
            BACKUP_META_PATH, meta_bytes,
            {"content-type": "application/json"}
        )
        logger.info("Chatbot backup saved: %d vectors", self.index.ntotal)

    def load_backup(self) -> bool:
        import faiss
        db = get_supabase()

        try:
            index_data = db.storage.from_(BACKUP_BUCKET).download(BACKUP_INDEX_PATH)
            meta_data = db.storage.from_(BACKUP_BUCKET).download(BACKUP_META_PATH)
        except Exception:
            return False

        self.index = faiss.deserialize_index(np.frombuffer(index_data, dtype="uint8"))
        raw_meta = json.loads(meta_data.decode("utf-8"))
        self.metadata = {int(k): v for k, v in raw_meta.items()}
        self.next_id = max(self.metadata.keys()) + 1 if self.metadata else 0
        logger.info("Chatbot index loaded with %d vectors", self.index.ntotal)
        return True

    def delete_backup(self):
        db = get_supabase()
        try:
            db.storage.from_(BACKUP_BUCKET).remove([BACKUP_INDEX_PATH, BACKUP_META_PATH])
        except Exception:
            pass

    def get_backup_status(self) -> dict:
        db = get_supabase()
        try:
            files = db.storage.from_(BACKUP_BUCKET).list()
            index_file = next((f for f in files if f["name"] == BACKUP_INDEX_PATH), None)
            if not index_file:
                return {"exists": False}
            return {
                "exists": True,
                "size": index_file.get("metadata", {}).get("size"),
                "last_updated": index_file.get("updated_at") or index_file.get("created_at"),
            }
        except Exception:
            return {"exists": False}


def create_chat_session_token(session_id: Optional[str] = None) -> tuple[str, str]:
    import uuid
    settings = get_settings()
    sid = session_id or uuid.uuid4().hex
    payload = {
        "sub": sid,
        "type": "chat_session",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
        "iat": datetime.now(timezone.utc),
    }
    token = jwt.encode(payload, settings.chatbot_jwt_secret, algorithm="HS256")
    return token, sid


def verify_chat_session_token(token: str) -> Optional[str]:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.chatbot_jwt_secret, algorithms=["HS256"])
        if payload.get("type") != "chat_session":
            return None
        return payload.get("sub")
    except jwt.InvalidTokenError:
        return None


def extract_text(content: bytes, file_type: str) -> str:
    if file_type == "pdf":
        return _extract_pdf(content)
    elif file_type == "docx":
        return _extract_docx(content)
    elif file_type == "txt":
        return _extract_txt(content)
    raise ValueError(f"Unsupported file type: {file_type}")


def get_chatbot_service() -> ChatbotService:
    return ChatbotService()
