import logging
import re
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form

from app.auth.dependencies import get_current_user
from app.storage import ftp_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

MAX_IMAGE_SIZE = 3 * 1024 * 1024
MAX_DOC_SIZE = 10 * 1024 * 1024

IMAGE_CONTEXT_DIRS = {
    "blog": "public_html/img/blog",
    "product": "public_html/img/products",
    "launchpad": "public_html/img/launchpad",
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

    return {"success": True, "url": ftp_service.public_url(remote_path)}


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

    return {"success": True, "name": file.filename or filename, "url": ftp_service.public_url(remote_path)}


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
