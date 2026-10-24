from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from app.db.base import Base


class AuthorityUser(Base):
    __tablename__ = "authority_users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(200), nullable=True)
    organization = Column(String(200), nullable=True)
    role = Column(String(30), default="authority")  # authority | admin
    is_active = Column(Boolean, default=True)
    # free | authority | enterprise
    plan = Column(String(30), default="free", nullable=False)
    plan_expires_at = Column(DateTime, nullable=True)
    paystack_customer_code = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
