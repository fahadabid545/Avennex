"""Documents attached to a product or a launchpad idea.

The admin's browser turns Word, Excel, CSV and text files into a PDF before
upload, because the server has no office suite to do it. Both files are kept:
the original is what visitors download, the PDF is what the page previews.
"""
import logging
import re
import time
import uuid

from fastapi import HTTPException

from app.storage import ftp_service
from app.uploads import service

logger = logging.getLogger(__name__)

MAX_DOCUMENTS = 5
MAX_DOC_SIZE = 10 * 1024 * 1024
MAX_PREVIEW_SIZE = 20 * 1024 * 1024

ZIP = b"PK\x03\x04"
OLE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"

# extension -> the bytes a genuine file of that kind starts with
SIGNATURES = {
    "pdf": (b"%PDF-",),
    "docx": (ZIP,),
    "xlsx": (ZIP,),
    "pptx": (ZIP,),
    "doc": (OLE,),
    "xls": (OLE,),
    "ppt": (OLE,),
}
TEXT_TYPES = {"txt", "csv"}
ALLOWED = set(SIGNATURES) | TEXT_TYPES

OWNER_DIRS = {
    "product": "public_html/docs/products",
    "launchpad": "public_html/docs/launchpad",
}


def _extension(filename: str) -> str:
    return (filename or "").rsplit(".", 1)[-1].lower() if "." in (filename or "") else ""


def _looks_like_text(content: bytes) -> bool:
    if b"\x00" in content[:4096]:
        return False
    try:
        content[:65536].decode("utf-8")
        return True
    except UnicodeDecodeError:
        return False


def check_original(filename: str, content: bytes) -> str:
    """Returns the file's type, or raises a 400 the admin can act on."""
    ext = _extension(filename)
    if ext not in ALLOWED:
        raise HTTPException(
            status_code=400,
            detail="Only PDF, Word, Excel, PowerPoint, text and CSV files are accepted",
        )
    if len(content) > MAX_DOC_SIZE:
        raise HTTPException(status_code=400, detail="File must be under 10MB")
    if ext in TEXT_TYPES:
        if not _looks_like_text(content):
            raise HTTPException(status_code=400, detail=f"This does not look like a .{ext} file")
    elif not any(content.startswith(sig) for sig in SIGNATURES[ext]):
        raise HTTPException(status_code=400, detail=f"This does not look like a .{ext} file")
    return ext


def _safe_name(original: str, ext: str) -> str:
    base = re.sub(r"[^a-zA-Z0-9_-]", "_", (original or "document").rsplit(".", 1)[0])[:60]
    return f"{base}-{uuid.uuid4().hex[:8]}-{int(time.time())}.{ext}"


def store(owner: str, owner_id: str, filename: str, content: bytes,
          preview: bytes | None, uploaded_by: str) -> dict:
    """Stores the original, then its preview. The original is the core
    action. A preview that fails leaves a document that can still be
    downloaded, and the response says so."""
    if not re.fullmatch(r"[a-zA-Z0-9_-]+", owner_id or ""):
        raise HTTPException(status_code=400, detail="Invalid ID")

    ext = check_original(filename, content)
    remote_dir = f"{OWNER_DIRS[owner]}/{owner_id}"
    stored_name = _safe_name(filename, ext)

    remote_path, error = ftp_service.store_file(content, remote_dir, stored_name)
    if not remote_path:
        logger.error("Document upload failed for %s %s: %s", owner, owner_id, error)
        raise HTTPException(status_code=502, detail=error or "Failed to upload document")

    url = ftp_service.public_url(remote_path)
    service.record(url, remote_path, filename or stored_name, owner, "document", len(content), uploaded_by)

    warnings = []
    preview_url = url if ext == "pdf" else None
    if ext != "pdf" and preview:
        if len(preview) > MAX_PREVIEW_SIZE or not preview.startswith(b"%PDF-"):
            warnings.append("The preview was not a usable PDF, so visitors will only see a download link.")
        else:
            preview_path, preview_error = ftp_service.store_file(
                preview, remote_dir, stored_name.rsplit(".", 1)[0] + ".preview.pdf"
            )
            if preview_path:
                preview_url = ftp_service.public_url(preview_path)
            else:
                logger.warning("Preview upload failed for %s %s: %s", owner, owner_id, preview_error)
                warnings.append("The document uploaded but its preview did not, so visitors will only see a download link.")

    doc = {
        "name": filename or stored_name,
        "url": url,
        "preview_url": preview_url,
        "type": ext,
        "size": len(content),
    }
    response = {"success": True, "data": doc, **doc}
    if warnings:
        response["warnings"] = warnings
    return response


def file_urls(documents) -> list:
    """Every stored file behind a documents list, previews included."""
    urls = []
    for doc in documents or []:
        if not isinstance(doc, dict):
            continue
        for key in ("url", "preview_url"):
            if doc.get(key) and doc[key] not in urls:
                urls.append(doc[key])
    return urls


def validate_list(value):
    if value is None:
        return value
    if not isinstance(value, list):
        raise ValueError("documents must be a list")
    if len(value) > MAX_DOCUMENTS:
        raise ValueError(f"At most {MAX_DOCUMENTS} documents can be attached")
    return value
