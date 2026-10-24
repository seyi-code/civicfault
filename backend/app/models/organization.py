from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float
from app.db.base import Base


class Organization(Base):
    """Estate, utility, or municipal workspace."""

    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    slug = Column(String(80), unique=True, nullable=False, index=True)
    # community (public) | private (org-only)
    visibility = Column(String(20), default="private", nullable=False)
    plan = Column(String(30), default="free", nullable=False)
    plan_expires_at = Column(DateTime, nullable=True)

    # SLA: hours before open reports are overdue
    sla_hours = Column(Integer, default=72, nullable=False)

    # WhatsApp / SMS digest
    notify_phone = Column(String(32), nullable=True)
    notify_enabled = Column(Boolean, default=False)
    digest_hour_utc = Column(Integer, default=6)  # send around this UTC hour

    # White-label
    custom_domain = Column(String(255), nullable=True, unique=True)
    logo_url = Column(String(500), nullable=True)
    primary_color = Column(String(20), default="#f59e0b")
    brand_name = Column(String(120), nullable=True)

    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
