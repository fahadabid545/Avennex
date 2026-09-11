from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Any, Optional


class LaunchpadCreate(BaseModel):
    title: str
    slug: Optional[str] = None
    tagline: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    timeline: Optional[str] = None
    funding_needed: Optional[str] = None
    team_needed: Optional[str] = None
    tech_stack: Optional[str] = None
    collaboration_details: Optional[str] = None
    diagrams: Optional[str] = None
    stage: Optional[str] = "concept"
    status: Optional[str] = "active"
    dashboard: Optional[Any] = None


class LaunchpadUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    tagline: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    timeline: Optional[str] = None
    funding_needed: Optional[str] = None
    team_needed: Optional[str] = None
    tech_stack: Optional[str] = None
    collaboration_details: Optional[str] = None
    diagrams: Optional[str] = None
    stage: Optional[str] = None
    status: Optional[str] = None
    dashboard: Optional[Any] = None


class LaunchpadResponse(BaseModel):
    id: str
    title: str
    slug: str
    tagline: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    timeline: Optional[str] = None
    funding_needed: Optional[str] = None
    team_needed: Optional[str] = None
    tech_stack: Optional[str] = None
    collaboration_details: Optional[str] = None
    diagrams: Optional[str] = None
    stage: str
    status: str
    dashboard: Optional[Any] = None
    created_at: datetime
    updated_at: datetime
    last_edited_by: Optional[str] = None
    last_edited_at: Optional[datetime] = None


class LaunchpadDetailResponse(LaunchpadResponse):
    comments: list = []


class CommentCreate(BaseModel):
    author_name: str
    author_email: EmailStr
    content: str


class CommentResponse(BaseModel):
    id: str
    entry_id: str
    author_name: str
    content: str
    created_at: datetime
