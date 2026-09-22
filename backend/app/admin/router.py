import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from typing import Optional

from app.auth.dependencies import get_current_user, require_owner
from app.admin import service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


ROLE_VALUES = ("owner", "admin", "editor")


class AdminCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: Optional[str] = None
    role: str = "editor"


class AdminUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None


@router.get("/stats")
def get_stats(_user: dict = Depends(get_current_user)):
    try:
        return {"success": True, "data": service.get_stats()}
    except Exception as e:
        logger.error("Stats fetch failed: %s", e)
        return {"success": False, "data": {}, "warnings": ["Failed to load stats"]}


@router.get("/charts")
def get_charts(days: int = Query(7, ge=1, le=90), _user: dict = Depends(get_current_user)):
    try:
        return {"success": True, "data": service.get_charts(days)}
    except Exception as e:
        logger.error("Charts fetch failed: %s", e)
        return {"success": False, "data": {}, "warnings": ["Failed to load charts"]}


@router.get("/activity")
def get_activity(
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    _user: dict = Depends(get_current_user),
):
    return service.list_activity(page, limit)


@router.get("/me")
def whoami(_user: dict = Depends(get_current_user)):
    profile = service.get_admin(_user["id"]) or {}
    return {
        "id": _user["id"],
        "email": _user["email"],
        "name": profile.get("name"),
        "role": _user["role"],
    }


@router.get("/users")
def list_admins(_user: dict = Depends(require_owner)):
    return service.list_admins()


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_admin(body: AdminCreate, _user: dict = Depends(require_owner)):
    if body.role not in ROLE_VALUES:
        raise HTTPException(status_code=400, detail="Unknown role")
    result = service.create_admin(body.email, body.password, body.name, body.role)
    if not result:
        raise HTTPException(status_code=400, detail="Email already exists")
    return result


@router.put("/users/{id}")
def update_admin(id: str, body: AdminUpdate, _user: dict = Depends(require_owner)):
    if body.role is not None and body.role not in ROLE_VALUES:
        raise HTTPException(status_code=400, detail="Unknown role")
    # the panel is unusable once nobody can manage accounts, so the last
    # owner cannot be stepped down, by themselves or anyone else
    if body.role is not None and body.role != "owner" and not service.count_owners(exclude_id=id):
        raise HTTPException(status_code=400, detail="At least one owner is needed")
    result = service.update_admin(id, body.name, body.role)
    if not result:
        raise HTTPException(status_code=404, detail="Admin not found")
    return result


@router.delete("/users/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin(id: str, _user: dict = Depends(require_owner)):
    if id == _user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    if not service.count_owners(exclude_id=id):
        raise HTTPException(status_code=400, detail="At least one owner is needed")
    if not service.delete_admin(id):
        raise HTTPException(status_code=404, detail="Admin not found")
