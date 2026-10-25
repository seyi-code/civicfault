from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from app.db.base import Base


class ResidentUser(Base):
    """Community reporter account (not staff)."""

    __tablename__ = "resident_users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(200), nullable=True)
    phone = Column(String(40), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class WorkspaceFollow(Base):
    """Resident follows an estate/workspace for personalized feed later."""

    __tablename__ = "workspace_follows"
    __table_args__ = (UniqueConstraint("resident_id", "organization_id", name="uq_resident_org_follow"),)

    id = Column(Integer, primary_key=True)
    resident_id = Column(Integer, ForeignKey("resident_users.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
