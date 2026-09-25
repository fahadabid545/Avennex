from pydantic import BaseModel, field_validator
from datetime import datetime
from app.uploads.documents import validate_list
from typing import Optional, Any


class ProductCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    tagline: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    features: Optional[Any] = None
    progress: Optional[int] = 0
    status: Optional[str] = "in-development"
    display_order: Optional[int] = 0
    timeline: Optional[str] = None
    tech_stack: Optional[str] = None
    chat_enabled: Optional[bool] = False
    cover_image: Optional[str] = None
    video_url: Optional[str] = None
    gallery: Optional[Any] = None
    external_links: Optional[Any] = None
    documents: Optional[Any] = None
    metrics: Optional[Any] = None
    start_date: Optional[str] = None
    target_date: Optional[str] = None
    milestones: Optional[Any] = None
    documents_heading: Optional[str] = None
    documents_body: Optional[str] = None

    @field_validator("documents")
    @classmethod
    def _at_most_five(cls, v):
        return validate_list(v)


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    tagline: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    features: Optional[Any] = None
    progress: Optional[int] = None
    status: Optional[str] = None
    display_order: Optional[int] = None
    timeline: Optional[str] = None
    tech_stack: Optional[str] = None
    chat_enabled: Optional[bool] = None
    cover_image: Optional[str] = None
    video_url: Optional[str] = None
    gallery: Optional[Any] = None
    external_links: Optional[Any] = None
    documents: Optional[Any] = None
    metrics: Optional[Any] = None
    start_date: Optional[str] = None
    target_date: Optional[str] = None
    milestones: Optional[Any] = None
    documents_heading: Optional[str] = None
    documents_body: Optional[str] = None

    @field_validator("documents")
    @classmethod
    def _at_most_five(cls, v):
        return validate_list(v)


class ProductResponse(BaseModel):
    id: str
    name: str
    slug: str
    tagline: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    features: Optional[Any] = None
    progress: int
    status: str
    display_order: int
    created_at: datetime
    updated_at: datetime
    timeline: Optional[str] = None
    tech_stack: Optional[str] = None
    chat_enabled: Optional[bool] = False
    cover_image: Optional[str] = None
    last_edited_by: Optional[str] = None
    last_edited_at: Optional[datetime] = None
    video_url: Optional[str] = None
    gallery: Optional[Any] = []
    external_links: Optional[Any] = []
    documents: Optional[Any] = []
    metrics: Optional[Any] = []
    start_date: Optional[str] = None
    target_date: Optional[str] = None
    milestones: Optional[Any] = []
    progress_history: Optional[Any] = []
    documents_heading: Optional[str] = None
    documents_body: Optional[str] = None
