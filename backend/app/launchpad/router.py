from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import get_current_user
from app.launchpad import service
from app.launchpad.schemas import (
    LaunchpadCreate,
    LaunchpadUpdate,
    LaunchpadResponse,
    LaunchpadDetailResponse,
    CommentCreate,
    CommentResponse,
)

router = APIRouter(prefix="/api/launchpad", tags=["launchpad"])


@router.get("", response_model=list[LaunchpadResponse])
def list_entries(page: int = Query(1, ge=1), limit: int = Query(10, ge=1, le=50)):
    return service.list_active(page, limit)


@router.get("/{slug}", response_model=LaunchpadDetailResponse)
def get_entry(slug: str):
    entry = service.get_by_slug(slug)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@router.post("", response_model=LaunchpadResponse, status_code=status.HTTP_201_CREATED)
def create_entry(body: LaunchpadCreate, _user: dict = Depends(get_current_user)):
    return service.create(body.model_dump(exclude_none=True))


@router.put("/{id}", response_model=LaunchpadResponse)
def update_entry(id: str, body: LaunchpadUpdate, _user: dict = Depends(get_current_user)):
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = service.update(id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Entry not found")
    return result


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(id: str, _user: dict = Depends(get_current_user)):
    if not service.delete(id):
        raise HTTPException(status_code=404, detail="Entry not found")


@router.post("/{slug}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def add_comment(slug: str, body: CommentCreate):
    entry = service.get_by_slug(slug)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return service.add_comment(entry["id"], body.model_dump())
