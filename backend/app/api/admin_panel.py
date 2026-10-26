"""Platform-admin only: list/search/edit staff and organizations."""

from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.core.security import get_current_authority
from app.db.session import get_db
from app.models.user import AuthorityUser
from app.models.organization import Organization

router = APIRouter(prefix="/admin", tags=["platform-admin"])


def _require_platform_admin(user: AuthorityUser) -> None:
    if user.role != "admin":
        raise HTTPException(403, "Platform admin only")


# —— Staff (authority users) ——


class StaffOut(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None
    role: str
    organization_id: Optional[int] = None
    organization_name: Optional[str] = None
    organization_slug: Optional[str] = None
    plan: str = "free"
    is_active: bool = True


class StaffPatch(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = Field(None, pattern=r"^(authority|manager|admin)$")
    organization_id: Optional[int] = None
    clear_organization: Optional[bool] = None
    is_active: Optional[bool] = None
    plan: Optional[str] = Field(None, pattern=r"^(free|authority|enterprise)$")


@router.get("/staff", response_model=List[StaffOut])
def list_staff(
    q: Optional[str] = Query(None, description="Search email or name"),
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
    _require_platform_admin(user)
    query = db.query(AuthorityUser)
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(
            (AuthorityUser.email.ilike(like)) | (AuthorityUser.full_name.ilike(like))
        )
    rows = query.order_by(AuthorityUser.created_at.desc()).limit(300).all()
    out: List[StaffOut] = []
    for u in rows:
        org_name = org_slug = None
        if u.organization_id:
            org = db.query(Organization).filter(Organization.id == u.organization_id).first()
            if org:
                org_name, org_slug = org.name, org.slug
        out.append(
            StaffOut(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=u.role or "authority",
                organization_id=u.organization_id,
                organization_name=org_name or u.organization,
                organization_slug=org_slug,
                plan=u.plan or "free",
                is_active=bool(u.is_active),
            )
        )
    return out


@router.patch("/staff/{staff_id}", response_model=StaffOut)
def patch_staff(
    staff_id: int,
    body: StaffPatch,
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
    _require_platform_admin(user)
    target = db.query(AuthorityUser).filter(AuthorityUser.id == staff_id).first()
    if not target:
        raise HTTPException(404, "Staff not found")

    # Protect last platform admin
    if target.role == "admin" and (
        (body.role is not None and body.role != "admin") or body.is_active is False
    ):
        other = (
            db.query(AuthorityUser)
            .filter(
                AuthorityUser.role == "admin",
                AuthorityUser.id != target.id,
                AuthorityUser.is_active == True,  # noqa: E712
            )
            .count()
        )
        if other == 0:
            raise HTTPException(400, "Cannot demote or deactivate the only platform admin")

    if body.full_name is not None:
        target.full_name = body.full_name.strip() or None
    if body.role is not None:
        target.role = body.role
    if body.clear_organization:
        target.organization_id = None
    elif body.organization_id is not None:
        org = db.query(Organization).filter(Organization.id == body.organization_id).first()
        if not org:
            raise HTTPException(400, "Organization not found")
        target.organization_id = org.id
        target.organization = org.name
    if body.is_active is not None:
        target.is_active = body.is_active
    if body.plan is not None and target.role != "admin":
        target.plan = body.plan

    db.add(target)
    db.commit()
    db.refresh(target)

    org_name = org_slug = None
    if target.organization_id:
        org = db.query(Organization).filter(Organization.id == target.organization_id).first()
        if org:
            org_name, org_slug = org.name, org.slug
    return StaffOut(
        id=target.id,
        email=target.email,
        full_name=target.full_name,
        role=target.role or "authority",
        organization_id=target.organization_id,
        organization_name=org_name or target.organization,
        organization_slug=org_slug,
        plan=target.plan or "free",
        is_active=bool(target.is_active),
    )


@router.delete("/staff/{staff_id}", status_code=204)
def deactivate_staff(
    staff_id: int,
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
    """Soft-delete: deactivate account (no hard delete of staff rows)."""
    _require_platform_admin(user)
    target = db.query(AuthorityUser).filter(AuthorityUser.id == staff_id).first()
    if not target:
        raise HTTPException(404, "Staff not found")
    if target.id == user.id:
        raise HTTPException(400, "Cannot deactivate yourself")
    if target.role == "admin":
        other = (
            db.query(AuthorityUser)
            .filter(
                AuthorityUser.role == "admin",
                AuthorityUser.id != target.id,
                AuthorityUser.is_active == True,  # noqa: E712
            )
            .count()
        )
        if other == 0:
            raise HTTPException(400, "Cannot deactivate the only platform admin")
    target.is_active = False
    db.add(target)
    db.commit()
    return None


# —— Organizations ——


class OrgAdminOut(BaseModel):
    id: int
    name: str
    slug: str
    plan: str
    sla_hours: int
    visibility: str = "private"
    is_active: bool = True
    notify_phone: Optional[str] = None


class OrgAdminPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    plan: Optional[str] = Field(None, pattern=r"^(free|authority|enterprise)$")
    sla_hours: Optional[int] = Field(None, ge=1, le=720)
    visibility: Optional[str] = Field(None, pattern=r"^(private|community)$")
    notify_phone: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/organizations", response_model=List[OrgAdminOut])
def list_organizations(
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
    _require_platform_admin(user)
    query = db.query(Organization)
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(
            (Organization.name.ilike(like)) | (Organization.slug.ilike(like))
        )
    rows = query.order_by(Organization.created_at.desc()).limit(300).all()
    return [
        OrgAdminOut(
            id=o.id,
            name=o.name,
            slug=o.slug,
            plan=o.plan or "free",
            sla_hours=o.sla_hours or 72,
            visibility=o.visibility or "private",
            is_active=bool(getattr(o, "is_active", True)),
            notify_phone=o.notify_phone,
        )
        for o in rows
    ]


@router.patch("/organizations/{org_id}", response_model=OrgAdminOut)
def patch_organization(
    org_id: int,
    body: OrgAdminPatch,
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
    _require_platform_admin(user)
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(404, "Organization not found")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(org, k, v)
    db.add(org)
    db.commit()
    db.refresh(org)
    return OrgAdminOut(
        id=org.id,
        name=org.name,
        slug=org.slug,
        plan=org.plan or "free",
        sla_hours=org.sla_hours or 72,
        visibility=org.visibility or "private",
        is_active=bool(org.is_active),
        notify_phone=org.notify_phone,
    )


@router.delete("/organizations/{org_id}", status_code=204)
def deactivate_organization(
    org_id: int,
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
    """Soft-delete org: is_active=false. Reports kept; slug stays reserved."""
    _require_platform_admin(user)
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(404, "Organization not found")
    org.is_active = False
    db.add(org)
    db.commit()
    return None
