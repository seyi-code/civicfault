from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class CommentCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)
    author_label: Optional[str] = Field(None, max_length=120)
    author_hash: Optional[str] = Field(None, max_length=64)


class CommentOut(BaseModel):
    id: int
    report_id: int
    author_label: str
    is_staff: bool
    body: str
    created_at: datetime

    class Config:
        from_attributes = True


class CommentList(BaseModel):
    items: List[CommentOut]
    total: int
