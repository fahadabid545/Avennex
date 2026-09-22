import logging
import re
import threading
from datetime import datetime, timedelta, timezone

from app.database import get_supabase

logger = logging.getLogger(__name__)

# nothing runs on a timer here, so a scheduled post goes live the first
# time anyone reads the blog after its moment. the check is throttled so
# a busy minute does not turn into a query per visitor.
SWEEP_EVERY_SECONDS = 60
_last_sweep = None
_sweep_lock = threading.Lock()


def release_due(force: bool = False) -> int:
    global _last_sweep
    now = datetime.now(timezone.utc)
    with _sweep_lock:
        if not force and _last_sweep and (now - _last_sweep) < timedelta(seconds=SWEEP_EVERY_SECONDS):
            return 0
        _last_sweep = now

    db = get_supabase()
    due = (
        db.table("blogs")
        .select("id, publish_at")
        .eq("status", "scheduled")
        .lte("publish_at", now.isoformat())
        .execute()
    ).data or []

    released = 0
    for row in due:
        try:
            db.table("blogs").update({
                "status": "published",
                "published_at": row.get("publish_at") or now.isoformat(),
                "updated_at": now.isoformat(),
            }).eq("id", row["id"]).execute()
            released += 1
        except Exception as e:
            logger.error("Scheduled post %s did not go live: %s", row.get("id"), e)
    return released


def _sweep():
    """A reader must still get their page if the sweep fails."""
    try:
        release_due()
    except Exception as e:
        logger.warning("Scheduled publishing sweep failed: %s", e)


def slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    return re.sub(r"-+", "-", slug).strip("-")


def list_all(page: int, limit: int):
    _sweep()
    db = get_supabase()
    offset = (page - 1) * limit
    result = (
        db.table("blogs")
        .select("*")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data


def list_published(page: int, limit: int):
    _sweep()
    db = get_supabase()
    offset = (page - 1) * limit
    result = (
        db.table("blogs")
        .select("*")
        .eq("status", "published")
        .order("published_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data


def get_by_slug(slug: str):
    _sweep()
    db = get_supabase()
    result = (
        db.table("blogs")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .execute()
    )
    return result.data[0] if result.data else None


def get_by_id(blog_id: str):
    db = get_supabase()
    result = db.table("blogs").select("*").eq("id", blog_id).execute()
    return result.data[0] if result.data else None


def create(data: dict):
    db = get_supabase()
    if not data.get("slug"):
        data["slug"] = slugify(data["title"])
    if data.get("status") == "published" and not data.get("published_at"):
        data["published_at"] = datetime.now(timezone.utc).isoformat()
    if data.get("status") != "scheduled":
        data["publish_at"] = None
    result = db.table("blogs").insert(data).execute()
    return result.data[0] if result.data else None


def update(blog_id: str, data: dict):
    db = get_supabase()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()

    existing = db.table("blogs").select("status").eq("id", blog_id).execute()
    if not existing.data:
        return None

    if data.get("status") == "published" and existing.data[0]["status"] != "published":
        data["published_at"] = datetime.now(timezone.utc).isoformat()

    # a post moved off the schedule keeps no date that would put it back
    if "status" in data and data["status"] != "scheduled":
        data["publish_at"] = None

    result = db.table("blogs").update(data).eq("id", blog_id).execute()
    return result.data[0] if result.data else None


def delete(blog_id: str):
    db = get_supabase()
    result = db.table("blogs").delete().eq("id", blog_id).execute()
    return bool(result.data)
