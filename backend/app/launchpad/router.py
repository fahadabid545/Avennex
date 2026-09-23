import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.auth.dependencies import get_current_user, require_manager
from app.launchpad import service
from app.admin.service import log_activity
from app.revisions import service as revisions
from app.launchpad.schemas import (
    LaunchpadCreate,
    LaunchpadUpdate,
    LaunchpadResponse,
    LaunchpadDetailResponse,
    CommentCreate,
    CommentResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/launchpad", tags=["launchpad"])


def _id_list(raw: Optional[str]) -> Optional[list]:
    if raw is None:
        return None
    return [part.strip() for part in raw.split(",") if part.strip()]
limiter = Limiter(key_func=get_remote_address)


@router.get("", response_model=list[LaunchpadResponse])
def list_entries(page: int = Query(1, ge=1), limit: int = Query(10, ge=1, le=50)):
    return service.list_active(page, limit)


@router.get("/admin/all", response_model=list[LaunchpadResponse])
def list_all_entries(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    _user: dict = Depends(get_current_user),
):
    try:
        return service.list_all(page, limit)
    except Exception as e:
        logger.error("Failed to list admin launchpad entries: %s", e)
        raise HTTPException(status_code=500, detail="Failed to load launchpad entries")


# these two sit above /{slug} and /{id}/comments on purpose: routes match in
# the order they are declared, and "admin" would otherwise be read as an id
@router.get("/admin/comment-counts")
def comment_counts(
    ids: Optional[str] = Query(None, description="Comma separated entry ids"),
    _user: dict = Depends(get_current_user),
):
    wanted = _id_list(ids)
    try:
        return {"success": True, "data": service.count_comments_for(wanted)}
    except Exception as e:
        logger.error("Comment counts failed: %s", e)
        return {"success": False, "data": {}, "warnings": ["Comment counts could not be loaded"]}


@router.get("/admin/comments")
def all_comments(
    ids: Optional[str] = Query(None, description="Comma separated entry ids"),
    limit: int = Query(200, ge=1, le=500),
    _user: dict = Depends(get_current_user),
):
    wanted = _id_list(ids)
    try:
        return {"success": True, "data": service.list_comments_for(wanted, limit)}
    except Exception as e:
        logger.error("Comment fetch failed: %s", e)
        return {"success": False, "data": [], "warnings": ["Comments could not be loaded"]}


@router.get("/{slug}", response_model=LaunchpadDetailResponse)
def get_entry(slug: str):
    entry = service.get_by_slug(slug)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@router.post("", response_model=LaunchpadResponse, status_code=status.HTTP_201_CREATED)
def create_entry(body: LaunchpadCreate, _user: dict = Depends(get_current_user)):
    data = body.model_dump(exclude_none=True)
    data["last_edited_by"] = _user["email"]
    data["last_edited_at"] = datetime.now(timezone.utc).isoformat()
    try:
        result = service.create(data)
    except Exception as e:
        logger.error("Failed to create launchpad entry: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save entry")
    if not result:
        raise HTTPException(status_code=500, detail="Failed to save entry")
    log_activity(_user["email"], "create", "launchpad", result["id"], result["title"])
    return result


@router.put("/{id}", response_model=LaunchpadResponse)
def update_entry(id: str, body: LaunchpadUpdate, _user: dict = Depends(get_current_user)):
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    data["last_edited_by"] = _user["email"]
    data["last_edited_at"] = datetime.now(timezone.utc).isoformat()
    revisions.record_before("launchpad", id, service.get_by_id, _user["email"], data)
    try:
        result = service.update(id, data)
    except Exception as e:
        logger.error("Failed to update launchpad entry %s: %s", id, e)
        raise HTTPException(status_code=500, detail="Failed to update entry")
    if not result:
        raise HTTPException(status_code=404, detail="Entry not found")
    log_activity(_user["email"], "update", "launchpad", result["id"], result["title"])
    return result


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(id: str, _user: dict = Depends(require_manager)):
    entry = service.get_by_id(id)
    if not service.delete(id):
        raise HTTPException(status_code=404, detail="Entry not found")
    log_activity(_user["email"], "delete", "launchpad", id, entry["title"] if entry else id)


@router.get("/{id}/comments")
def list_comments(id: str, _user: dict = Depends(get_current_user)):
    return service.list_comments(id)


@router.post("/{slug}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/hour")
def add_comment(slug: str, body: CommentCreate, request: Request):
    entry = service.get_by_slug(slug)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return service.add_comment(entry["id"], body.model_dump())


@router.delete("/comments/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(id: str, _user: dict = Depends(require_manager)):
    if not service.delete_comment(id):
        raise HTTPException(status_code=404, detail="Comment not found")
