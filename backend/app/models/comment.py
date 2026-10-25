from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Index
from app.db.base import Base


class ReportComment(Base):
    """Threaded discussion on a fault report (residents + staff)."""

    __tablename__ = "report_comments"

    id = Column(Integer, primary_key=True)
    report_id = Column(
        Integer, ForeignKey("fault_reports.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Resident messages use author_label + author_hash; staff use authority_user_id
    authority_user_id = Column(Integer, ForeignKey("authority_users.id"), nullable=True)
    author_label = Column(String(120), nullable=False, default="Resident")
    author_hash = Column(String(64), nullable=True, index=True)
    body = Column(Text, nullable=False)
    is_staff = Column(Boolean, default=False, nullable=False)
    is_hidden = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (Index("idx_comments_report_created", "report_id", "created_at"),)
