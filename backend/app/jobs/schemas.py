from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


class JobCreate(BaseModel):
    title: str
    slug: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    type: Optional[str] = None
    commitment: Optional[str] = None
    status: Optional[str] = "open"
    expires_at: Optional[datetime] = None


class JobUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    type: Optional[str] = None
    commitment: Optional[str] = None
    status: Optional[str] = None
    expires_at: Optional[datetime] = None


class JobResponse(BaseModel):
    id: str
    title: str
    slug: str
    description: Optional[str] = None
    requirements: Optional[str] = None
    type: Optional[str] = None
    commitment: Optional[str] = None
    status: str
    expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class JobApplication(BaseModel):
    name: str
    email: EmailStr
    resume_text: str
    cover_letter: Optional[str] = None
