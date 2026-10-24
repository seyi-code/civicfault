from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from app.db.base import Base


class AuthorityUser(Base):
    __tablename__ = "authority_users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(200), nullable=True)
    organization = Column(String(200), nullable=True)  # legacy display name
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    # authority | admin | manager
    role = Column(String(30), default="authority")
    is_active = Column(Boolean, default=True)
    plan = Column(String(30), default="free", nullable=False)
    plan_expires_at = Column(DateTime, nullable=True)
    paystack_customer_code = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
