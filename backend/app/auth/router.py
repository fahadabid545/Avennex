from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.database import get_supabase
from app.auth.service import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SetupRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/setup", status_code=status.HTTP_201_CREATED)
def setup(body: SetupRequest):
    db = get_supabase()
    existing = db.table("admins").select("id").limit(1).execute()
    if existing.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Setup already complete")

    password_hash = hash_password(body.password)
    db.table("admins").insert({
        "email": body.email,
        "password_hash": password_hash,
        "name": "Admin",
    }).execute()
    return {"message": "Admin created"}


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest):
    db = get_supabase()

    result = db.table("admins").select("*").eq("email", body.email).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    admin = result.data[0]
    if not verify_password(body.password, admin["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access_token = create_access_token(admin["id"], admin["email"])
    refresh_token, expires_at = create_refresh_token()

    db.table("refresh_tokens").insert({
        "admin_id": admin["id"],
        "token": refresh_token,
        "expires_at": expires_at.isoformat(),
    }).execute()

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=AccessTokenResponse)
def refresh(body: RefreshRequest):
    db = get_supabase()

    result = (
        db.table("refresh_tokens")
        .select("*, admins(id, email)")
        .eq("token", body.refresh_token)
        .eq("revoked", False)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    record = result.data[0]
    from datetime import datetime, timezone

    if datetime.fromisoformat(record["expires_at"]) < datetime.now(timezone.utc):
        db.table("refresh_tokens").update({"revoked": True}).eq("id", record["id"]).execute()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    admin = record["admins"]
    access_token = create_access_token(admin["id"], admin["email"])
    return AccessTokenResponse(access_token=access_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: RefreshRequest):
    db = get_supabase()
    db.table("refresh_tokens").update({"revoked": True}).eq("token", body.refresh_token).execute()
