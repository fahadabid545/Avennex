from pydantic import BaseModel, EmailStr, Field, field_validator

from app.security import clean_text, single_line
from datetime import datetime
from typing import Optional


class ChatMessageCreate(BaseModel):
    author_name: str = Field(..., min_length=1, max_length=100)
    author_email: EmailStr
    author_profession: Optional[str] = Field(None, max_length=120)
    author_company: Optional[str] = Field(None, max_length=120)
    message: str = Field(..., min_length=1, max_length=4000)

    @field_validator("author_name", "author_profession", "author_company")
    @classmethod
    def _one_line(cls, v):
        return single_line(v) if v is not None else v

    @field_validator("message")
    @classmethod
    def _text(cls, v):
        v = clean_text(v)
        if not v:
            raise ValueError("Message can't be empty")
        return v


class ChatReply(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)


class ChatMessageUpdate(BaseModel):
    message: Optional[str] = None
