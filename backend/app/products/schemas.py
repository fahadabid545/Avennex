from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Any


class ProductCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    tagline: Optional[str] = None
    description: Optional[str] = None
    features: Optional[Any] = None
    progress: Optional[int] = 0
    status: Optional[str] = "in-development"
    display_order: Optional[int] = 0


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    tagline: Optional[str] = None
    description: Optional[str] = None
    features: Optional[Any] = None
    progress: Optional[int] = None
    status: Optional[str] = None
    display_order: Optional[int] = None


class ProductResponse(BaseModel):
    id: str
    name: str
    slug: str
    tagline: Optional[str] = None
    description: Optional[str] = None
    features: Optional[Any] = None
    progress: int
    status: str
    display_order: int
    created_at: datetime
    updated_at: datetime
