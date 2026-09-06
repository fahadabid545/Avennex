import logging
from datetime import datetime, timezone, timedelta

from app.database import get_supabase
from app.blogs.service import slugify

logger = logging.getLogger(__name__)


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


def list_closed(page: int, limit: int):
    db = get_supabase()
    offset = (page - 1) * limit
    result = (
        db.table("jobs")
        .select("*")
        .eq("status", "closed")
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


def count_applications(job_id: str) -> int:
    db = get_supabase()
    result = (
        db.table("job_applications")
        .select("id")
        .eq("job_id", job_id)
        .execute()
    )
    return len(result.data) if result.data else 0


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


def delete_application(app_id: str):
    db = get_supabase()
    app = db.table("job_applications").select("*").eq("id", app_id).execute()
    if not app.data:
        return None
    app_data = app.data[0]
    db.table("job_applications").delete().eq("id", app_id).execute()

    if app_data.get("resume_url"):
        try:
            path = app_data["resume_url"].split("/resumes/", 1)[-1] if "/resumes/" in app_data["resume_url"] else None
            if path:
                db.storage.from_("resumes").remove([path])
        except Exception:
            pass

    return app_data


def repost_job(job_id: str, overrides: dict = None):
    db = get_supabase()
    job = get_by_id(job_id)
    if not job:
        return None

    new_data = {
        "title": job["title"],
        "description": job.get("description"),
        "requirements": job.get("requirements"),
        "good_to_have": job.get("good_to_have"),
        "type": job.get("type"),
        "commitment": job.get("commitment"),
        "location": job.get("location"),
        "custom_questions": job.get("custom_questions"),
        "max_applications": job.get("max_applications"),
        "status": "open",
    }

    if overrides:
        new_data.update(overrides)

    new_data["slug"] = slugify(new_data["title"]) + "-repost"

    result = db.table("jobs").insert(new_data).execute()
    return result.data[0] if result.data else None


def cleanup_old_closed_jobs():
    db = get_supabase()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    deleted_count = 0
    warnings = []

    try:
        closed_old = (
            db.table("jobs")
            .select("id")
            .eq("status", "closed")
            .lt("updated_at", cutoff)
            .execute()
        )
        expired_old = (
            db.table("jobs")
            .select("id")
            .lt("expires_at", cutoff)
            .execute()
        )

        job_ids = list({r["id"] for r in (closed_old.data or []) + (expired_old.data or [])})
        if not job_ids:
            return {"deleted": 0, "warnings": []}

        for job_id in job_ids:
            try:
                apps = (
                    db.table("job_applications")
                    .select("id, resume_url")
                    .eq("job_id", job_id)
                    .execute()
                )
                for app in (apps.data or []):
                    if app.get("resume_url") and "/resumes/" in app["resume_url"]:
                        try:
                            path = app["resume_url"].split("/resumes/", 1)[-1]
                            db.storage.from_("resumes").remove([path])
                        except Exception as e:
                            warnings.append(f"Failed to delete resume for app {app['id']}: {e}")

                db.table("job_applications").delete().eq("job_id", job_id).execute()
                db.table("jobs").delete().eq("id", job_id).execute()
                deleted_count += 1
            except Exception as e:
                warnings.append(f"Failed to delete job {job_id}: {e}")

    except Exception as e:
        logger.error("Job cleanup failed: %s", e)
        warnings.append(f"Cleanup query failed: {e}")

    return {"deleted": deleted_count, "warnings": warnings}
