from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


class ChatMessageCreate(BaseModel):
    author_name: str
    author_email: EmailStr
    author_profession: Optional[str] = None
    author_company: Optional[str] = None
    message: str


class ChatReply(BaseModel):
    message: str


class ChatMessageUpdate(BaseModel):
    message: Optional[str] = None
