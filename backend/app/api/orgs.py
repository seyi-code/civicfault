from datetime import datetime, timedelta
from typing import Optional
import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.core.security import get_current_authority, hash_password, verify_password
from app.db.session import get_db
from app.models.organization import Organization
from app.models.user import AuthorityUser
from app.models.fault import FaultReport
from app.models.invite import OrgInvite
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
    role: str = Field("authority", pattern=r"^(authority|manager|admin)$")


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
    user_email: Optional[EmailStr] = None  # if set, upgrade that user; else self/org


@router.post("", response_model=OrgOut, status_code=201)
def create_org(
    body: OrgCreate,
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
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
        plan=user.plan if user.plan != "free" else "free",
    )
    db.add(org)
    db.flush()
    user.organization_id = org.id
    user.organization = org.name
    if user.role != "admin":
        user.role = "admin"
    db.add(user)
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
    """Same scope as workspace list: org reports if any, else all public."""
    if user.organization_id:
        return db.query(FaultReport).filter(FaultReport.organization_id == user.organization_id).all()
    return db.query(FaultReport).filter(FaultReport.is_public == True).all()  # noqa: E712


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


@router.post("/admin/set-plan")
def admin_set_plan(
    body: PlanOverride,
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
    """Platform admin (role=admin without needing payment) can grant plans.

    First registered user is admin. Use this for pilots, comps, and support.
    """
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
    if target.organization_id:
        org = db.query(Organization).filter(Organization.id == target.organization_id).first()
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
        user.role = invite.role
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
            role=invite.role,
            plan="free",
        )
        db.add(user)

    invite.accepted = True
    db.add(invite)
    db.commit()
    return {"ok": True, "email": invite.email, "organization_id": invite.organization_id, "role": invite.role}


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
    if not recent:
        recent = (
            db.query(FaultReport)
            .filter(FaultReport.is_public == True)  # noqa: E712
            .order_by(FaultReport.created_at.desc())
            .limit(5)
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
        raise HTTPException(502, str(exc)) from exp if False else exc
    return {"sent": True, "to": org.notify_phone, "preview": msg, "result": result}
