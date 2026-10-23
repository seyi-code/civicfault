from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.fault import ClusterSummary

router = APIRouter(prefix="/clusters", tags=["clusters"])


@router.get("", response_model=List[ClusterSummary])
def list_clusters(
    category: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    min_reports: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    filters = ["1=1"]
    params: dict = {"limit": limit, "min_reports": min_reports}

    if category:
        filters.append("category = :category")
        params["category"] = category
    if status_filter:
        filters.append("status = :status")
        params["status"] = status_filter

    where = " AND ".join(filters)

    sql = text(
        f"""
        SELECT
            COALESCE(cluster_id, id) AS cluster_id,
            mode() WITHIN GROUP (ORDER BY category) AS category,
            COUNT(*) AS report_count,
            mode() WITHIN GROUP (ORDER BY status) AS dominant_status,
            AVG(latitude) AS latitude,
            AVG(longitude) AS longitude,
            MIN(created_at) AS first_seen,
            MAX(created_at) AS last_seen,
            (ARRAY_AGG(image_url ORDER BY created_at ASC))[1] AS image_url,
            COALESCE(SUM(upvote_count), 0) AS total_upvotes
        FROM fault_reports
        WHERE {where}
        GROUP BY COALESCE(cluster_id, id)
        HAVING COUNT(*) >= :min_reports
        ORDER BY report_count DESC, last_seen DESC
        LIMIT :limit
        """
    )

    rows = db.execute(sql, params).fetchall()
    return [
        ClusterSummary(
            cluster_id=int(r.cluster_id),
            category=r.category or "other",
            report_count=int(r.report_count),
            dominant_status=r.dominant_status or "pending",
            latitude=float(r.latitude) if r.latitude is not None else 0.0,
            longitude=float(r.longitude) if r.longitude is not None else 0.0,
            first_seen=r.first_seen,
            last_seen=r.last_seen,
            image_url=r.image_url,
            total_upvotes=int(r.total_upvotes or 0),
        )
        for r in rows
    ]
