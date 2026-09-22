import logging

from app.database import get_supabase

logger = logging.getLogger(__name__)


def record(url: str, remote_path: str, filename: str, context: str,
           kind: str, size_bytes: int, uploaded_by: str):
    """A file that uploaded fine must not be lost because the library row
    failed to write. The upload is the core action, this is not."""
    try:
        db = get_supabase()
        result = db.table("media").insert({
            "url": url,
            "remote_path": remote_path,
            "filename": filename,
            "context": context,
            "kind": kind,
            "size_bytes": size_bytes,
            "uploaded_by": uploaded_by,
        }).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        logger.warning("Upload not added to the library (%s): %s", url, e)
        return None


def list_media(page: int, limit: int, context: str = None, kind: str = None, q: str = None):
    db = get_supabase()
    offset = (page - 1) * limit
    query = db.table("media").select("*")
    if context:
        query = query.eq("context", context)
    if kind:
        query = query.eq("kind", kind)
    if q:
        term = q.replace(",", " ").strip()
        query = query.or_(f"filename.ilike.%{term}%,alt_text.ilike.%{term}%")
    result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return result.data or []


def get(media_id: str):
    db = get_supabase()
    result = db.table("media").select("*").eq("id", media_id).execute()
    return result.data[0] if result.data else None


def update(media_id: str, patch: dict):
    db = get_supabase()
    result = db.table("media").update(patch).eq("id", media_id).execute()
    return result.data[0] if result.data else None


def remove(media_id: str):
    """Returns (removed, warnings). The file goes first: a row left behind
    is a smaller problem than a file nobody can see but that still serves."""
    from app.storage import ftp_service

    row = get(media_id)
    if not row:
        return None, ["That file is not in the library"]

    warnings = []
    path = row.get("remote_path") or ftp_service.remote_path_from_url(row.get("url") or "")
    if path:
        try:
            if not ftp_service.delete_file(path):
                warnings.append(f"The file may still be on the server at {path}")
        except Exception as e:
            logger.error("Could not delete %s: %s", path, e)
            warnings.append("The file could not be removed from the server")
    else:
        warnings.append("No stored path for this file, so only the library entry was removed")

    db = get_supabase()
    db.table("media").delete().eq("id", media_id).execute()
    return row, warnings


IMAGE_EXTENSIONS = ("jpg", "jpeg", "png", "gif", "webp", "svg")


def known_paths() -> set:
    db = get_supabase()
    rows = db.table("media").select("remote_path").execute().data or []
    return {r["remote_path"] for r in rows if r.get("remote_path")}


def import_existing(context_dirs: dict, uploaded_by: str):
    """Files uploaded before the library existed are only on the file
    server. This walks the known folders and adds whatever is missing."""
    from app.storage import ftp_service

    seen = known_paths()
    added = 0
    warnings = []

    for context, remote_dir in context_dirs.items():
        files, error = ftp_service.list_dir(remote_dir, IMAGE_EXTENSIONS)
        if error:
            warnings.append(f"{remote_dir}: {error}")
            continue
        for item in files:
            if item["remote_path"] in seen:
                continue
            ext = item["name"].rsplit(".", 1)[-1].lower() if "." in item["name"] else ""
            if ext not in IMAGE_EXTENSIONS:
                continue
            made = record(
                ftp_service.public_url(item["remote_path"]),
                item["remote_path"],
                item["name"],
                context,
                "image",
                item.get("size"),
                uploaded_by,
            )
            if made:
                added += 1
                seen.add(item["remote_path"])
            else:
                warnings.append(f"Could not add {item['name']}")

    return added, warnings
