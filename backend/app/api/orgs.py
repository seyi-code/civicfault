from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.security import get_current_authority
from app.db.session import get_db
from app.models.organization import Organization
from app.models.user import AuthorityUser
from app.models.fault import FaultReport
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
        user.role = "admin"  # creator becomes org admin
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
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    return org


@router.get("/by-slug/{slug}", response_model=OrgOut)
def get_by_slug(slug: str, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.slug == slug, Organization.is_active == True).first()
    if not org:
        raise HTTPException(404, "Organization not found")
    return org


@router.get("/by-host")
def get_by_host(host: str, db: Session = Depends(get_db)):
    """White-label: resolve branding from Host header / domain."""
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


@router.get("/me/stats")
def org_stats(
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
    if not user.organization_id:
        raise HTTPException(400, "No organization")
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    q = db.query(FaultReport).filter(FaultReport.organization_id == user.organization_id)
    reports = q.all()
    open_r = [r for r in reports if r.status in ("pending", "confirmed", "in_progress")]
    overdue = [
        r
        for r in open_r
        if is_overdue(r.created_at, r.status, org.sla_hours if org else 72, r.resolved_at)
    ]
    return {
        "total": len(reports),
        "open": len(open_r),
        "overdue": len(overdue),
        "resolved": sum(1 for r in reports if r.status == "resolved"),
        "sla_hours": org.sla_hours if org else 72,
        "avg_open_hours": round(
            sum(hours_open(r.created_at, r.resolved_at) for r in open_r) / len(open_r), 1
        )
        if open_r
        else 0,
    }


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

    since = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    q = db.query(FaultReport).filter(FaultReport.organization_id == org.id)
    # If private org has no scoped reports yet, fall back to recent public for demo
    recent = (
        q.filter(FaultReport.created_at >= since)
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

    lines = [
        f"{org.brand_name or org.name} daily digest",
        f"{len(recent)} report(s):",
    ]
    for r in recent[:10]:
        overdue = is_overdue(r.created_at, r.status, org.sla_hours, r.resolved_at)
        flag = " OVERDUE" if overdue else ""
        lines.append(f"- #{r.id} {r.category} [{r.status}]{flag}")
    lines.append("https://civicfault.vercel.app/dashboard")
    msg = "\n".join(lines)

    try:
        result = await send_whatsapp_or_sms(org.notify_phone, msg)
    except Exception as exc:
        raise HTTPException(502, str(exc)) from exc
    return {"sent": True, "to": org.notify_phone, "preview": msg, "result": result}
