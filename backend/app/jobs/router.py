import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File, Form, status
from fastapi.responses import Response
from typing import Optional

from app.auth.dependencies import get_current_user, require_manager
from app.jobs import service
from app.jobs.schemas import JobCreate, JobUpdate, JobResponse, JobApplication
from app.email.service import send_email, is_email_enabled
from app.email import templates
from app.config import get_settings
from app.admin.service import log_activity
from app.revisions import service as revisions
from app.database import get_supabase
from app.storage import ftp_service
from app.security import limiter, clean_text, single_line
from pydantic import EmailStr, TypeAdapter, ValidationError

_email = TypeAdapter(EmailStr)
MAX_RESUME_BYTES = 5 * 1024 * 1024


def _clean_answers(raw: Optional[str]) -> Optional[dict]:
    if not raw or len(raw) > 20000:
        return None
    import json
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(data, dict):
        return None
    out = {}
    for q, a in list(data.items())[:30]:
        if isinstance(a, (str, int, float, bool)):
            out[single_line(str(q))[:300]] = clean_text(str(a))[:3000]
    return out

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

RESUME_FAILED_MESSAGE = "Your resume could not be uploaded right now. Please try again or contact us."


def _id_list(raw: Optional[str]) -> Optional[list]:
    if raw is None:
        return None
    return [part.strip() for part in raw.split(",") if part.strip()]


@router.get("", response_model=list[JobResponse])
def list_jobs(page: int = Query(1, ge=1), limit: int = Query(10, ge=1, le=50)):
    return service.list_open(page, limit)


@router.get("/admin/all", response_model=list[JobResponse])
def list_all_jobs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    _user: dict = Depends(get_current_user),
):
    return service.list_all(page, limit)


@router.get("/admin/closed", response_model=list[JobResponse])
def list_closed_jobs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    _user: dict = Depends(get_current_user),
):
    return service.list_closed(page, limit)


@router.get("/admin/application-counts")
def application_counts(
    ids: Optional[str] = Query(None, description="Comma separated job ids"),
    _user: dict = Depends(get_current_user),
):
    wanted = _id_list(ids)
    try:
        return {"success": True, "data": service.count_applications_for(wanted)}
    except Exception as e:
        logger.error("Application counts failed: %s", e)
        return {"success": False, "data": {}, "warnings": ["Application counts could not be loaded"]}


@router.delete("/admin/cleanup")
def cleanup_old_jobs(_user: dict = Depends(require_manager)):
    # set in the panel. 0 keeps closed roles forever
    days = 7
    try:
        setting = get_supabase().table("settings").select("value").eq("key", "job_cleanup_days").execute().data
        if setting:
            days = int(setting[0]["value"])
    except (ValueError, TypeError):
        logger.warning("job_cleanup_days is not a number, using %s", days)
    except Exception as e:
        logger.warning("Could not read job_cleanup_days: %s", e)
    if days <= 0:
        return {"success": True, "deleted": 0, "warnings": []}
    result = service.cleanup_old_closed_jobs(days)
    if result["deleted"]:
        log_activity(_user["email"], "cleanup", "jobs", "", f"Deleted {result['deleted']} jobs closed over {days} days ago")
    return {"success": True, "deleted": result["deleted"], "warnings": result.get("warnings", [])}


@router.get("/{slug}", response_model=JobResponse)
def get_job(slug: str):
    job = service.get_by_slug(slug)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("max_applications") is not None:
        job["application_count"] = service.count_applications(job["id"])
    return job


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
def create_job(body: JobCreate, _user: dict = Depends(get_current_user)):
    data = body.model_dump(exclude_none=True)
    if not (data.get("title") or "").strip():
        raise HTTPException(status_code=400, detail="A role needs a title")
    data["last_edited_by"] = _user["email"]
    data["last_edited_at"] = datetime.now(timezone.utc).isoformat()
    try:
        result = service.create(data)
    except Exception:
        raise HTTPException(status_code=500, detail="The job could not be saved. The reason is in the server log.")
    if not result:
        logger.error("Job insert for %s reported no row", data.get("slug"))
        raise HTTPException(status_code=500, detail="The job could not be saved. The reason is in the server log.")
    log_activity(_user["email"], "create", "job", result["id"], result["title"])
    return result


@router.put("/{id}", response_model=JobResponse)
def update_job(id: str, body: JobUpdate, _user: dict = Depends(get_current_user)):
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    if "title" in data and not (data["title"] or "").strip():
        raise HTTPException(status_code=400, detail="A role needs a title")
    data["last_edited_by"] = _user["email"]
    data["last_edited_at"] = datetime.now(timezone.utc).isoformat()
    revisions.record_before("job", id, service.get_by_id, _user["email"], data)
    # a raised error is the database refusing the write, an empty result is
    # simply no row with that id, and the two deserve different answers
    try:
        result = service.update(id, data)
    except service.SlugTaken as e:
        raise HTTPException(status_code=409, detail=f"Another role already uses the address \"{e}\". Pick a different slug.")
    except Exception:
        raise HTTPException(status_code=500, detail="The changes could not be saved. The reason is in the server log.")
    if not result:
        raise HTTPException(status_code=404, detail="Job not found")
    log_activity(_user["email"], "update", "job", result["id"], result["title"])
    return result


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(id: str, _user: dict = Depends(require_manager)):
    job = service.get_by_id(id)
    deleted, warnings = service.delete(id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Job not found")
    for warning in warnings:
        logger.warning("Job %s: %s", id, warning)
    log_activity(_user["email"], "delete", "job", id, job["title"] if job else id)


@router.get("/{id}/applications")
def get_applications(id: str, _user: dict = Depends(get_current_user)):
    job = service.get_by_id(id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return service.list_applications(id)


@router.delete("/applications/{id}")
def delete_application(id: str, _user: dict = Depends(require_manager)):
    result, warnings = service.delete_application(id)
    if not result:
        raise HTTPException(status_code=404, detail="Application not found")
    log_activity(_user["email"], "delete", "application", id, result.get("name", id))
    response = {"success": True}
    if warnings:
        response["warnings"] = warnings
    return response


@router.get("/applications/{id}/resume")
def get_application_resume(id: str, _user: dict = Depends(get_current_user)):
    application = service.get_application_by_id(id)
    if not application or not application.get("resume_path"):
        raise HTTPException(status_code=404, detail="Resume not found")

    content, error = ftp_service.read_file(application["resume_path"])
    if content is None:
        logger.error("Resume fetch failed for application %s: %s", id, error)
        raise HTTPException(status_code=502, detail=error or "Failed to retrieve resume")

    return Response(content=content, media_type="application/pdf")


@router.post("/{id}/repost", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
def repost_job(id: str, body: Optional[JobUpdate] = None, _user: dict = Depends(get_current_user)):
    overrides = body.model_dump(exclude_none=True) if body else {}
    overrides.pop("slug", None)
    expires = overrides.get("expires_at")
    if expires is not None:
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires <= datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Pick an expiry date in the future.")
        overrides["expires_at"] = expires.isoformat()
    overrides["last_edited_by"] = _user["email"]
    overrides["last_edited_at"] = datetime.now(timezone.utc).isoformat()
    try:
        result = service.repost_job(id, overrides)
    except Exception as e:
        logger.error("Repost of job %s failed: %s", id, e)
        raise HTTPException(status_code=500, detail="The job could not be republished. The reason is in the server log.")
    if not result:
        raise HTTPException(status_code=404, detail="Job not found")
    log_activity(_user["email"], "repost", "job", result["id"], result["title"])
    return result


@router.post("/{slug}/apply", status_code=status.HTTP_201_CREATED)
@limiter.limit("3/hour")
async def apply_to_job(
    slug: str,
    request: Request,
    name: str = Form(...),
    email: str = Form(...),
    resume_text: str = Form(...),
    cover_letter: Optional[str] = Form(None),
    custom_answers: Optional[str] = Form(None),
    resume: Optional[UploadFile] = File(None),
):
    name = single_line(name)
    resume_text = clean_text(resume_text)
    cover_letter = clean_text(cover_letter or "")
    try:
        email = str(_email.validate_python(email.strip()))
    except ValidationError:
        raise HTTPException(status_code=422, detail="Please enter a valid email address")
    if not name or len(name) > 100:
        raise HTTPException(status_code=422, detail="Please enter your name (up to 100 characters)")
    if not resume_text or len(resume_text) > 10000:
        raise HTTPException(status_code=422, detail="Tell us about your experience in up to 10,000 characters")
    if len(cover_letter) > 8000:
        raise HTTPException(status_code=422, detail="Cover letter must be under 8,000 characters")

    job = service.get_by_slug(slug)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.get("max_applications") is not None:
        current_count = service.count_applications(job["id"])
        if current_count >= job["max_applications"]:
            raise HTTPException(status_code=400, detail="This position is no longer accepting applications")

    app_data = {
        "name": name,
        "email": email,
        "resume_text": resume_text,
        "cover_letter": cover_letter or "",
    }

    answers = _clean_answers(custom_answers)
    if answers:
        app_data["custom_answers"] = answers

    resume_path = None
    resume_uploaded = False
    resume_error = None
    if resume:
        # read one byte past the limit rather than the whole upload
        content = await resume.read(MAX_RESUME_BYTES + 1)
        if not content[:5].startswith(b'%PDF-'):
            raise HTTPException(status_code=400, detail="Resume must be a PDF file")

        if len(content) > MAX_RESUME_BYTES:
            raise HTTPException(status_code=400, detail="Resume must be under 5MB")

        import time
        import re
        timestamp = int(time.time())
        safe_email = re.sub(r'[^a-zA-Z0-9@._-]', '_', email)
        filename = f"{safe_email}_{timestamp}.pdf"
        remote_dir = f"private_uploads/resumes/{slug}"

        remote_path, resume_error = ftp_service.store_file(content, remote_dir, filename)
        if remote_path:
            resume_path = remote_path
            resume_uploaded = True
            app_data["resume_path"] = resume_path
        else:
            logger.error("Resume upload failed for application by %s: %s", email, resume_error)

    application = service.store_application(job["id"], app_data)
    if not application:
        logger.error("Application by %s for %s was not stored", email, slug)
        raise HTTPException(status_code=500, detail="Your application could not be saved. Please try again.")

    if job.get("max_applications") is not None:
        new_count = service.count_applications(job["id"])
        if new_count >= job["max_applications"]:
            service.update(job["id"], {"status": "closed"})

    warnings = []
    # the real reason is already in the log, and an applicant should not be
    # reading connection errors off a careers page
    if resume_error:
        warnings.append(RESUME_FAILED_MESSAGE)
    email_status = "skipped"

    if not is_email_enabled():
        email_status = "disabled"
        try:
            db = get_supabase()
            db.table("job_applications").update({"email_status": email_status}).eq("id", application["id"]).execute()
        except Exception:
            pass
        response = {"success": True, "message": "Application submitted"}
        if resume_error:
            response["warnings"] = [RESUME_FAILED_MESSAGE]
        return response

    settings = get_settings()
    alert_subject, alert_html, alert_text = templates.application_alert(
        job["title"], name, email, resume_text, cover_letter, app_data.get("custom_answers"), resume_uploaded
    )

    # send_email blocks on an HTTP call, and this endpoint is async, so a slow
    # provider would stall every other request this worker is serving
    try:
        notified = await asyncio.to_thread(
            send_email, settings.notification_recipient, alert_subject, alert_html, "careers", alert_text, email
        )
        if not notified:
            logger.error("Admin notification for the application by %s was not delivered", email)
            warnings.append("Admin notification email failed")
    except Exception as e:
        logger.error("Admin notification email failed: %s", e)
        warnings.append("Admin notification email failed")

    try:
        subject, applicant_html, applicant_text = templates.application_received(name, job["title"], resume_uploaded)
        sent = await asyncio.to_thread(
            send_email, email, subject, applicant_html, "careers", applicant_text
        )
        email_status = "sent" if sent else "failed"
        # a false return is a delivery failure the same as a raised one,
        # and the applicant's confirmation is worth a warning either way
        if not sent:
            logger.error("Applicant confirmation to %s was not delivered", email)
            warnings.append("Confirmation email failed")
    except Exception as e:
        logger.error("Applicant confirmation email failed: %s", e)
        email_status = "failed"
        warnings.append("Confirmation email failed")

    try:
        db = get_supabase()
        db.table("job_applications").update({"email_status": email_status}).eq("id", application["id"]).execute()
    except Exception:
        pass

    response = {"success": True, "message": "Application submitted"}
    if warnings:
        response["warnings"] = warnings
    return response
