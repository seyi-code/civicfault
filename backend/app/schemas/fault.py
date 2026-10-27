from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class FaultReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    category: str
    confidence: Optional[float] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    status: str
    latitude: float
    longitude: float
    address_label: Optional[str] = None
    cluster_id: Optional[int] = None
    organization_id: Optional[int] = None
    reporter_id: Optional[int] = None
    severity: Optional[str] = None
    upvote_count: int = 0
    is_public: bool = True
    is_pinned: bool = False
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    hours_open: Optional[float] = None
    is_overdue: Optional[bool] = None
    sla_hours: Optional[int] = None


class FaultReportListResponse(BaseModel):
    items: List[FaultReportResponse]
    total: int
    page: int
    page_size: int
    pages: int


class StatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(pending|confirmed|in_progress|resolved|rejected)$")
    note: Optional[str] = None


class PinUpdate(BaseModel):
    is_pinned: bool


class ReportEdit(BaseModel):
    """Staff / platform admin field edits."""
    description: Optional[str] = Field(None, max_length=2000)
    category: Optional[str] = Field(
        None,
        pattern=(
            "^(pothole|water_leak|blocked_drain|downed_power_line|"
            "uncollected_waste|broken_streetlight|damaged_road_sign|other)$"
        ),
    )
    address_label: Optional[str] = Field(None, max_length=300)
    severity: Optional[str] = Field(None, pattern="^(low|medium|high|critical)$")
    status: Optional[str] = Field(
        None, pattern="^(pending|confirmed|in_progress|resolved|rejected)$"
    )


class UpvoteRequest(BaseModel):
    voter_hash: str = Field(..., min_length=8, max_length=64)


class ClusterSummary(BaseModel):
    cluster_id: int
    category: str
    report_count: int
    dominant_status: str
    latitude: float
    longitude: float
    first_seen: datetime
    last_seen: datetime
    image_url: Optional[str] = None
    total_upvotes: int = 0
