from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import get_current_user
from app.academy import service
from app.academy.schemas import (
    PlaylistCreate, PlaylistUpdate,
    VideoCreate, VideoUpdate,
)
from app.admin.service import log_activity

router = APIRouter(prefix="/api/academy", tags=["academy"])


@router.get("/playlists")
def list_playlists():
    return service.list_playlists()


@router.get("/playlists/admin/all")
def list_playlists_admin(_user: dict = Depends(get_current_user)):
    return service.list_playlists_admin()


@router.get("/playlists/{slug}")
def get_playlist(slug: str):
    playlist = service.get_playlist_by_slug(slug)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return playlist


@router.post("/playlists", status_code=status.HTTP_201_CREATED)
def create_playlist(body: PlaylistCreate, _user: dict = Depends(get_current_user)):
    result = service.create_playlist(body.model_dump(exclude_none=True))
    log_activity(_user["email"], "create", "playlist", result["id"], result["title"])
    return result


@router.put("/playlists/{id}")
def update_playlist(id: str, body: PlaylistUpdate, _user: dict = Depends(get_current_user)):
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = service.update_playlist(id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Playlist not found")
    log_activity(_user["email"], "update", "playlist", result["id"], result["title"])
    return result


@router.delete("/playlists/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_playlist(id: str, _user: dict = Depends(get_current_user)):
    playlist = service.get_playlist_by_id(id)
    if not service.delete_playlist(id):
        raise HTTPException(status_code=404, detail="Playlist not found")
    log_activity(_user["email"], "delete", "playlist", id, playlist["title"] if playlist else id)


@router.post("/videos", status_code=status.HTTP_201_CREATED)
def create_video(body: VideoCreate, _user: dict = Depends(get_current_user)):
    result = service.create_video(body.model_dump(exclude_none=True))
    log_activity(_user["email"], "create", "video", result["id"], result["title"])
    return result


@router.put("/videos/{id}")
def update_video(id: str, body: VideoUpdate, _user: dict = Depends(get_current_user)):
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = service.update_video(id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Video not found")
    log_activity(_user["email"], "update", "video", result["id"], result["title"])
    return result


@router.delete("/videos/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_video(id: str, _user: dict = Depends(get_current_user)):
    video = service.get_video_by_id(id)
    if not service.delete_video(id):
        raise HTTPException(status_code=404, detail="Video not found")
    log_activity(_user["email"], "delete", "video", id, video["title"] if video else id)
