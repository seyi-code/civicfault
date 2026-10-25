"""Cron-friendly endpoints protected by CRON_SECRET."""
from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.organization import Organization
from app.models.fault import FaultReport
from app.services.notify import send_whatsapp_or_sms
from app.services.sla import is_overdue

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cron", tags=["cron"])


def _check_cron(x_cron_secret: str | None = Header(None)):
    expected = (settings.cron_secret or "").strip()
    if not expected:
        raise HTTPException(503, "CRON_SECRET not configured on server")
    if not x_cron_secret or x_cron_secret != expected:
        raise HTTPException(401, "Invalid cron secret")
    return True


@router.post("/digests")
async def run_weekly_digests(
    db: Session = Depends(get_db),
    _: bool = Depends(_check_cron),
):
    """Send digest to every org with notify_enabled + notify_phone.

    Schedule (example cron-job.org or Railway cron):
      POST https://civicfault-api.up.railway.app/api/v1/cron/digests
      Header: X-Cron-Secret: <your secret>
      Suggested: 0 6 * * 1  (Mondays 06:00 UTC)
    """
    orgs = (
        db.query(Organization)
        .filter(
            Organization.is_active == True,  # noqa: E712
            Organization.notify_enabled == True,  # noqa: E712
            Organization.notify_phone.isnot(None),
        )
        .all()
    )
    results = []
    for org in orgs:
        recent = (
            db.query(FaultReport)
            .filter(FaultReport.organization_id == org.id)
            .order_by(FaultReport.created_at.desc())
            .limit(15)
            .all()
        )
        if not recent:
            results.append({"org": org.slug, "skipped": "no reports"})
            continue
        lines = [
            f"{org.brand_name or org.name} weekly digest",
            f"{len(recent)} recent report(s):",
        ]
        for r in recent[:10]:
            flag = " OVERDUE" if is_overdue(r.created_at, r.status, org.sla_hours, r.resolved_at) else ""
            lines.append(f"- #{r.id} {r.category} [{r.status}]{flag}")
        lines.append(f"https://civicfault.vercel.app/dashboard?org={org.slug}")
        msg = "\n".join(lines)
        try:
            await send_whatsapp_or_sms(org.notify_phone, msg)
            results.append({"org": org.slug, "sent": True, "to": org.notify_phone})
        except Exception as exc:
            logger.exception("Digest failed for %s", org.slug)
            results.append({"org": org.slug, "sent": False, "error": str(exc)[:200]})
    return {"ran_at": datetime.utcnow().isoformat(), "orgs": len(orgs), "results": results}
