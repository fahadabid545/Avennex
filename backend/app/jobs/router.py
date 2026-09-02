from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.auth.dependencies import get_current_user
from app.jobs import service
from app.jobs.schemas import JobCreate, JobUpdate, JobResponse, JobApplication
from app.email.service import send_email
from app.config import get_settings

router = APIRouter(prefix="/api/jobs", tags=["jobs"])
limiter = Limiter(key_func=get_remote_address)


@router.get("", response_model=list[JobResponse])
def list_jobs(page: int = Query(1, ge=1), limit: int = Query(10, ge=1, le=50)):
    return service.list_open(page, limit)


@router.get("/{slug}", response_model=JobResponse)
def get_job(slug: str):
    job = service.get_by_slug(slug)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
def create_job(body: JobCreate, _user: dict = Depends(get_current_user)):
    return service.create(body.model_dump(exclude_none=True))


@router.put("/{id}", response_model=JobResponse)
def update_job(id: str, body: JobUpdate, _user: dict = Depends(get_current_user)):
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = service.update(id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Job not found")
    return result


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(id: str, _user: dict = Depends(get_current_user)):
    if not service.delete(id):
        raise HTTPException(status_code=404, detail="Job not found")


@router.post("/{slug}/apply", status_code=status.HTTP_201_CREATED)
def apply_to_job(slug: str, body: JobApplication, request: Request):
    job = service.get_by_slug(slug)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    settings = get_settings()
    cover = body.cover_letter or "Not provided"
    html = f"""
    <h2>New application for: {job['title']}</h2>
    <p><strong>Name:</strong> {body.name}</p>
    <p><strong>Email:</strong> {body.email}</p>
    <h3>Resume</h3>
    <pre>{body.resume_text}</pre>
    <h3>Cover Letter</h3>
    <p>{cover}</p>
    """
    send_email(settings.smtp_from_email, f"Job Application: {job['title']} - {body.name}", html)
    return {"message": "Application submitted"}
