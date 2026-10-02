from pydantic import BaseModel, EmailStr, Field, field_validator

from app.security import clean_text, single_line
from typing import Optional


class ProductChatMessageCreate(BaseModel):
    author_name: str = Field(..., min_length=1, max_length=100)
    author_email: EmailStr
    message: str = Field(..., min_length=1, max_length=4000)

    @field_validator("author_name")
    @classmethod
    def _one_line(cls, v):
        return single_line(v)

    @field_validator("message")
    @classmethod
    def _text(cls, v):
        v = clean_text(v)
        if not v:
            raise ValueError("Message can't be empty")
        return v


class ProductChatReply(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)
