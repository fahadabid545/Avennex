from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

from app.auth.service import decode_access_token

bearer_scheme = HTTPBearer()

ROLES = ("owner", "admin", "editor")
DEFAULT_ROLE = "admin"


def _role_from_db(admin_id: str) -> str:
    # tokens issued before roles existed carry no claim, and neither does a
    # database that has not had the migration run yet. both keep working as
    # before rather than locking the only account out of its own panel.
    try:
        from app.database import get_supabase
        result = get_supabase().table("admins").select("*").eq("id", admin_id).execute()
    except Exception:
        return "owner"
    if not result.data:
        return "owner"
    role = result.data[0].get("role")
    return role if role in ROLES else "owner"


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    role = payload.get("role")
    if role not in ROLES:
        role = _role_from_db(payload["sub"])

    return {"id": payload["sub"], "email": payload["email"], "role": role}


def require_role(*allowed: str):
    def dependency(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your role does not allow this",
            )
        return user
    return dependency


require_owner = require_role("owner")
require_manager = require_role("owner", "admin")
