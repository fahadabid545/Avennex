from pydantic import BaseModel, Field
from typing import Optional


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=1000)
    session_id: Optional[str] = None


class ChunkSource(BaseModel):
    document: str
    chunk_preview: str


class ChatResponse(BaseModel):
    response: str
    session_token: str
    sources: list[ChunkSource] = []


class DocumentResponse(BaseModel):
    id: str
    filename: str
    file_type: str
    chunk_count: int
    status: str
    created_at: str


class BackupStatusResponse(BaseModel):
    exists: bool
    size: Optional[int] = None
    last_updated: Optional[str] = None
