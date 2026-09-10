import re

from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional

YOUTUBE_URL_RE = re.compile(
    r'(?:youtube\.com/(?:watch\?v=|embed/|shorts/)|youtu\.be/)[a-zA-Z0-9_-]{11}'
)


def _validate_youtube_url(v: Optional[str]) -> Optional[str]:
    if v is not None and not YOUTUBE_URL_RE.search(v):
        raise ValueError("Enter a valid YouTube URL")
    return v


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

    _validate_youtube_url = field_validator("youtube_url")(_validate_youtube_url)


class VideoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    youtube_url: Optional[str] = None
    playlist_id: Optional[str] = None
    display_order: Optional[int] = None

    _validate_youtube_url = field_validator("youtube_url")(_validate_youtube_url)


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
