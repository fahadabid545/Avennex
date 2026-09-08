import io
import logging
from ftplib import FTP
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)

PUBLIC_BASE_URL = "https://avennex.com"


def _connect() -> FTP:
    settings = get_settings()
    ftp = FTP()
    ftp.connect(settings.ftp_host, settings.ftp_port, timeout=30)
    ftp.login(settings.ftp_user, settings.ftp_password)
    return ftp


def _ensure_dir(ftp: FTP, remote_dir: str):
    parts = [p for p in remote_dir.strip("/").split("/") if p]
    path = ""
    for part in parts:
        path += "/" + part
        try:
            ftp.mkd(path)
        except Exception:
            pass
    ftp.cwd("/" + "/".join(parts))


def upload_file(file_bytes: bytes, remote_dir: str, filename: str) -> Optional[str]:
    try:
        ftp = _connect()
        try:
            _ensure_dir(ftp, remote_dir)
            ftp.storbinary(f"STOR {filename}", io.BytesIO(file_bytes))
        finally:
            ftp.quit()
        return f"{remote_dir.strip('/')}/{filename}"
    except Exception as e:
        logger.error("FTP upload failed for %s/%s: %s", remote_dir, filename, e)
        return None


def download_file(remote_path: str) -> Optional[bytes]:
    try:
        ftp = _connect()
        try:
            buf = io.BytesIO()
            ftp.retrbinary(f"RETR /{remote_path.strip('/')}", buf.write)
        finally:
            ftp.quit()
        return buf.getvalue()
    except Exception as e:
        logger.error("FTP download failed for %s: %s", remote_path, e)
        return None


def delete_file(remote_path: str) -> bool:
    try:
        ftp = _connect()
        try:
            ftp.delete(f"/{remote_path.strip('/')}")
        finally:
            ftp.quit()
        return True
    except Exception as e:
        logger.error("FTP delete failed for %s: %s", remote_path, e)
        return False


def public_url(remote_path: str) -> str:
    path = remote_path.strip("/")
    if path.startswith("public_html/"):
        path = path[len("public_html/"):]
    return f"{PUBLIC_BASE_URL}/{path}"
