import logging
from datetime import datetime, timezone, timedelta

from app.database import get_supabase
from app.slugs import free_slug, slug_taken, slugify
from app.storage import ftp_service

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
    # a role past its date is closed to applicants even while its status
    # still says open, so it belongs here where it can be republished
    db = get_supabase()
    offset = (page - 1) * limit
    now = datetime.now(timezone.utc).isoformat()
    result = (
        db.table("jobs")
        .select("*")
        .or_(f"status.eq.closed,expires_at.lt.{now}")
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
    data["slug"] = free_slug("jobs", data.get("slug") or data["title"], "job")
    if data.get("expires_at"):
        data["expires_at"] = data["expires_at"].isoformat() if hasattr(data["expires_at"], "isoformat") else data["expires_at"]
    try:
        result = db.table("jobs").insert(data).execute()
    except Exception as e:
        logger.error("Failed to create job %s: %s", data.get("slug"), e)
        raise
    return result.data[0] if result.data else None


class SlugTaken(Exception):
    pass


def update(job_id: str, data: dict):
    db = get_supabase()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    if "slug" in data:
        title = data.get("title")
        if not data["slug"] and not title:
            current = get_by_id(job_id)
            title = current["title"] if current else ""
        if not data["slug"]:
            data["slug"] = free_slug("jobs", title, "job", exclude_id=job_id)
        else:
            data["slug"] = slugify(data["slug"]) or "job"
            if slug_taken("jobs", data["slug"], job_id):
                raise SlugTaken(data["slug"])
    if data.get("expires_at") and hasattr(data["expires_at"], "isoformat"):
        data["expires_at"] = data["expires_at"].isoformat()
    try:
        result = db.table("jobs").update(data).eq("id", job_id).execute()
    except Exception as e:
        logger.error("Failed to update job %s: %s", job_id, e)
        raise
    return result.data[0] if result.data else None


def delete(job_id: str):
    """The applications go with the job in the database, but their resume
    files would stay on the server, so they are removed here too."""
    db = get_supabase()
    try:
        apps = db.table("job_applications").select("resume_path").eq("job_id", job_id).execute().data or []
    except Exception as e:
        logger.error("Could not list resumes for job %s: %s", job_id, e)
        apps = []
    result = db.table("jobs").delete().eq("id", job_id).execute()
    if not result.data:
        return False, []
    warnings = []
    for app in apps:
        if app.get("resume_path") and not ftp_service.delete_file(app["resume_path"]):
            warnings.append("The job was deleted, but a resume file could not be removed from storage.")
    return True, warnings[:1]


def get_by_id(job_id: str):
    db = get_supabase()
    result = db.table("jobs").select("*").eq("id", job_id).execute()
    return result.data[0] if result.data else None


def store_application(job_id: str, data: dict):
    """Returns None if the application could not be stored. The real error
    stays in the log. Nothing about the database reaches the applicant."""
    db = get_supabase()
    data["job_id"] = job_id
    try:
        result = db.table("job_applications").insert(data).execute()
    except Exception as e:
        logger.error("Failed to store application for job %s: %s", job_id, e)
        return None
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


def count_applications_for(job_ids: list = None) -> dict:
    """One query for a whole page of roles. Counting them one role at a
    time pulled every applicant's details into the browser to arrive at a
    number, which is both slow and more than the panel needs to know."""
    db = get_supabase()
    query = db.table("job_applications").select("job_id")
    if job_ids is not None:
        if not job_ids:
            return {}
        query = query.in_("job_id", job_ids)

    counts = {}
    for row in (query.execute().data or []):
        key = row.get("job_id")
        if key:
            counts[key] = counts.get(key, 0) + 1
    if job_ids is not None:
        for key in job_ids:
            counts.setdefault(key, 0)
    return counts


def get_application_by_id(app_id: str):
    db = get_supabase()
    result = db.table("job_applications").select("*").eq("id", app_id).execute()
    return result.data[0] if result.data else None


def delete_application(app_id: str):
    db = get_supabase()
    app = db.table("job_applications").select("*").eq("id", app_id).execute()
    if not app.data:
        return None, []
    app_data = app.data[0]
    db.table("job_applications").delete().eq("id", app_id).execute()

    warnings = []
    if app_data.get("resume_path"):
        if not ftp_service.delete_file(app_data["resume_path"]):
            warnings.append("Application deleted, but the resume file could not be removed from storage.")

    return app_data, warnings


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

    # the closed posting still holds the plain slug, so a repost takes the
    # next number free: ai-engineer-2, ai-engineer-3
    new_data["slug"] = free_slug("jobs", new_data["title"], "job")

    result = db.table("jobs").insert(new_data).execute()
    return result.data[0] if result.data else None


def cleanup_old_closed_jobs(days: int = 7):
    db = get_supabase()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
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
                    .select("id, resume_path")
                    .eq("job_id", job_id)
                    .execute()
                )
                for app in (apps.data or []):
                    if app.get("resume_path"):
                        if not ftp_service.delete_file(app["resume_path"]):
                            warnings.append(f"Failed to delete resume for app {app['id']}")

                db.table("job_applications").delete().eq("job_id", job_id).execute()
                db.table("jobs").delete().eq("id", job_id).execute()
                deleted_count += 1
            except Exception as e:
                logger.error("Failed to delete job %s during cleanup: %s", job_id, e)
                warnings.append(f"Job {job_id} could not be removed. The reason is in the server log.")

    except Exception as e:
        logger.error("Job cleanup failed: %s", e)
        warnings.append("The cleanup could not run. The reason is in the server log.")

    return {"deleted": deleted_count, "warnings": warnings}
