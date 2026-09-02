from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class FaqCreate(BaseModel):
    question: str
    answer: str
    display_order: Optional[int] = 0
    active: Optional[bool] = True


class FaqUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    display_order: Optional[int] = None
    active: Optional[bool] = None


class FaqResponse(BaseModel):
    id: str
    question: str
    answer: str
    display_order: int
    active: bool
    created_at: datetime
    updated_at: datetime
