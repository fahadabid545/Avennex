from pydantic import BaseModel, EmailStr
from typing import Optional


class ProductChatMessageCreate(BaseModel):
    author_name: str
    author_email: EmailStr
    message: str


class ProductChatReply(BaseModel):
    message: str
