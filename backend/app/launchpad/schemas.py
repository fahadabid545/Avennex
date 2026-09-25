from pydantic import BaseModel, field_validator, EmailStr
from datetime import datetime
from app.report_data import validate_report
from app.uploads.documents import validate_list
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
    progress: Optional[int] = 0
    start_date: Optional[str] = None
    target_date: Optional[str] = None
    milestones: Optional[Any] = None
    metrics: Optional[Any] = None
    documents: Optional[Any] = None
    documents_heading: Optional[str] = None
    documents_body: Optional[str] = None
    report: Optional[Any] = None

    @field_validator("documents")
    @classmethod
    def _at_most_five(cls, v):
        return validate_list(v)

    @field_validator("report")
    @classmethod
    def _known_sections(cls, v):
        return validate_report(v)


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
    progress: Optional[int] = None
    start_date: Optional[str] = None
    target_date: Optional[str] = None
    milestones: Optional[Any] = None
    metrics: Optional[Any] = None
    documents: Optional[Any] = None
    documents_heading: Optional[str] = None
    documents_body: Optional[str] = None
    report: Optional[Any] = None

    @field_validator("documents")
    @classmethod
    def _at_most_five(cls, v):
        return validate_list(v)

    @field_validator("report")
    @classmethod
    def _known_sections(cls, v):
        return validate_report(v)


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
    progress: Optional[int] = 0
    start_date: Optional[str] = None
    target_date: Optional[str] = None
    milestones: Optional[Any] = []
    metrics: Optional[Any] = []
    progress_history: Optional[Any] = []
    created_at: datetime
    updated_at: datetime
    last_edited_by: Optional[str] = None
    last_edited_at: Optional[datetime] = None
    documents: Optional[Any] = []
    documents_heading: Optional[str] = None
    documents_body: Optional[str] = None
    report: Optional[Any] = None



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
