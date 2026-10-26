from datetime import datetime, timedelta
from typing import Optional, List
import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.core.security import get_current_authority, hash_password
from app.db.session import get_db
from app.models.organization import Organization
from app.models.user import AuthorityUser
from app.models.fault import FaultReport
from app.models.invite import OrgInvite
from app.models.resident import ResidentUser, WorkspaceFollow
from app.services.notify import send_whatsapp_or_sms
from app.services.sla import is_overdue, hours_open

router = APIRouter(prefix="/orgs", tags=["organizations"])


class OrgCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    slug: str = Field(..., min_length=2, max_length=80, pattern=r"^[a-z0-9-]+$")
    visibility: str = Field("private", pattern=r"^(private|community)$")
    sla_hours: int = Field(72, ge=1, le=720)
    notify_phone: Optional[str] = None
    brand_name: Optional[str] = None
    primary_color: Optional[str] = None
    custom_domain: Optional[str] = None


class OrgUpdate(BaseModel):
    name: Optional[str] = None
    visibility: Optional[str] = None
    sla_hours: Optional[int] = None
    notify_phone: Optional[str] = None
    notify_enabled: Optional[bool] = None
    brand_name: Optional[str] = None
    primary_color: Optional[str] = None
    logo_url: Optional[str] = None
    custom_domain: Optional[str] = None
    digest_hour_utc: Optional[int] = Field(None, ge=0, le=23)


class OrgOut(BaseModel):
    id: int
    name: str
    slug: str
    visibility: str
    plan: str
    sla_hours: int
    notify_phone: Optional[str] = None
    notify_enabled: bool = False
    brand_name: Optional[str] = None
    primary_color: Optional[str] = None
    logo_url: Optional[str] = None
    custom_domain: Optional[str] = None

    class Config:
        from_attributes = True


class InviteCreate(BaseModel):
    email: EmailStr
    role: str = Field("authority", pattern=r"^(authority|manager)$")


class InviteOut(BaseModel):
    id: int
    email: str
    role: str
    token: str
    expires_at: datetime
    accept_url: str


class InviteAccept(BaseModel):
    token: str
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None


class PlanOverride(BaseModel):
    plan: str = Field(..., pattern=r"^(free|authority|enterprise)$")
    days: int = Field(30, ge=1, le=3650)
    user_email: Optional[EmailStr] = None
    organization_id: Optional[int] = None


@router.post("", response_model=OrgOut, status_code=201)
def create_org(
    body: OrgCreate,
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
    """Create workspace.

    - Org staff (authority/manager): attached as org *manager* for that workspace.
    - Platform admin (role=admin): creates the org but is NOT attached — stays global.
      Never promote anyone to platform admin here.
    """
    if db.query(Organization).filter(Organization.slug == body.slug).first():
        raise HTTPException(400, "Slug already taken")
    if body.custom_domain and db.query(Organization).filter(
        Organization.custom_domain == body.custom_domain
    ).first():
        raise HTTPException(400, "Domain already in use")

    org = Organization(
        name=body.name,
        slug=body.slug,
        visibility=body.visibility,
        sla_hours=body.sla_hours,
        notify_phone=body.notify_phone,
        brand_name=body.brand_name or body.name,
        primary_color=body.primary_color or "#f59e0b",
        custom_domain=body.custom_domain,
        plan="free",
    )
    db.add(org)
    db.flush()

    is_platform_admin = user.role == "admin"
    if not is_platform_admin:
        # Org operator owns this workspace as manager (NOT platform admin)
        user.organization_id = org.id
        user.organization = org.name
        user.role = "manager"
        db.add(user)
    # Platform admin: leave organization_id untouched so navbar/isolation stay global

    db.commit()
    db.refresh(org)
    return org


@router.get("/me", response_model=Optional[OrgOut])
def my_org(
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
    if not user.organization_id:
        return None
    return db.query(Organization).filter(Organization.id == user.organization_id).first()


@router.get("/by-slug/{slug}", response_model=OrgOut)
def get_by_slug(slug: str, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.slug == slug, Organization.is_active == True).first()
    if not org:
        raise HTTPException(404, "Organization not found")
    return org


@router.get("/by-host")
def get_by_host(host: str, db: Session = Depends(get_db)):
    host = host.lower().split(":")[0]
    org = (
        db.query(Organization)
        .filter(Organization.custom_domain == host, Organization.is_active == True)
        .first()
    )
    if not org and host.endswith(".civicfault.app"):
        sub = host.replace(".civicfault.app", "")
        org = db.query(Organization).filter(Organization.slug == sub, Organization.is_active == True).first()
    if not org:
        return {
            "slug": "civicfault",
            "brand_name": "CivicFault",
            "primary_color": "#f59e0b",
            "logo_url": None,
            "visibility": "community",
        }
    return {
        "id": org.id,
        "slug": org.slug,
        "brand_name": org.brand_name or org.name,
        "primary_color": org.primary_color,
        "logo_url": org.logo_url,
        "visibility": org.visibility,
        "sla_hours": org.sla_hours,
    }


@router.patch("/me", response_model=OrgOut)
def update_my_org(
    body: OrgUpdate,
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
    if not user.organization_id:
        raise HTTPException(400, "Create an organization first")
    if user.role not in ("admin", "manager"):
        raise HTTPException(403, "Admin or manager role required")
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    if not org:
        raise HTTPException(404, "Organization not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(org, field, val)
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


def _reports_for_user(db: Session, user: AuthorityUser):
    if user.organization_id:
        return db.query(FaultReport).filter(FaultReport.organization_id == user.organization_id).all()
    if user.role == "admin":
        return db.query(FaultReport).filter(FaultReport.is_public == True).all()  # noqa: E712
    return []


@router.get("/me/stats")
def org_stats(
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
    org = None
    if user.organization_id:
        org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    reports = _reports_for_user(db, user)
    sla = org.sla_hours if org else 72
    open_r = [r for r in reports if r.status in ("pending", "confirmed", "in_progress")]
    overdue = [r for r in open_r if is_overdue(r.created_at, r.status, sla, r.resolved_at)]
    return {
        "total": len(reports),
        "open": len(open_r),
        "overdue": len(overdue),
        "resolved": sum(1 for r in reports if r.status == "resolved"),
        "sla_hours": sla,
        "scope": "organization" if user.organization_id else "public",
        "avg_open_hours": round(
            sum(hours_open(r.created_at, r.resolved_at) for r in open_r) / len(open_r), 1
        )
        if open_r
        else 0,
    }


@router.get("/me/followers")
def list_followers(
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
    """Residents following this workspace."""
    if not user.organization_id:
        raise HTTPException(400, "No workspace")
    rows = (
        db.query(WorkspaceFollow, ResidentUser)
        .join(ResidentUser, ResidentUser.id == WorkspaceFollow.resident_id)
        .filter(WorkspaceFollow.organization_id == user.organization_id)
        .all()
    )
    return [
        {
            "resident_id": r.id,
            "email": r.email,
            "full_name": r.full_name,
            "followed_at": f.created_at.isoformat() if f.created_at else None,
        }
        for f, r in rows
    ]


@router.post("/admin/set-plan")
def admin_set_plan(
    body: PlanOverride,
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
    if user.role != "admin":
        raise HTTPException(403, "Platform admin only")

    target = user
    if body.user_email:
        target = db.query(AuthorityUser).filter(AuthorityUser.email == body.user_email.lower()).first()
        if not target:
            raise HTTPException(404, "User not found")

    target.plan = body.plan
    target.plan_expires_at = datetime.utcnow() + timedelta(days=body.days)
    db.add(target)

    org_id = body.organization_id or target.organization_id
    if org_id:
        org = db.query(Organization).filter(Organization.id == org_id).first()
        if org:
            org.plan = body.plan
            org.plan_expires_at = target.plan_expires_at
            db.add(org)
    db.commit()
    return {
        "ok": True,
        "email": target.email,
        "plan": target.plan,
        "plan_expires_at": target.plan_expires_at,
    }


@router.get("/admin/list")
def admin_list_orgs(
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
    if user.role != "admin":
        raise HTTPException(403, "Platform admin only")
    orgs = db.query(Organization).order_by(Organization.created_at.desc()).limit(200).all()
    return [
        {
            "id": o.id,
            "name": o.name,
            "slug": o.slug,
            "plan": o.plan,
            "sla_hours": o.sla_hours,
            "is_active": getattr(o, "is_active", True),
        }
        for o in orgs
    ]


class StaffRoleFix(BaseModel):
    email: EmailStr
    role: str = Field(..., pattern=r"^(authority|manager|admin)$")
    clear_organization: bool = False
    organization_id: Optional[int] = None


@router.post("/admin/fix-user")
def admin_fix_user(
    body: StaffRoleFix,
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
    """Repair mis-assigned roles (e.g. org creator wrongly set to platform admin)."""
    if user.role != "admin":
        raise HTTPException(403, "Platform admin only")
    target = db.query(AuthorityUser).filter(AuthorityUser.email == body.email.lower()).first()
    if not target:
        raise HTTPException(404, "User not found")
    # Never demote the only platform admin accidentally without another admin
    if target.role == "admin" and body.role != "admin":
        other_admins = (
            db.query(AuthorityUser)
            .filter(AuthorityUser.role == "admin", AuthorityUser.id != target.id)
            .count()
        )
        if other_admins == 0 and target.email == user.email:
            raise HTTPException(400, "Cannot demote the only platform admin (yourself)")
    target.role = body.role
    if body.clear_organization:
        target.organization_id = None
    elif body.organization_id is not None:
        target.organization_id = body.organization_id
    db.add(target)
    db.commit()
    return {
        "ok": True,
        "email": target.email,
        "role": target.role,
        "organization_id": target.organization_id,
    }


@router.get("/me/members")
def list_members(
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
    if not user.organization_id:
        return []
    rows = db.query(AuthorityUser).filter(AuthorityUser.organization_id == user.organization_id).all()
    return [
        {"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role, "is_active": u.is_active}
        for u in rows
    ]


@router.post("/me/invites", response_model=InviteOut, status_code=201)
def create_invite(
    body: InviteCreate,
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
    if not user.organization_id:
        raise HTTPException(400, "Create a workspace first")
    if user.role not in ("admin", "manager"):
        raise HTTPException(403, "Only admin/manager can invite")

    email = body.email.lower()
    existing = db.query(AuthorityUser).filter(AuthorityUser.email == email).first()
    if existing and existing.organization_id == user.organization_id:
        raise HTTPException(400, "User already in this organization")

    token = secrets.token_urlsafe(24)
    invite = OrgInvite(
        organization_id=user.organization_id,
        email=email,
        role=body.role,
        token=token,
        invited_by_id=user.id,
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)

    accept_url = f"https://civicfault.vercel.app/authority/accept?token={token}"
    return InviteOut(
        id=invite.id,
        email=invite.email,
        role=invite.role,
        token=invite.token,
        expires_at=invite.expires_at,
        accept_url=accept_url,
    )


@router.post("/invites/accept")
def accept_invite(body: InviteAccept, db: Session = Depends(get_db)):
    invite = db.query(OrgInvite).filter(OrgInvite.token == body.token).first()
    if not invite or invite.accepted:
        raise HTTPException(400, "Invalid or already used invite")
    if invite.expires_at < datetime.utcnow():
        raise HTTPException(400, "Invite expired")

    user = db.query(AuthorityUser).filter(AuthorityUser.email == invite.email).first()
    if user:
        user.organization_id = invite.organization_id
        user.role = invite.role if invite.role != "admin" else "manager"
        user.hashed_password = hash_password(body.password)
        if body.full_name:
            user.full_name = body.full_name
        user.is_active = True
    else:
        org = db.query(Organization).filter(Organization.id == invite.organization_id).first()
        user = AuthorityUser(
            email=invite.email,
            hashed_password=hash_password(body.password),
            full_name=body.full_name,
            organization=org.name if org else None,
            organization_id=invite.organization_id,
            role=invite.role if invite.role != "admin" else "manager",
            plan="free",
        )
        db.add(user)

    invite.accepted = True
    db.add(invite)
    db.commit()
    return {"ok": True, "email": invite.email, "organization_id": invite.organization_id, "role": user.role}


@router.post("/me/digest")
async def send_digest_now(
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
    if not user.organization_id:
        raise HTTPException(400, "No organization")
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    if not org or not org.notify_phone:
        raise HTTPException(400, "Set notify_phone on organization first")

    recent = (
        db.query(FaultReport)
        .filter(FaultReport.organization_id == org.id)
        .order_by(FaultReport.created_at.desc())
        .limit(20)
        .all()
    )

    lines = [f"{org.brand_name or org.name} digest", f"{len(recent)} report(s):"]
    for r in recent[:10]:
        flag = " OVERDUE" if is_overdue(r.created_at, r.status, org.sla_hours, r.resolved_at) else ""
        lines.append(f"- #{r.id} {r.category} [{r.status}]{flag}")
    lines.append(f"https://civicfault.vercel.app/dashboard?org={org.slug}")
    msg = "\n".join(lines)

    try:
        result = await send_whatsapp_or_sms(org.notify_phone, msg)
    except Exception as exc:
        raise HTTPException(502, str(exc)) from exc
    return {"sent": True, "to": org.notify_phone, "preview": msg, "result": result}
