import logging
import re
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional

from app.auth.dependencies import get_current_user, require_manager
from app.storage import ftp_service
from app.uploads import service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

MAX_IMAGE_SIZE = 3 * 1024 * 1024
MAX_DOC_SIZE = 10 * 1024 * 1024

IMAGE_CONTEXT_DIRS = {
    "blog": "public_html/img/blog",
    "product": "public_html/img/products",
    "launchpad": "public_html/img/launchpad",
    "team": "public_html/img/team",
}

IMAGE_SIGNATURES = [
    (b"\xff\xd8\xff", "jpg"),
    (b"\x89PNG\r\n\x1a\n", "png"),
    (b"GIF87a", "gif"),
    (b"GIF89a", "gif"),
]


def _detect_image_ext(content: bytes) -> str:
    for signature, ext in IMAGE_SIGNATURES:
        if content.startswith(signature):
            return ext
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "webp"
    return ""


def _safe_filename(original: str, ext: str) -> str:
    base = re.sub(r"[^a-zA-Z0-9_-]", "_", (original or "file").rsplit(".", 1)[0])[:60]
    return f"{base}-{uuid.uuid4().hex[:8]}-{int(time.time())}.{ext}"


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    context: str = Form(...),
    _user: dict = Depends(get_current_user),
):
    remote_dir = IMAGE_CONTEXT_DIRS.get(context)
    if not remote_dir:
        raise HTTPException(status_code=400, detail="Invalid upload context")

    content = await file.read()
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Image must be under 3MB")

    ext = _detect_image_ext(content)
    if not ext:
        raise HTTPException(status_code=400, detail="File is not a valid image")

    filename = _safe_filename(file.filename, ext)
    remote_path, error = ftp_service.store_file(content, remote_dir, filename)
    if not remote_path:
        logger.error("Image upload failed for context %s: %s", context, error)
        raise HTTPException(status_code=502, detail=error or "Failed to upload image")

    url = ftp_service.public_url(remote_path)
    service.record(url, remote_path, file.filename or filename, context,
                   "image", len(content), _user["email"])
    return {"success": True, "url": url}


@router.post("/document")
async def upload_document(
    file: UploadFile = File(...),
    product_id: str = Form(...),
    _user: dict = Depends(get_current_user),
):
    if not re.fullmatch(r"[a-zA-Z0-9_-]+", product_id or ""):
        raise HTTPException(status_code=400, detail="Invalid product ID")

    content = await file.read()
    if len(content) > MAX_DOC_SIZE:
        raise HTTPException(status_code=400, detail="File must be under 10MB")

    if not content[:5].startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    filename = _safe_filename(file.filename, "pdf")
    remote_dir = f"public_html/docs/products/{product_id}"
    remote_path, error = ftp_service.store_file(content, remote_dir, filename)
    if not remote_path:
        logger.error("Document upload failed for product %s: %s", product_id, error)
        raise HTTPException(status_code=502, detail=error or "Failed to upload document")

    url = ftp_service.public_url(remote_path)
    service.record(url, remote_path, file.filename or filename, "product",
                   "document", len(content), _user["email"])
    return {"success": True, "name": file.filename or filename, "url": url}


@router.get("/diagnostics")
def storage_diagnostics(_user: dict = Depends(get_current_user)):
    probe_dirs = list(IMAGE_CONTEXT_DIRS.values()) + [
        "public_html/docs/products",
        "private_uploads/resumes",
        "private_uploads/chatbot_docs",
    ]
    report = ftp_service.diagnostics(probe_dirs)
    return {"success": not report["errors"], "data": report, "warnings": report["errors"]}


@router.post("/self-test")
def storage_self_test(_user: dict = Depends(get_current_user)):
    filename = f"upload-check-{uuid.uuid4().hex[:8]}.txt"
    payload = f"upload check {int(time.time())}".encode()
    remote_dir = IMAGE_CONTEXT_DIRS["blog"]

    remote_path, error = ftp_service.store_file(payload, remote_dir, filename)
    if not remote_path:
        return {"success": False, "data": {"stage": "write"}, "warnings": [error or "Upload failed"]}

    warnings = []
    content, read_error = ftp_service.read_file(remote_path)
    if content != payload:
        warnings.append(read_error or "The file server returned different bytes than were written")
    if not ftp_service.delete_file(remote_path):
        warnings.append(f"Test file left behind at {remote_path}")

    return {
        "success": not warnings,
        "data": {"remote_path": remote_path, "url": ftp_service.public_url(remote_path)},
        "warnings": warnings,
    }


class MediaUpdate(BaseModel):
    alt_text: Optional[str] = None
    filename: Optional[str] = None


@router.get("/media")
def list_media(
    page: int = Query(1, ge=1),
    limit: int = Query(40, ge=1, le=100),
    context: Optional[str] = None,
    kind: Optional[str] = None,
    q: Optional[str] = None,
    _user: dict = Depends(get_current_user),
):
    try:
        return {"success": True, "data": service.list_media(page, limit, context, kind, q)}
    except Exception as e:
        logger.error("Media list failed: %s", e)
        return {"success": False, "data": [], "warnings": ["The library could not be loaded"]}


@router.post("/media/import")
def import_media(_user: dict = Depends(require_manager)):
    try:
        added, warnings = service.import_existing(IMAGE_CONTEXT_DIRS, _user["email"])
        return {"success": True, "data": {"added": added}, "warnings": warnings}
    except Exception as e:
        logger.error("Media import failed: %s", e)
        return {"success": False, "data": {"added": 0}, "warnings": ["The file server could not be scanned"]}


@router.put("/media/{media_id}")
def update_media(media_id: str, body: MediaUpdate, _user: dict = Depends(get_current_user)):
    patch = body.model_dump(exclude_unset=True)
    if not patch:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = service.update(media_id, patch)
    if not result:
        raise HTTPException(status_code=404, detail="That file is not in the library")
    return {"success": True, "data": result}


@router.delete("/media/{media_id}")
def delete_media(media_id: str, _user: dict = Depends(require_manager)):
    removed, warnings = service.remove(media_id)
    if not removed:
        raise HTTPException(status_code=404, detail="That file is not in the library")
    return {"success": True, "data": {"id": media_id}, "warnings": warnings}
