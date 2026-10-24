from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional


class AuthorityRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None
    organization: Optional[str] = None


class AuthorityLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    plan: str = "free"


class AuthorityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: Optional[str] = None
    organization: Optional[str] = None
    role: str
    plan: str = "free"
    plan_expires_at: Optional[datetime] = None
