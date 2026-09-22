import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth.dependencies import get_current_user
from app.revisions import service
from app.admin.service import log_activity

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/revisions", tags=["revisions"])


def _current_row(entity_type: str, entity_id: str):
    table = service.ENTITY_TABLES.get(entity_type)
    if not table:
        return None
    try:
        from app.database import get_supabase
        result = get_supabase().table(table).select("*").eq("id", entity_id).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        logger.warning("Could not read %s %s for history: %s", entity_type, entity_id, e)
        return None


@router.get("/item/{revision_id}")
def read_revision(revision_id: str, _user: dict = Depends(get_current_user)):
    revision = service.get(revision_id)
    if not revision:
        raise HTTPException(status_code=404, detail="Revision not found")
    return {
        "id": revision["id"],
        "entity_type": revision["entity_type"],
        "entity_id": revision["entity_id"],
        "admin_email": revision.get("admin_email"),
        "created_at": revision.get("created_at"),
        "snapshot": revision.get("snapshot") or {},
    }


@router.post("/item/{revision_id}/restore")
def restore_revision(revision_id: str, _user: dict = Depends(get_current_user)):
    restored, error = service.restore(revision_id, _user["email"])
    if error:
        raise HTTPException(status_code=404 if "not" in error.lower() else 400, detail=error)
    revision = service.get(revision_id) or {}
    log_activity(
        _user["email"], "restore", revision.get("entity_type", "content"),
        restored.get("id", ""), service.title_of(restored),
    )
    return {"success": True, "data": restored}


@router.get("/{entity_type}/{entity_id}")
def list_revisions(entity_type: str, entity_id: str, _user: dict = Depends(get_current_user)):
    if entity_type not in service.ENTITY_TABLES:
        raise HTTPException(status_code=400, detail="Unknown content type")
    try:
        current = _current_row(entity_type, entity_id)
        return {"success": True, "data": service.list_for(entity_type, entity_id, current)}
    except Exception as e:
        logger.error("History fetch failed for %s %s: %s", entity_type, entity_id, e)
        return {"success": False, "data": [], "warnings": ["History could not be loaded"]}
