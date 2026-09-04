import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Header, Request, UploadFile, File, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from typing import Optional

from app.auth.dependencies import get_current_user
from app.database import get_supabase
from app.settings.service import get_setting
from app.chatbot.schemas import ChatRequest, ChatResponse, DocumentResponse, BackupStatusResponse
from app.chatbot.service import (
    get_chatbot_service,
    create_chat_session_token,
    verify_chat_session_token,
    extract_text,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])
limiter = Limiter(key_func=get_remote_address)

FILE_TYPE_MAP = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
}

MAX_FILE_SIZE = 10 * 1024 * 1024


def _get_chatbot_settings() -> dict:
    defaults = {
        "chatbot_model": "gpt-4o-mini",
        "chatbot_temperature": "0.7",
        "chatbot_system_prompt": "You are a helpful assistant for Avennex, an AI-powered product studio based in Lahore. Answer questions based on the provided context. Be concise and helpful.",
        "chatbot_max_tokens": "500",
        "chatbot_top_k": "5",
    }
    result = {}
    for key, default in defaults.items():
        setting = get_setting(key)
        result[key] = setting["value"] if setting else default
    return result


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
def chat(body: ChatRequest, request: Request, x_chat_token: Optional[str] = Header(None)):
    visible = get_setting("chatbot_visible")
    if not visible or visible.get("value") != "true":
        raise HTTPException(status_code=403, detail="Chatbot is not available")

    session_id = None
    if x_chat_token:
        session_id = verify_chat_session_token(x_chat_token)

    settings = _get_chatbot_settings()
    svc = get_chatbot_service()

    try:
        result = svc.chat(
            message=body.message,
            system_prompt=settings["chatbot_system_prompt"],
            model=settings["chatbot_model"],
            temperature=float(settings["chatbot_temperature"]),
            max_tokens=int(settings["chatbot_max_tokens"]),
            top_k=int(settings["chatbot_top_k"]),
        )
    except Exception as e:
        logger.error("Chatbot chat failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to generate response")

    new_token, new_session_id = create_chat_session_token(session_id)

    return ChatResponse(
        response=result["response"],
        session_token=new_token,
        sources=result["sources"],
    )


@router.post("/documents", status_code=status.HTTP_201_CREATED)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    _user: dict = Depends(get_current_user),
):
    file_type = FILE_TYPE_MAP.get(file.content_type)
    if not file_type:
        ext = (file.filename or "").rsplit(".", 1)[-1].lower() if file.filename else ""
        if ext in ("pdf", "docx", "txt"):
            file_type = ext
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF, DOCX, or TXT.")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File must be under 10MB")

    doc_id = uuid.uuid4().hex
    filename = file.filename or f"document.{file_type}"

    db = get_supabase()
    db.table("chatbot_documents").insert({
        "id": doc_id,
        "filename": filename,
        "file_type": file_type,
        "chunk_count": 0,
        "status": "processing",
    }).execute()

    try:
        text = extract_text(content, file_type)
        if not text.strip():
            db.table("chatbot_documents").update({"status": "failed"}).eq("id", doc_id).execute()
            raise HTTPException(status_code=400, detail="No text could be extracted from the file")

        svc = get_chatbot_service()
        chunk_count = svc.add_document(text, doc_id, filename)

        db.table("chatbot_documents").update({
            "chunk_count": chunk_count,
            "status": "ready",
        }).eq("id", doc_id).execute()

        backup_setting = get_setting("chatbot_backup_enabled")
        if backup_setting and backup_setting.get("value") == "true":
            try:
                svc.save_backup()
            except Exception as e:
                logger.warning("Auto-backup failed after document upload: %s", e)

        return {"success": True, "id": doc_id, "filename": filename, "chunk_count": chunk_count}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Document processing failed: %s", e)
        db.table("chatbot_documents").update({"status": "failed"}).eq("id", doc_id).execute()
        raise HTTPException(status_code=500, detail="Failed to process document")


@router.get("/documents")
def list_documents(_user: dict = Depends(get_current_user)):
    db = get_supabase()
    result = db.table("chatbot_documents").select("*").order("created_at", desc=True).execute()
    return result.data


@router.delete("/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(doc_id: str, _user: dict = Depends(get_current_user)):
    db = get_supabase()
    existing = db.table("chatbot_documents").select("id").eq("id", doc_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Document not found")

    svc = get_chatbot_service()
    svc.remove_document(doc_id)
    db.table("chatbot_documents").delete().eq("id", doc_id).execute()

    backup_setting = get_setting("chatbot_backup_enabled")
    if backup_setting and backup_setting.get("value") == "true":
        try:
            svc.save_backup()
        except Exception as e:
            logger.warning("Auto-backup failed after document delete: %s", e)


@router.post("/backup")
def trigger_backup(_user: dict = Depends(get_current_user)):
    svc = get_chatbot_service()
    try:
        svc.save_backup()
        return {"success": True, "message": "Backup saved"}
    except Exception as e:
        logger.error("Manual backup failed: %s", e)
        return {"success": False, "message": "Backup failed"}


@router.delete("/backup", status_code=status.HTTP_204_NO_CONTENT)
def delete_backup(_user: dict = Depends(get_current_user)):
    svc = get_chatbot_service()
    svc.delete_backup()


@router.get("/backup/status", response_model=BackupStatusResponse)
def backup_status(_user: dict = Depends(get_current_user)):
    svc = get_chatbot_service()
    return svc.get_backup_status()
