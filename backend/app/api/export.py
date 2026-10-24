import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.security import get_current_authority
from app.db.session import get_db
from app.models.fault import FaultReport
from app.models.user import AuthorityUser

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/reports.csv")
def export_reports_csv(
    status_filter: str | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
    # Soft gate: free plan can still export small sample; paid unlimited
    q = db.query(FaultReport).order_by(FaultReport.created_at.desc())
    if status_filter:
        q = q.filter(FaultReport.status == status_filter)

    is_paid = (user.plan or "free") != "free"
    if not is_paid:
        if user.plan_expires_at and user.plan_expires_at > datetime.utcnow():
            is_paid = True
    rows = q.limit(5000 if is_paid else 50).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "id",
            "category",
            "confidence",
            "status",
            "latitude",
            "longitude",
            "description",
            "upvote_count",
            "cluster_id",
            "image_url",
            "created_at",
            "updated_at",
            "resolved_at",
        ]
    )
    for r in rows:
        writer.writerow(
            [
                r.id,
                r.category,
                r.confidence,
                r.status,
                r.latitude,
                r.longitude,
                (r.description or "").replace("\n", " "),
                r.upvote_count,
                r.cluster_id,
                r.image_url,
                r.created_at.isoformat() if r.created_at else "",
                r.updated_at.isoformat() if r.updated_at else "",
                r.resolved_at.isoformat() if r.resolved_at else "",
            ]
        )

    buf.seek(0)
    filename = f"civicfault_reports_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
