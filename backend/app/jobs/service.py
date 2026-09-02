from datetime import datetime, timezone

from app.database import get_supabase
from app.blogs.service import slugify


def list_open(page: int, limit: int):
    db = get_supabase()
    offset = (page - 1) * limit
    now = datetime.now(timezone.utc).isoformat()
    result = (
        db.table("jobs")
        .select("*")
        .eq("status", "open")
        .or_(f"expires_at.is.null,expires_at.gt.{now}")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data


def get_by_slug(slug: str):
    db = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    result = (
        db.table("jobs")
        .select("*")
        .eq("slug", slug)
        .eq("status", "open")
        .or_(f"expires_at.is.null,expires_at.gt.{now}")
        .execute()
    )
    return result.data[0] if result.data else None


def create(data: dict):
    db = get_supabase()
    if not data.get("slug"):
        data["slug"] = slugify(data["title"])
    if data.get("expires_at"):
        data["expires_at"] = data["expires_at"].isoformat() if hasattr(data["expires_at"], "isoformat") else data["expires_at"]
    result = db.table("jobs").insert(data).execute()
    return result.data[0] if result.data else None


def update(job_id: str, data: dict):
    db = get_supabase()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    if data.get("expires_at") and hasattr(data["expires_at"], "isoformat"):
        data["expires_at"] = data["expires_at"].isoformat()
    result = db.table("jobs").update(data).eq("id", job_id).execute()
    return result.data[0] if result.data else None


def delete(job_id: str):
    db = get_supabase()
    result = db.table("jobs").delete().eq("id", job_id).execute()
    return bool(result.data)
