from datetime import datetime, timedelta, timezone
import hashlib
import secrets

import bcrypt
import jwt

from app.config import get_settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


# checked against when the email isn't registered, so a wrong email takes as
# long to refuse as a wrong password and the timing gives nothing away
_DUMMY_HASH = bcrypt.hashpw(b"not-a-real-password", bcrypt.gensalt()).decode()


def burn_password_check(password: str):
    verify_password(password, _DUMMY_HASH)


def token_digest(token: str) -> str:
    # refresh and reset tokens are stored as digests, so a copy of the
    # database can't be used to sign in
    return hashlib.sha256((token or "").encode()).hexdigest()


def create_access_token(admin_id: str, email: str, role: str = "admin") -> str:
    settings = get_settings()
    payload = {
        "sub": admin_id,
        "email": email,
        "role": role,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token() -> tuple[str, datetime]:
    settings = get_settings()
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    return token, expires_at


def create_reset_token() -> tuple[str, datetime]:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    return token, expires_at


def decode_access_token(token: str) -> dict:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
