import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field

from app.database import get_supabase
from app.auth.service import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    create_reset_token,
    burn_password_check,
    token_digest,
)
from app.security import limiter, failed_logins

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SetupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1, max_length=200)


def _token_rows(db, token: str):
    # tokens issued before digests were stored still match on their plain
    # value until they expire
    return db.table("refresh_tokens").select("*, admins(*)").in_("token", [token_digest(token), token])


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/setup", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
def setup(body: SetupRequest, request: Request):
    db = get_supabase()
    existing = db.table("admins").select("id").limit(1).execute()
    if existing.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Setup already complete")

    password_hash = hash_password(body.password)
    record = {
        "email": body.email,
        "password_hash": password_hash,
        "name": "Admin",
        "role": "owner",
    }
    try:
        db.table("admins").insert(record).execute()
    except Exception:
        # a database that predates roles has no column to write
        record.pop("role")
        db.table("admins").insert(record).execute()
    return {"message": "Admin created"}


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(body: LoginRequest, request: Request):
    if failed_logins.blocked(body.email):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again in 15 minutes.")

    db = get_supabase()

    result = db.table("admins").select("*").eq("email", body.email).execute()
    if not result.data:
        burn_password_check(body.password)
        failed_logins.fail(body.email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    admin = result.data[0]
    if not verify_password(body.password, admin.get("password_hash") or ""):
        failed_logins.fail(body.email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    failed_logins.clear(body.email)

    access_token = create_access_token(admin["id"], admin["email"], admin.get("role") or "owner")
    refresh_token, expires_at = create_refresh_token()

    db.table("refresh_tokens").insert({
        "admin_id": admin["id"],
        "token": token_digest(refresh_token),
        "expires_at": expires_at.isoformat(),
        "revoked": False,
    }).execute()

    try:
        db.table("admins").update({
            "last_login_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", admin["id"]).execute()
    except Exception as e:
        logger.warning("Failed to update last_login_at for %s: %s", admin["email"], e)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=AccessTokenResponse)
@limiter.limit("30/minute")
def refresh(body: RefreshRequest, request: Request):
    db = get_supabase()

    result = _token_rows(db, body.refresh_token).eq("revoked", False).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    record = result.data[0]
    from datetime import datetime, timezone

    if datetime.fromisoformat(record["expires_at"]) < datetime.now(timezone.utc):
        db.table("refresh_tokens").update({"revoked": True}).eq("id", record["id"]).execute()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    admin = record.get("admins")
    if not admin:
        # the account was removed after this token was issued
        db.table("refresh_tokens").update({"revoked": True}).eq("id", record["id"]).execute()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    access_token = create_access_token(admin["id"], admin["email"], admin.get("role") or "owner")
    return AccessTokenResponse(access_token=access_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("30/minute")
def logout(body: RefreshRequest, request: Request):
    db = get_supabase()
    db.table("refresh_tokens").update({"revoked": True}).in_(
        "token", [token_digest(body.refresh_token), body.refresh_token]
    ).execute()


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=1, max_length=200)
    new_password: str = Field(..., min_length=8, max_length=128)


# The emails_enabled setting is deliberately not consulted here. It governs
# visitor notifications, and an admin locked out of the panel still needs a
# way back in. Every other send in the codebase checks it. This one must not.
@router.post("/forgot-password")
@limiter.limit("3/hour")
def forgot_password(body: ForgotPasswordRequest, request: Request):
    db = get_supabase()
    result = db.table("admins").select("id, email").eq("email", body.email).execute()
    if result.data:
        admin = result.data[0]
        token, expires_at = create_reset_token()
        db.table("admins").update({
            "reset_token": token_digest(token),
            "reset_token_expires": expires_at.isoformat(),
        }).eq("id", admin["id"]).execute()

        reset_link = f"https://avennex.com/admin/index.html?reset={token}"
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
                logger.warning("Password reset email for %s was not delivered", admin["email"])
        except Exception as e:
            logger.error("Password reset email failed for %s: %s", admin["email"], e)

    return {"success": True, "message": "If this email is registered, you'll receive a reset link shortly."}


@router.post("/reset-password")
@limiter.limit("10/hour")
def reset_password(body: ResetPasswordRequest, request: Request):
    db = get_supabase()
    result = (
        db.table("admins")
        .select("id, reset_token, reset_token_expires")
        .in_("reset_token", [token_digest(body.token), body.token])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    admin = result.data[0]
    expires = admin.get("reset_token_expires")
    if not expires or datetime.fromisoformat(expires) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    password_hash = hash_password(body.new_password)
    db.table("admins").update({
        "password_hash": password_hash,
        "reset_token": None,
        "reset_token_expires": None,
    }).eq("id", admin["id"]).execute()

    db.table("refresh_tokens").update({"revoked": True}).eq("admin_id", admin["id"]).eq("revoked", False).execute()

    return {"message": "Password updated successfully"}
