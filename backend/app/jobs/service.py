from datetime import datetime, timezone

from app.database import get_supabase
from app.blogs.service import slugify


def list_all(page: int, limit: int):
    db = get_supabase()
    offset = (page - 1) * limit
    result = (
        db.table("jobs")
        .select("*")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data


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


def get_by_id(job_id: str):
    db = get_supabase()
    result = db.table("jobs").select("*").eq("id", job_id).execute()
    return result.data[0] if result.data else None


def store_application(job_id: str, data: dict):
    db = get_supabase()
    data["job_id"] = job_id
    result = db.table("job_applications").insert(data).execute()
    return result.data[0] if result.data else None


def list_applications(job_id: str):
    db = get_supabase()
    result = (
        db.table("job_applications")
        .select("*")
        .eq("job_id", job_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


def count_applications_for_jobs(job_ids: list[str]):
    db = get_supabase()
    result = (
        db.table("job_applications")
        .select("job_id")
        .in_("job_id", job_ids)
        .execute()
    )
    counts = {}
    for row in result.data:
        jid = row["job_id"]
        counts[jid] = counts.get(jid, 0) + 1
    return counts
