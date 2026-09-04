import logging
from html import escape as html_escape

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File, Form, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from typing import Optional

from app.auth.dependencies import get_current_user
from app.jobs import service
from app.jobs.schemas import JobCreate, JobUpdate, JobResponse, JobApplication
from app.email.service import send_email, is_email_enabled
from app.config import get_settings
from app.admin.service import log_activity
from app.database import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/jobs", tags=["jobs"])
limiter = Limiter(key_func=get_remote_address)


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


@router.get("/{slug}", response_model=JobResponse)
def get_job(slug: str):
    job = service.get_by_slug(slug)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
def create_job(body: JobCreate, _user: dict = Depends(get_current_user)):
    result = service.create(body.model_dump(exclude_none=True))
    log_activity(_user["email"], "create", "job", result["id"], result["title"])
    return result


@router.put("/{id}", response_model=JobResponse)
def update_job(id: str, body: JobUpdate, _user: dict = Depends(get_current_user)):
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = service.update(id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Job not found")
    log_activity(_user["email"], "update", "job", result["id"], result["title"])
    return result


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(id: str, _user: dict = Depends(get_current_user)):
    job = service.get_by_id(id)
    if not service.delete(id):
        raise HTTPException(status_code=404, detail="Job not found")
    log_activity(_user["email"], "delete", "job", id, job["title"] if job else id)


@router.get("/{id}/applications")
def get_applications(id: str, _user: dict = Depends(get_current_user)):
    job = service.get_by_id(id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return service.list_applications(id)


@router.delete("/applications/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(id: str, _user: dict = Depends(get_current_user)):
    result = service.delete_application(id)
    if not result:
        raise HTTPException(status_code=404, detail="Application not found")
    log_activity(_user["email"], "delete", "application", id, result.get("name", id))


@router.post("/{id}/repost", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
def repost_job(id: str, body: Optional[JobUpdate] = None, _user: dict = Depends(get_current_user)):
    overrides = body.model_dump(exclude_none=True) if body else {}
    result = service.repost_job(id, overrides)
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
    job = service.get_by_slug(slug)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.get("max_applications"):
        current_count = service.count_applications(job["id"])
        if current_count >= job["max_applications"]:
            raise HTTPException(status_code=400, detail="This position is no longer accepting applications")

    app_data = {
        "name": name,
        "email": email,
        "resume_text": resume_text,
        "cover_letter": cover_letter or "",
    }

    if custom_answers:
        import json
        try:
            app_data["custom_answers"] = json.loads(custom_answers)
        except (json.JSONDecodeError, TypeError):
            pass

    resume_url = None
    if resume:
        content = await resume.read()
        if not content[:5].startswith(b'%PDF-'):
            raise HTTPException(status_code=400, detail="Resume must be a PDF file")

        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Resume must be under 5MB")

        import time
        import re
        timestamp = int(time.time())
        safe_email = re.sub(r'[^a-zA-Z0-9@._-]', '_', email)
        path = f"{slug}/{safe_email}_{timestamp}.pdf"

        db = get_supabase()
        try:
            db.storage.from_("resumes").upload(path, content, {"content-type": "application/pdf"})
            public_url = db.storage.from_("resumes").get_public_url(path)
            resume_url = public_url
            app_data["resume_url"] = resume_url
        except Exception:
            pass

    application = service.store_application(job["id"], app_data)

    if job.get("max_applications"):
        new_count = service.count_applications(job["id"])
        if new_count >= job["max_applications"]:
            service.update(job["id"], {"status": "closed"})

    warnings = []
    email_status = "skipped"

    if not is_email_enabled():
        email_status = "disabled"
        try:
            db = get_supabase()
            db.table("job_applications").update({"email_status": email_status}).eq("id", application["id"]).execute()
        except Exception:
            pass
        response = {"success": True, "message": "Application submitted"}
        return response

    settings = get_settings()
    cover = cover_letter or "Not provided"
    resume_link = f'<p><a href="{html_escape(resume_url)}">Download Resume</a></p>' if resume_url else ""
    admin_html = f"""
    <h2>New application for: {html_escape(job['title'])}</h2>
    <p><strong>Name:</strong> {html_escape(name)}</p>
    <p><strong>Email:</strong> {html_escape(email)}</p>
    <h3>Resume</h3>
    <pre>{html_escape(resume_text)}</pre>
    {resume_link}
    <h3>Cover Letter</h3>
    <p>{html_escape(cover)}</p>
    """

    try:
        send_email(settings.smtp_from_email, f"Job Application: {job['title']} - {name}", admin_html, email_type="careers")
    except Exception as e:
        logger.error("Admin notification email failed: %s", e)
        warnings.append(f"Admin notification email failed: {e}")

    try:
        applicant_html = f"""
        <h2>Application received</h2>
        <p>Your application for <strong>{html_escape(job['title'])}</strong> at Avennex has been received.</p>
        <p>We'll review it and get back to you if there's a fit.</p>
        """
        sent = send_email(email, f"Application received for {job['title']} at Avennex", applicant_html, email_type="careers")
        email_status = "sent" if sent else "failed"
    except Exception as e:
        logger.error("Applicant confirmation email failed: %s", e)
        email_status = "failed"
        warnings.append(f"Confirmation email failed: {e}")

    try:
        db = get_supabase()
        db.table("job_applications").update({"email_status": email_status}).eq("id", application["id"]).execute()
    except Exception:
        pass

    response = {"success": True, "message": "Application submitted"}
    if warnings:
        response["warnings"] = warnings
    return response
