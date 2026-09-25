import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

LINKEDIN = re.compile(r"^https://([a-z]{2,3}\.)?linkedin\.com/\S+$", re.I)


def _clean_url(v):
    if v is None:
        return None
    v = v.strip()
    return v or None


def _clean_linkedin(v):
    v = _clean_url(v)
    if v is None:
        return None
    if not re.match(r"^https?://", v, re.I):
        v = "https://" + v
    v = re.sub(r"^http://", "https://", v, flags=re.I)
    if not LINKEDIN.match(v):
        raise ValueError("LinkedIn link must be a linkedin.com address")
    return v


class TeamMemberCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    role: str = Field(default="", max_length=80)
    photo_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    display_order: Optional[int] = None

    _photo = field_validator("photo_url")(_clean_url)
    _linkedin = field_validator("linkedin_url")(_clean_linkedin)

    @field_validator("name", "role")
    @classmethod
    def _strip(cls, v):
        return v.strip()


class TeamMemberUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=60)
    role: Optional[str] = Field(default=None, max_length=80)
    photo_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    display_order: Optional[int] = None

    _photo = field_validator("photo_url")(_clean_url)
    _linkedin = field_validator("linkedin_url")(_clean_linkedin)

    @field_validator("name", "role")
    @classmethod
    def _strip(cls, v):
        return v.strip() if v is not None else v


class TeamMemberResponse(BaseModel):
    id: str
    name: str
    role: str
    photo_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    display_order: int
    created_at: datetime
    updated_at: datetime
    last_edited_by: Optional[str] = None
    last_edited_at: Optional[datetime] = None


class TeamMemberPublic(BaseModel):
    id: str
    name: str
    role: str
    photo_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    display_order: int
