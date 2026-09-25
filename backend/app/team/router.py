import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import get_current_user, require_manager
from app.team import service
from app.team.schemas import (
    TeamMemberCreate, TeamMemberUpdate, TeamMemberResponse, TeamMemberPublic,
)
from app.admin.service import log_activity

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/team", tags=["team"])

FULL = f"The team page holds {service.MAX_MEMBERS} people. Remove someone before adding another."


def _load():
    try:
        return service.list_all()
    except Exception as e:
        logger.error("Failed to load team members: %s", e)
        raise HTTPException(status_code=503, detail="The team list could not be loaded")


@router.get("", response_model=list[TeamMemberPublic])
def list_team():
    return _load()


@router.get("/admin/all", response_model=list[TeamMemberResponse])
def list_team_admin(_user: dict = Depends(get_current_user)):
    return _load()


@router.post("", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
def create_member(body: TeamMemberCreate, _user: dict = Depends(get_current_user)):
    try:
        if service.count() >= service.MAX_MEMBERS:
            raise HTTPException(status_code=400, detail=FULL)
        data = body.model_dump()
        if data["display_order"] is None:
            data["display_order"] = service.next_order()
        data["last_edited_by"] = _user["email"]
        data["last_edited_at"] = datetime.now(timezone.utc).isoformat()
        result = service.create(data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create team member: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save team member")
    if not result:
        raise HTTPException(status_code=500, detail="Failed to save team member")
    log_activity(_user["email"], "create", "team_member", result["id"], result["name"])
    return result


@router.put("/{id}", response_model=TeamMemberResponse)
def update_member(id: str, body: TeamMemberUpdate, _user: dict = Depends(get_current_user)):
    data = body.model_dump(exclude_unset=True)
    if data.get("name") is None:
        data.pop("name", None)
    if data.get("role") is None:
        data.pop("role", None)
    if data.get("display_order") is None:
        data.pop("display_order", None)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    data["last_edited_by"] = _user["email"]
    data["last_edited_at"] = datetime.now(timezone.utc).isoformat()
    try:
        result = service.update(id, data)
    except Exception as e:
        logger.error("Failed to update team member %s: %s", id, e)
        raise HTTPException(status_code=500, detail="Failed to update team member")
    if not result:
        raise HTTPException(status_code=404, detail="Team member not found")
    log_activity(_user["email"], "update", "team_member", result["id"], result["name"])
    return result


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_member(id: str, _user: dict = Depends(require_manager)):
    try:
        member = service.get_by_id(id)
        removed = service.delete(id)
    except Exception as e:
        logger.error("Failed to delete team member %s: %s", id, e)
        raise HTTPException(status_code=500, detail="Failed to delete team member")
    if not removed:
        raise HTTPException(status_code=404, detail="Team member not found")
    log_activity(_user["email"], "delete", "team_member", id, member["name"] if member else id)
