from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.resident import ResidentUser
from app.models.fault import FaultReport
from app.core.security import hash_password, verify_password, create_access_token
from app.core.security import get_current_resident, get_current_resident_optional
from app.schemas.fault import FaultReportResponse
from app.api.reports import _row_to_response

router = APIRouter(prefix="/residents", tags=["residents"])


class ResidentRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None
    phone: Optional[str] = None


class ResidentLogin(BaseModel):
    email: EmailStr
    password: str


class ResidentOut(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None
    phone: Optional[str] = None

    class Config:
        from_attributes = True


class ResidentToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str = "resident"


@router.post("/register", response_model=ResidentOut, status_code=201)
def register(body: ResidentRegister, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    if db.query(ResidentUser).filter(ResidentUser.email == email).first():
        raise HTTPException(400, "Email already registered")
    # Also block if same email is a staff account (clarity)
    from app.models.user import AuthorityUser

    if db.query(AuthorityUser).filter(AuthorityUser.email == email).first():
        raise HTTPException(400, "Email already used for a staff account — use another email")

    user = ResidentUser(
        email=email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        phone=body.phone,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=ResidentToken)
def login(body: ResidentLogin, db: Session = Depends(get_db)):
    user = db.query(ResidentUser).filter(ResidentUser.email == body.email.lower().strip()).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(401, "Invalid email or password")
    if not user.is_active:
        raise HTTPException(403, "Account suspended")
    token = create_access_token(subject=f"resident:{user.email}", role="resident")
    return ResidentToken(access_token=token)


@router.get("/me", response_model=ResidentOut)
def me(user: ResidentUser = Depends(get_current_resident)):
    return user


@router.get("/me/reports", response_model=List[FaultReportResponse])
def my_reports(
    db: Session = Depends(get_db),
    user: ResidentUser = Depends(get_current_resident),
):
    rows = (
        db.query(FaultReport)
        .filter(FaultReport.reporter_id == user.id)
        .order_by(FaultReport.created_at.desc())
        .limit(100)
        .all()
    )
    return [_row_to_response(r, db) for r in rows]
