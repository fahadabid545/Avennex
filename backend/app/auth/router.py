import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.database import get_supabase
from app.auth.service import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    create_reset_token,
)

logger = logging.getLogger(__name__)

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


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest):
    db = get_supabase()
    result = db.table("admins").select("id, email").eq("email", body.email).execute()
    warnings = []
    if result.data:
        admin = result.data[0]
        token, expires_at = create_reset_token()
        db.table("admins").update({
            "reset_token": token,
            "reset_token_expires": expires_at.isoformat(),
        }).eq("id", admin["id"]).execute()

        try:
            from app.email.service import send_email
            from app.config import get_settings
            settings = get_settings()
            html = f"""
            <h2>Password Reset</h2>
            <p>Your password reset token is: <strong>{token}</strong></p>
            <p>This token expires in 1 hour.</p>
            """
            sent = send_email(admin["email"], "Avennex Password Reset", html)
            if not sent:
                logger.info("Password reset token for %s: %s (email not configured)", admin["email"], token)
                warnings.append("Email service not configured, token logged to server")
        except Exception as e:
            logger.info("Password reset token for %s: %s (email failed)", admin["email"], token)
            warnings.append("Email delivery failed, token logged to server")

    response = {"success": True, "message": "If that email exists, a reset link has been sent."}
    if warnings:
        response["warnings"] = warnings
    return response


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest):
    db = get_supabase()
    result = (
        db.table("admins")
        .select("id, reset_token, reset_token_expires")
        .eq("reset_token", body.token)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    admin = result.data[0]
    if admin.get("reset_token_expires"):
        if datetime.fromisoformat(admin["reset_token_expires"]) < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    password_hash = hash_password(body.new_password)
    db.table("admins").update({
        "password_hash": password_hash,
        "reset_token": None,
        "reset_token_expires": None,
    }).eq("id", admin["id"]).execute()
    return {"message": "Password updated successfully"}
