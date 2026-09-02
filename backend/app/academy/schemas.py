from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class PlaylistCreate(BaseModel):
    title: str
    slug: Optional[str] = None
    description: Optional[str] = None
    display_order: Optional[int] = 0


class PlaylistUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    display_order: Optional[int] = None


class PlaylistResponse(BaseModel):
    id: str
    title: str
    slug: str
    description: Optional[str] = None
    display_order: int
    created_at: datetime
    updated_at: datetime


class VideoCreate(BaseModel):
    title: str
    description: Optional[str] = None
    youtube_url: str
    playlist_id: str
    display_order: Optional[int] = 0


class VideoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    youtube_url: Optional[str] = None
    playlist_id: Optional[str] = None
    display_order: Optional[int] = None


class VideoResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    youtube_url: str
    thumbnail_url: Optional[str] = None
    playlist_id: str
    display_order: int
    created_at: datetime
    updated_at: datetime
