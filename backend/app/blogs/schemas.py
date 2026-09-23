from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class BlogCreate(BaseModel):
    title: str
    slug: Optional[str] = None
    content: Optional[str] = None
    excerpt: Optional[str] = None
    meta_description: Optional[str] = None
    cover_image: Optional[str] = None
    author: Optional[str] = None
    status: Optional[str] = "draft"
    publish_at: Optional[datetime] = None


class BlogUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    content: Optional[str] = None
    excerpt: Optional[str] = None
    meta_description: Optional[str] = None
    cover_image: Optional[str] = None
    author: Optional[str] = None
    status: Optional[str] = None
    publish_at: Optional[datetime] = None


class BlogResponse(BaseModel):
    id: str
    title: str
    slug: str
    content: Optional[str] = None
    excerpt: Optional[str] = None
    meta_description: Optional[str] = None
    cover_image: Optional[str] = None
    author: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime] = None
    publish_at: Optional[datetime] = None
    last_edited_by: Optional[str] = None
    last_edited_at: Optional[datetime] = None
