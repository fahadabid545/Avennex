from datetime import datetime, timezone

from app.database import get_supabase
from app.blogs.service import slugify


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
    result = db.table("launchpad_entries").insert(data).execute()
    return result.data[0] if result.data else None


def update(entry_id: str, data: dict):
    db = get_supabase()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = db.table("launchpad_entries").update(data).eq("id", entry_id).execute()
    return result.data[0] if result.data else None


def delete(entry_id: str):
    db = get_supabase()
    result = db.table("launchpad_entries").delete().eq("id", entry_id).execute()
    return bool(result.data)


def add_comment(entry_id: str, data: dict):
    db = get_supabase()
    data["entry_id"] = entry_id
    result = db.table("launchpad_comments").insert(data).execute()
    return result.data[0] if result.data else None


def delete_comment(comment_id: str):
    db = get_supabase()
    result = db.table("launchpad_comments").delete().eq("id", comment_id).execute()
    return bool(result.data)


def list_comments(entry_id: str):
    db = get_supabase()
    result = (
        db.table("launchpad_comments")
        .select("id, entry_id, author_name, content, created_at")
        .eq("entry_id", entry_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


def count_comments_for_entries(entry_ids: list[str]):
    db = get_supabase()
    result = (
        db.table("launchpad_comments")
        .select("entry_id")
        .in_("entry_id", entry_ids)
        .execute()
    )
    counts = {}
    for row in result.data:
        eid = row["entry_id"]
        counts[eid] = counts.get(eid, 0) + 1
    return counts
