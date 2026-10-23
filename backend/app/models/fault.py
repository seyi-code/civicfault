from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey, Index, Boolean
from geoalchemy2 import Geometry
from app.db.base import Base

class FaultReport(Base):
    __tablename__ = "fault_reports"
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(100), nullable=False, index=True)
    confidence = Column(Float, nullable=True)
    image_url = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="pending", index=True)
    location = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    cluster_id = Column(Integer, ForeignKey("fault_reports.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    severity = Column(String(20), nullable=True)
    reporter_hash = Column(String(64), nullable=True)
    upvote_count = Column(Integer, default=0, nullable=False)
    is_public = Column(Boolean, default=True, nullable=False)
    __table_args__ = (
        Index("idx_fault_reports_location", "location", postgresql_using="gist"),
        Index("idx_fault_reports_category_status", "category", "status"),
    )

class ReportUpvote(Base):
    __tablename__ = "report_upvotes"
    id = Column(Integer, primary_key=True)
    report_id = Column(Integer, ForeignKey("fault_reports.id", ondelete="CASCADE"), nullable=False, index=True)
    voter_hash = Column(String(64), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (Index("uq_report_voter", "report_id", "voter_hash", unique=True),)
