from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class BlogCreate(BaseModel):
    title: str
    slug: Optional[str] = None
    content: Optional[str] = None
    excerpt: Optional[str] = None
    meta_description: Optional[str] = None
    status: Optional[str] = "draft"


class BlogUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    content: Optional[str] = None
    excerpt: Optional[str] = None
    meta_description: Optional[str] = None
    status: Optional[str] = None


class BlogResponse(BaseModel):
    id: str
    title: str
    slug: str
    content: Optional[str] = None
    excerpt: Optional[str] = None
    meta_description: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime] = None
