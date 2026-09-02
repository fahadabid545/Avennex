import re
from datetime import datetime, timezone

from app.database import get_supabase


def slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    return re.sub(r"-+", "-", slug).strip("-")


def list_all(page: int, limit: int):
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
    db = get_supabase()
    result = (
        db.table("blogs")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .execute()
    )
    return result.data[0] if result.data else None


def create(data: dict):
    db = get_supabase()
    if not data.get("slug"):
        data["slug"] = slugify(data["title"])
    if data.get("status") == "published" and not data.get("published_at"):
        data["published_at"] = datetime.now(timezone.utc).isoformat()
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

    result = db.table("blogs").update(data).eq("id", blog_id).execute()
    return result.data[0] if result.data else None


def delete(blog_id: str):
    db = get_supabase()
    result = db.table("blogs").delete().eq("id", blog_id).execute()
    return bool(result.data)
