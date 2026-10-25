from typing import Optional, List
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.resident import ResidentUser, WorkspaceFollow
from app.models.fault import FaultReport
from app.models.organization import Organization
from app.core.security import hash_password, verify_password, create_access_token
from app.core.security import get_current_resident, get_current_authority
from app.schemas.fault import FaultReportResponse
from app.api.reports import _row_to_response
from app.models.user import AuthorityUser

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
    is_active: bool = True

    class Config:
        from_attributes = True


class ResidentToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str = "resident"


class ResidentProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = Field(None, min_length=8)


class FollowBody(BaseModel):
    org_slug: str


class FollowOut(BaseModel):
    organization_id: int
    slug: str
    name: str


@router.post("/register", response_model=ResidentOut, status_code=201)
def register(body: ResidentRegister, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    if db.query(ResidentUser).filter(ResidentUser.email == email).first():
        raise HTTPException(400, "Email already registered")
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


@router.patch("/me", response_model=ResidentOut)
def update_profile(
    body: ResidentProfileUpdate,
    db: Session = Depends(get_db),
    user: ResidentUser = Depends(get_current_resident),
):
    if body.full_name is not None:
        user.full_name = body.full_name.strip() or None
    if body.phone is not None:
        user.phone = body.phone.strip() or None
    if body.new_password:
        if not body.current_password or not verify_password(
            body.current_password, user.hashed_password
        ):
            raise HTTPException(400, "current_password is required and must match")
        user.hashed_password = hash_password(body.new_password)
    db.add(user)
    db.commit()
    db.refresh(user)
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
    report = db.query(FaultReport).filter(FaultReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Report not found")
    if report.reporter_id and report.reporter_id != user.id:
        raise HTTPException(403, "Report already belongs to another account")
    if report.reporter_id == user.id:
        return _row_to_response(report, db)
    if report.created_at and report.created_at < datetime.utcnow() - timedelta(minutes=15):
        raise HTTPException(400, "Report too old to claim — file again while signed in")
    report.reporter_id = user.id
    report.updated_at = datetime.utcnow()
    db.add(report)
    db.commit()
    db.refresh(report)
    return _row_to_response(report, db)


@router.get("/me/follows", response_model=List[FollowOut])
def list_follows(
    db: Session = Depends(get_db),
    user: ResidentUser = Depends(get_current_resident),
):
    rows = (
        db.query(WorkspaceFollow, Organization)
        .join(Organization, Organization.id == WorkspaceFollow.organization_id)
        .filter(WorkspaceFollow.resident_id == user.id)
        .all()
    )
    return [
        FollowOut(organization_id=org.id, slug=org.slug, name=org.name)
        for _, org in rows
    ]


@router.post("/me/follows", response_model=FollowOut, status_code=201)
def follow_workspace(
    body: FollowBody,
    db: Session = Depends(get_db),
    user: ResidentUser = Depends(get_current_resident),
):
    slug = body.org_slug.lower().strip()
    org = db.query(Organization).filter(Organization.slug == slug).first()
    if not org:
        raise HTTPException(404, "Workspace not found")
    existing = (
        db.query(WorkspaceFollow)
        .filter(
            WorkspaceFollow.resident_id == user.id,
            WorkspaceFollow.organization_id == org.id,
        )
        .first()
    )
    if existing:
        return FollowOut(organization_id=org.id, slug=org.slug, name=org.name)
    db.add(WorkspaceFollow(resident_id=user.id, organization_id=org.id))
    db.commit()
    return FollowOut(organization_id=org.id, slug=org.slug, name=org.name)


@router.delete("/me/follows/{org_slug}", status_code=204)
def unfollow_workspace(
    org_slug: str,
    db: Session = Depends(get_db),
    user: ResidentUser = Depends(get_current_resident),
):
    org = db.query(Organization).filter(Organization.slug == org_slug.lower().strip()).first()
    if not org:
        raise HTTPException(404, "Workspace not found")
    db.query(WorkspaceFollow).filter(
        WorkspaceFollow.resident_id == user.id,
        WorkspaceFollow.organization_id == org.id,
    ).delete()
    db.commit()
    return None


# —— Platform admin: manage residents ——


@router.get("/admin", response_model=List[ResidentOut])
def admin_list_residents(
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    staff: AuthorityUser = Depends(get_current_authority),
):
    if staff.role != "admin":
        raise HTTPException(403, "Platform admin only")
    query = db.query(ResidentUser)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            (ResidentUser.email.ilike(like)) | (ResidentUser.full_name.ilike(like))
        )
    return query.order_by(ResidentUser.created_at.desc()).limit(200).all()


class ResidentAdminPatch(BaseModel):
    is_active: Optional[bool] = None


@router.patch("/admin/{resident_id}", response_model=ResidentOut)
def admin_patch_resident(
    resident_id: int,
    body: ResidentAdminPatch,
    db: Session = Depends(get_db),
    staff: AuthorityUser = Depends(get_current_authority),
):
    if staff.role != "admin":
        raise HTTPException(403, "Platform admin only")
    user = db.query(ResidentUser).filter(ResidentUser.id == resident_id).first()
    if not user:
        raise HTTPException(404, "Resident not found")
    if body.is_active is not None:
        user.is_active = body.is_active
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
