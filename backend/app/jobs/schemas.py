import re

from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from typing import Optional

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def _validate_slug(v: Optional[str]) -> Optional[str]:
    if v is not None and not SLUG_RE.fullmatch(v):
        raise ValueError("Slug must contain only lowercase letters, numbers, and hyphens")
    return v


class JobCreate(BaseModel):
    title: str
    slug: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    good_to_have: Optional[str] = None
    type: Optional[str] = None
    commitment: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = "open"
    expires_at: Optional[datetime] = None
    custom_questions: Optional[list[str]] = None
    max_applications: Optional[int] = None

    _validate_slug = field_validator("slug")(_validate_slug)


class JobUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    good_to_have: Optional[str] = None
    type: Optional[str] = None
    commitment: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    expires_at: Optional[datetime] = None
    custom_questions: Optional[list[str]] = None
    max_applications: Optional[int] = None
    created_at: Optional[datetime] = None

    _validate_slug = field_validator("slug")(_validate_slug)


class JobResponse(BaseModel):
    id: str
    title: str
    slug: str
    description: Optional[str] = None
    requirements: Optional[str] = None
    good_to_have: Optional[str] = None
    type: Optional[str] = None
    commitment: Optional[str] = None
    location: Optional[str] = None
    status: str
    expires_at: Optional[datetime] = None
    custom_questions: Optional[list[str]] = None
    max_applications: Optional[int] = None
    application_count: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    last_edited_by: Optional[str] = None
    last_edited_at: Optional[datetime] = None


class JobApplication(BaseModel):
    name: str
    email: EmailStr
    resume_text: str
    cover_letter: Optional[str] = None
    custom_answers: Optional[dict] = None
