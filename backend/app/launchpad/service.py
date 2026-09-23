import logging
from datetime import datetime, timezone

from app.database import get_supabase
from app.blogs.service import slugify
from app.progress_history import stamp as stamp_progress
from app.storage import ftp_service

logger = logging.getLogger(__name__)


def list_all(page: int, limit: int):
    db = get_supabase()
    offset = (page - 1) * limit
    result = (
        db.table("launchpad_entries")
        .select("*")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data


def list_active(page: int, limit: int):
    db = get_supabase()
    offset = (page - 1) * limit
    result = (
        db.table("launchpad_entries")
        .select("*")
        .eq("status", "active")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data


def get_by_slug(slug: str):
    db = get_supabase()
    result = db.table("launchpad_entries").select("*").eq("slug", slug).execute()
    if not result.data:
        return None

    entry = result.data[0]
    comments = (
        db.table("launchpad_comments")
        .select("id, entry_id, author_name, content, created_at")
        .eq("entry_id", entry["id"])
        .order("created_at", desc=True)
        .execute()
    )
    entry["comments"] = comments.data
    return entry


def get_by_id(entry_id: str):
    db = get_supabase()
    result = db.table("launchpad_entries").select("*").eq("id", entry_id).execute()
    return result.data[0] if result.data else None


def create(data: dict):
    db = get_supabase()
    if not data.get("slug"):
        data["slug"] = slugify(data["title"])
    stamp_progress(data)
    result = db.table("launchpad_entries").insert(data).execute()
    return result.data[0] if result.data else None


def update(entry_id: str, data: dict):
    db = get_supabase()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        stamp_progress(data, get_by_id(entry_id))
    except Exception as e:
        logger.warning("Progress history lookup failed for entry %s: %s", entry_id, e)
    result = db.table("launchpad_entries").update(data).eq("id", entry_id).execute()
    return result.data[0] if result.data else None


def delete(entry_id: str):
    db = get_supabase()
    entry = get_by_id(entry_id)
    result = db.table("launchpad_entries").delete().eq("id", entry_id).execute()

    if entry and entry.get("diagrams"):
        for url in entry["diagrams"].split("\n"):
            url = url.strip()
            remote_path = ftp_service.remote_path_from_url(url) if url else None
            if remote_path and not ftp_service.delete_file(remote_path):
                logger.warning("Failed to delete diagram %s for launchpad entry %s", url, entry_id)

    return bool(result.data)


def add_comment(entry_id: str, data: dict):
    """Returns None if the comment could not be stored. The real error stays
    in the log. Nothing about the database reaches the visitor."""
    db = get_supabase()
    data["entry_id"] = entry_id
    try:
        result = db.table("launchpad_comments").insert(data).execute()
    except Exception as e:
        logger.error("Failed to store comment on entry %s: %s", entry_id, e)
        return None
    return result.data[0] if result.data else None


def delete_comment(comment_id: str):
    db = get_supabase()
    result = db.table("launchpad_comments").delete().eq("id", comment_id).execute()
    return bool(result.data)


def list_comments(entry_id: str):
    db = get_supabase()
    result = (
        db.table("launchpad_comments")
        .select("id, entry_id, author_name, author_email, content, created_at")
        .eq("entry_id", entry_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


def count_comments_for(entry_ids: list = None) -> dict:
    """The counts for a whole page in one query, rather than one request
    per entry that fetches every comment to measure its length."""
    db = get_supabase()
    query = db.table("launchpad_comments").select("entry_id")
    if entry_ids is not None:
        if not entry_ids:
            return {}
        query = query.in_("entry_id", entry_ids)

    counts = {}
    for row in (query.execute().data or []):
        key = row.get("entry_id")
        if key:
            counts[key] = counts.get(key, 0) + 1
    if entry_ids is not None:
        for key in entry_ids:
            counts.setdefault(key, 0)
    return counts


def list_comments_for(entry_ids: list = None, limit: int = 200):
    """Comments across several entries at once, newest first, for the
    moderation inbox."""
    db = get_supabase()
    query = db.table("launchpad_comments").select(
        "id, entry_id, author_name, author_email, content, created_at"
    )
    if entry_ids is not None:
        if not entry_ids:
            return []
        query = query.in_("entry_id", entry_ids)
    result = query.order("created_at", desc=True).limit(limit).execute()
    return result.data or []
