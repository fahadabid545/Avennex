from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.auth.dependencies import get_current_user
from app.admin import service

router = APIRouter(prefix="/api/admin", tags=["admin"])


class AdminCreate(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None


@router.get("/activity")
def get_activity(
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    _user: dict = Depends(get_current_user),
):
    return service.list_activity(page, limit)


@router.get("/users")
def list_admins(_user: dict = Depends(get_current_user)):
    return service.list_admins()


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_admin(body: AdminCreate, _user: dict = Depends(get_current_user)):
    result = service.create_admin(body.email, body.password, body.name)
    if not result:
        raise HTTPException(status_code=400, detail="Email already exists")
    return {"id": result["id"], "email": result["email"], "name": result["name"]}


@router.delete("/users/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin(id: str, _user: dict = Depends(get_current_user)):
    if id == _user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    if not service.delete_admin(id):
        raise HTTPException(status_code=404, detail="Admin not found")
