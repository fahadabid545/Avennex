from fastapi import APIRouter, Depends, HTTPException

from app.auth.dependencies import get_current_user
from app.settings import service
from app.settings.schemas import SettingUpdate
from app.admin.service import log_activity

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/{key}")
def get_setting(key: str):
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
        raise HTTPException(status_code=500, detail=str(e))
