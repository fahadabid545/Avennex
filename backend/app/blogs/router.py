import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import get_current_user, require_manager
from app.blogs import service
from app.blogs.schemas import BlogCreate, BlogUpdate, BlogResponse
from app.admin.service import log_activity
from app.revisions import service as revisions

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/blogs", tags=["blogs"])

BLOG_STATUSES = ("draft", "published", "scheduled")


def _check_schedule(data: dict):
    if data.get("status") and data["status"] not in BLOG_STATUSES:
        raise HTTPException(status_code=400, detail="Unknown status")
    if data.get("status") != "scheduled":
        return
    when = data.get("publish_at")
    if not when:
        raise HTTPException(status_code=400, detail="A scheduled post needs a date and time")
    if isinstance(when, str):
        try:
            when = datetime.fromisoformat(when.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="That date could not be read")
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    if when <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Pick a time in the future")


def _as_text_dates(data: dict) -> dict:
    # the database driver sends json, which has no date type
    for key in ("publish_at", "published_at"):
        if isinstance(data.get(key), datetime):
            data[key] = data[key].isoformat()
    return data


@router.get("", response_model=list[BlogResponse])
def list_blogs(page: int = Query(1, ge=1), limit: int = Query(10, ge=1, le=50)):
    return service.list_published(page, limit)


@router.get("/admin/all", response_model=list[BlogResponse])
def list_all_blogs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    _user: dict = Depends(get_current_user),
):
    return service.list_all(page, limit)


@router.post("/admin/publish-due")
def publish_due(_user: dict = Depends(get_current_user)):
    """Reading the blog already releases what is due. This is for putting a
    post live the moment its time passes, without waiting for a reader."""
    try:
        released = service.release_due(force=True)
        return {"success": True, "data": {"released": released}}
    except Exception as e:
        logger.error("Manual release failed: %s", e)
        return {"success": False, "data": {"released": 0}, "warnings": ["Scheduled posts could not be released"]}


@router.get("/{slug}", response_model=BlogResponse)
def get_blog(slug: str):
    blog = service.get_by_slug(slug)
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")
    return blog


@router.post("", response_model=BlogResponse, status_code=status.HTTP_201_CREATED)
def create_blog(body: BlogCreate, _user: dict = Depends(get_current_user)):
    data = _as_text_dates(body.model_dump(exclude_none=True))
    _check_schedule(data)
    data["last_edited_by"] = _user["email"]
    data["last_edited_at"] = datetime.now(timezone.utc).isoformat()
    result = service.create(data)
    log_activity(_user["email"], "create", "blog", result["id"], result["title"])
    return result


@router.put("/{id}", response_model=BlogResponse)
def update_blog(id: str, body: BlogUpdate, _user: dict = Depends(get_current_user)):
    data = _as_text_dates(body.model_dump(exclude_unset=True))
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    _check_schedule(data)
    data["last_edited_by"] = _user["email"]
    data["last_edited_at"] = datetime.now(timezone.utc).isoformat()
    revisions.record_before("blog", id, service.get_by_id, _user["email"], data)
    action = "publish" if data.get("status") == "published" else (
        "schedule" if data.get("status") == "scheduled" else "update")
    result = service.update(id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Blog not found")
    log_activity(_user["email"], action, "blog", result["id"], result["title"])
    return result


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_blog(id: str, _user: dict = Depends(require_manager)):
    blog = service.get_by_id(id)
    if not service.delete(id):
        raise HTTPException(status_code=404, detail="Blog not found")
    log_activity(_user["email"], "delete", "blog", id, blog["title"] if blog else id)
