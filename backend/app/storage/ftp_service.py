import io
import logging
import threading
from ftplib import FTP, error_perm
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)

PUBLIC_BASE_URL = "https://avennex.com"
WEB_ROOT_NAME = "public_html"


class FTPStorageError(Exception):
    pass


class _Layout:
    def __init__(self, login_dir: str, web_root: str, private_root: str):
        self.login_dir = login_dir
        self.web_root = web_root
        self.private_root = private_root

    def as_dict(self) -> dict:
        return {
            "login_dir": self.login_dir,
            "web_root": self.web_root,
            "private_root": self.private_root,
        }


_layout: Optional[_Layout] = None
_layout_lock = threading.Lock()


def reset_layout():
    global _layout
    with _layout_lock:
        _layout = None


def _connect() -> FTP:
    settings = get_settings()
    if not settings.ftp_host or not settings.ftp_user:
        raise FTPStorageError("FTP is not configured on this server")
    ftp = FTP()
    try:
        ftp.connect(settings.ftp_host, settings.ftp_port, timeout=30)
        ftp.login(settings.ftp_user, settings.ftp_password)
    except Exception as e:
        raise FTPStorageError(f"Could not sign in to the file server: {e}") from e
    return ftp


def _join(base: str, name: str) -> str:
    return (base.rstrip("/") + "/" + name) if base != "/" else "/" + name


def _parent(path: str) -> str:
    trimmed = path.rstrip("/")
    if "/" not in trimmed.lstrip("/"):
        return "/"
    return trimmed.rsplit("/", 1)[0] or "/"


def _exists(ftp: FTP, path: str) -> bool:
    here = ftp.pwd()
    try:
        ftp.cwd(path)
        return True
    except Exception:
        return False
    finally:
        try:
            ftp.cwd(here)
        except Exception:
            pass


def _has_web_markers(ftp: FTP, path: str) -> bool:
    try:
        names = {n.rsplit("/", 1)[-1] for n in ftp.nlst(path)}
    except Exception:
        return False
    return bool(names & {"index.html", "index.php", "cgi-bin", ".htaccess"})


def _detect_layout(ftp: FTP) -> _Layout:
    settings = get_settings()
    login_dir = ftp.pwd()

    if settings.ftp_base_dir:
        base = settings.ftp_base_dir.rstrip("/") or "/"
        if not _exists(ftp, base):
            raise FTPStorageError(
                f"FTP_BASE_DIR points at {base} but that directory does not exist on the file server"
            )
    else:
        base = login_dir.rstrip("/") or "/"

    if settings.ftp_web_root:
        web_root = settings.ftp_web_root.rstrip("/") or "/"
        if not _exists(ftp, web_root):
            raise FTPStorageError(
                f"FTP_WEB_ROOT points at {web_root} but that directory does not exist on the file server"
            )
    elif _exists(ftp, _join(base, WEB_ROOT_NAME)):
        web_root = _join(base, WEB_ROOT_NAME)
    elif base.rsplit("/", 1)[-1] == WEB_ROOT_NAME or _has_web_markers(ftp, base):
        web_root = base
    else:
        raise FTPStorageError(
            f"No {WEB_ROOT_NAME} directory under the FTP login directory {base}. "
            "Set FTP_BASE_DIR to the directory that holds it, or FTP_WEB_ROOT to the web root itself."
        )

    if web_root == base:
        parent = _parent(web_root)
        private_root = parent if parent != web_root and _exists(ftp, parent) else web_root
    else:
        private_root = base

    if private_root == web_root:
        logger.warning(
            "The FTP account cannot reach above %s, so private uploads land inside the web root", web_root
        )

    layout = _Layout(login_dir, web_root, private_root)
    logger.info("FTP layout resolved: %s", layout.as_dict())
    return layout


def _get_layout(ftp: FTP) -> _Layout:
    global _layout
    with _layout_lock:
        if _layout is None:
            _layout = _detect_layout(ftp)
        return _layout


def _resolve(ftp: FTP, remote_dir: str) -> str:
    layout = _get_layout(ftp)
    parts = [p for p in remote_dir.strip("/").split("/") if p]
    if parts and parts[0] == WEB_ROOT_NAME:
        root, parts = layout.web_root, parts[1:]
    else:
        root = layout.private_root
    path = root.rstrip("/") or "/"
    for part in parts:
        path = _join(path, part)
    return path


def _ensure_dir(ftp: FTP, absolute_dir: str):
    if _exists(ftp, absolute_dir):
        ftp.cwd(absolute_dir)
        return

    parts = [p for p in absolute_dir.strip("/").split("/") if p]
    path = "/"
    ftp.cwd("/")
    for part in parts:
        path = _join(path, part)
        try:
            ftp.cwd(part)
            continue
        except error_perm:
            pass
        try:
            ftp.mkd(part)
        except Exception as e:
            raise FTPStorageError(f"Could not create {path} on the file server: {e}") from e
        try:
            ftp.cwd(part)
        except Exception as e:
            raise FTPStorageError(f"Created {path} but could not open it: {e}") from e


def _verify_written(ftp: FTP, filename: str, expected: int, absolute_dir: str):
    size = None
    try:
        size = ftp.size(filename)
    except Exception as e:
        logger.warning("SIZE not available for %s/%s: %s", absolute_dir, filename, e)

    if size is None:
        try:
            names = [n.rsplit("/", 1)[-1] for n in ftp.nlst()]
        except Exception as e:
            raise FTPStorageError(
                f"Wrote {filename} but the file server would not confirm it exists: {e}"
            ) from e
        if filename not in names:
            raise FTPStorageError(
                f"The file server accepted {filename} but nothing was stored in {absolute_dir}"
            )
        return

    if size != expected:
        raise FTPStorageError(
            f"{absolute_dir}/{filename} stored {size} bytes but {expected} were sent"
        )


def upload_file(file_bytes: bytes, remote_dir: str, filename: str) -> Optional[str]:
    path, error = store_file(file_bytes, remote_dir, filename)
    if error:
        logger.error("FTP upload failed for %s/%s: %s", remote_dir, filename, error)
    return path


def store_file(file_bytes: bytes, remote_dir: str, filename: str) -> tuple[Optional[str], Optional[str]]:
    parts = [p for p in remote_dir.strip("/").split("/") if p]
    if any(p in (".", "..") for p in parts) or "/" in filename or filename in (".", ".."):
        return None, f"Rejected unsafe upload path {remote_dir}/{filename}"

    try:
        ftp = _connect()
    except FTPStorageError as e:
        return None, str(e)

    try:
        absolute_dir = _resolve(ftp, remote_dir)
        _ensure_dir(ftp, absolute_dir)
        ftp.storbinary(f"STOR {filename}", io.BytesIO(file_bytes))
        _verify_written(ftp, filename, len(file_bytes), absolute_dir)
        logger.info("Stored %s/%s (%d bytes)", absolute_dir, filename, len(file_bytes))
        return f"{'/'.join(parts)}/{filename}", None
    except FTPStorageError as e:
        return None, str(e)
    except Exception as e:
        return None, f"Upload to {remote_dir} failed: {e}"
    finally:
        _quit(ftp)


def _quit(ftp: FTP):
    try:
        ftp.quit()
    except Exception:
        try:
            ftp.close()
        except Exception:
            pass


def download_file(remote_path: str) -> Optional[bytes]:
    content, error = read_file(remote_path)
    if error:
        logger.error("FTP download failed for %s: %s", remote_path, error)
    return content


def read_file(remote_path: str) -> tuple[Optional[bytes], Optional[str]]:
    try:
        ftp = _connect()
    except FTPStorageError as e:
        return None, str(e)

    try:
        absolute = _resolve(ftp, remote_path)
        buf = io.BytesIO()
        ftp.retrbinary(f"RETR {absolute}", buf.write)
        return buf.getvalue(), None
    except FTPStorageError as e:
        return None, str(e)
    except Exception as e:
        return None, f"Could not read {remote_path} from the file server: {e}"
    finally:
        _quit(ftp)


def delete_file(remote_path: str) -> bool:
    try:
        ftp = _connect()
    except FTPStorageError as e:
        logger.error("FTP delete failed for %s: %s", remote_path, e)
        return False

    try:
        ftp.delete(_resolve(ftp, remote_path))
        return True
    except Exception as e:
        logger.error("FTP delete failed for %s: %s", remote_path, e)
        return False
    finally:
        _quit(ftp)


def public_url(remote_path: str) -> str:
    path = remote_path.strip("/")
    if path.startswith(f"{WEB_ROOT_NAME}/"):
        path = path[len(WEB_ROOT_NAME) + 1:]
    return f"{PUBLIC_BASE_URL}/{path}"


def remote_path_from_url(url: str) -> Optional[str]:
    if not url or not url.startswith(f"{PUBLIC_BASE_URL}/"):
        return None
    return f"{WEB_ROOT_NAME}/{url[len(PUBLIC_BASE_URL) + 1:]}"


def diagnostics(probe_dirs: list[str]) -> dict:
    report = {"connected": False, "layout": None, "directories": [], "round_trip": None, "errors": []}

    try:
        ftp = _connect()
    except FTPStorageError as e:
        report["errors"].append(str(e))
        return report

    report["connected"] = True
    try:
        layout = _get_layout(ftp)
        report["layout"] = layout.as_dict()
        try:
            report["login_dir_entries"] = sorted(ftp.nlst(layout.login_dir))[:40]
        except Exception as e:
            report["errors"].append(f"Could not list {layout.login_dir}: {e}")

        for remote_dir in probe_dirs:
            absolute = _resolve(ftp, remote_dir)
            report["directories"].append({
                "path": remote_dir,
                "resolved": absolute,
                "exists": _exists(ftp, absolute),
                "public_url": public_url(f"{remote_dir.strip('/')}/") if remote_dir.strip("/").startswith(WEB_ROOT_NAME) else None,
            })
    except FTPStorageError as e:
        report["errors"].append(str(e))
    except Exception as e:
        report["errors"].append(str(e))
    finally:
        _quit(ftp)

    return report
