from typing import Optional, List
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.resident import ResidentUser
from app.models.fault import FaultReport
from app.core.security import hash_password, verify_password, create_access_token
from app.core.security import get_current_resident
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


@router.post("/me/claim/{report_id}", response_model=FaultReportResponse)
def claim_report(
    report_id: int,
    db: Session = Depends(get_db),
    user: ResidentUser = Depends(get_current_resident),
):
    """Attach a recently filed guest report to this resident (within 15 minutes, unowned)."""
    report = db.query(FaultReport).filter(FaultReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Report not found")
    if report.reporter_id and report.reporter_id != user.id:
        raise HTTPException(403, "Report already belongs to another account")
    if report.reporter_id == user.id:
        return _row_to_response(report, db)
    # Only claim fresh reports to limit abuse
    if report.created_at and report.created_at < datetime.utcnow() - timedelta(minutes=15):
        raise HTTPException(400, "Report too old to claim — file again while signed in")
    report.reporter_id = user.id
    report.updated_at = datetime.utcnow()
    db.add(report)
    db.commit()
    db.refresh(report)
    return _row_to_response(report, db)
