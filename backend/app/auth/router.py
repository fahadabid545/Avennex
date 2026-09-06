import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

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
limiter = Limiter(key_func=get_remote_address)


class SetupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)


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
@limiter.limit("5/minute")
def login(body: LoginRequest, request: Request):
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

    try:
        db.table("admins").update({
            "last_login_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", admin["id"]).execute()
    except Exception as e:
        logger.warning("Failed to update last_login_at for %s: %s", admin["email"], e)

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
    new_password: str = Field(..., min_length=8)


@router.post("/forgot-password")
@limiter.limit("3/hour")
def forgot_password(body: ForgotPasswordRequest, request: Request):
    db = get_supabase()
    result = db.table("admins").select("id, email").eq("email", body.email).execute()
    if result.data:
        admin = result.data[0]
        token, expires_at = create_reset_token()
        db.table("admins").update({
            "reset_token": token,
            "reset_token_expires": expires_at.isoformat(),
        }).eq("id", admin["id"]).execute()

        reset_link = f"https://avennex.com/admin/?reset={token}"
        try:
            from app.email.service import send_email
            html = f"""
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
              <h2 style="margin-bottom: 16px;">Password Reset</h2>
              <p>You requested a password reset for your Avennex admin account.</p>
              <p style="margin: 24px 0;">
                <a href="{reset_link}"
                   style="display: inline-block; padding: 12px 24px; background: #3b82f6;
                          color: #fff; text-decoration: none; border-radius: 6px;">
                  Reset Password
                </a>
              </p>
              <p style="color: #666; font-size: 14px;">This link expires in 1 hour.</p>
              <p style="color: #666; font-size: 14px;">If you didn't request this, ignore this email.</p>
            </div>
            """
            sent = send_email(admin["email"], "Reset your Avennex admin password", html)
            if not sent:
                logger.warning("Password reset for %s, email not configured. Token: %s", admin["email"], token)
        except Exception as e:
            logger.error("Password reset email failed for %s: %s. Token: %s", admin["email"], e, token)

    return {"success": True, "message": "If this email is registered, you'll receive a reset link shortly."}


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

    db.table("refresh_tokens").update({"revoked": True}).eq("admin_id", admin["id"]).eq("revoked", False).execute()

    return {"message": "Password updated successfully"}
