from pydantic import BaseModel, EmailStr, Field
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

class AuthorityOut(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None
    organization: Optional[str] = None
    role: str
    class Config:
        from_attributes = True
