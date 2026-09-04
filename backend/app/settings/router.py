import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.auth.dependencies import get_current_user
from app.auth.service import decode_access_token
from app.settings import service
from app.settings.schemas import SettingUpdate
from app.admin.service import log_activity

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/settings", tags=["settings"])

PUBLIC_KEYS = {"chatbot_visible", "chat_show_details"}
_optional_bearer = HTTPBearer(auto_error=False)


@router.get("/{key}")
def get_setting(
    key: str,
    credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
):
    if key not in PUBLIC_KEYS:
        if not credentials:
            raise HTTPException(status_code=401, detail="Not authenticated")
        try:
            payload = decode_access_token(credentials.credentials)
            if payload.get("type") != "access":
                raise HTTPException(status_code=401, detail="Invalid token")
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid token")
    setting = service.get_setting(key)
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    return setting


@router.put("/{key}")
def update_setting(key: str, body: SettingUpdate, _user: dict = Depends(get_current_user)):
    try:
        result = service.upsert_setting(key, body.value)
        log_activity(_user["email"], "update", "setting", key, f"{key} = {body.value}")
        return {"success": True, "data": result}
    except Exception as e:
        logger.error("Setting update failed for %s: %s", key, e)
        raise HTTPException(status_code=500, detail="Failed to update setting")
