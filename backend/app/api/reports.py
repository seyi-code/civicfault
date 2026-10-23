from datetime import datetime
from math import ceil
from typing import Annotated, Optional
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from geoalchemy2 import WKTElement
from sqlalchemy import text
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.session import get_db
from app.models.fault import FaultReport, ReportUpvote
from app.schemas.fault import (
    FaultReportResponse,
    FaultReportListResponse,
    StatusUpdate,
    UpvoteRequest,
)
from app.services.ml import pipeline
from app.services.clustering import assign_cluster
from app.services.storage import save_upload
from app.core.security import get_current_authority
from app.core.config import settings
from app.models.user import AuthorityUser

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reports", tags=["reports"])
limiter = Limiter(key_func=get_remote_address)


def _row_to_response(db: Session, report: FaultReport) -> FaultReportResponse:
    try:
        loc = db.execute(
            text(
                "SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng "
                "FROM fault_reports WHERE id = :id"
            ),
            {"id": report.id},
        ).fetchone()
        lat = float(loc.lat) if loc and loc.lat is not None else 0.0
        lng = float(loc.lng) if loc and loc.lng is not None else 0.0
    except Exception:
        lat, lng = 0.0, 0.0
    return FaultReportResponse(
        id=report.id,
        category=report.category,
        confidence=report.confidence,
        image_url=report.image_url,
        description=report.description,
        status=report.status,
        latitude=lat,
        longitude=lng,
        cluster_id=report.cluster_id or report.id,
        severity=report.severity,
        upvote_count=report.upvote_count or 0,
        is_public=bool(report.is_public),
        created_at=report.created_at,
        updated_at=report.updated_at,
        resolved_at=report.resolved_at,
    )


@router.post("", response_model=FaultReportResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def create_report(
    request: Request,
    latitude: Annotated[float, Form(ge=-90, le=90)],
    longitude: Annotated[float, Form(ge=-180, le=180)],
    file: Annotated[UploadFile, File()],
    description: Annotated[Optional[str], Form()] = None,
    db: Session = Depends(get_db),
):
    try:
        image_url, image_bytes = await save_upload(file)
        category, confidence = pipeline.predict_category(image_bytes)
        try:
            cluster_id = assign_cluster(db, latitude, longitude, category)
        except Exception as exc:
            logger.warning("Clustering skipped: %s", exc)
            cluster_id = None

        is_public = settings.min_upvotes_for_public <= 0
        point = WKTElement(f"POINT({longitude} {latitude})", srid=4326)

        report = FaultReport(
            category=category,
            confidence=confidence,
            image_url=image_url,
            description=description,
            status="pending",
            location=point,
            cluster_id=cluster_id,
            upvote_count=0,
            is_public=is_public,
        )
        db.add(report)
        db.commit()
        db.refresh(report)

        if report.cluster_id is None:
            report.cluster_id = report.id
            db.add(report)
            db.commit()
            db.refresh(report)

        return _row_to_response(db, report)
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("create_report failed")
        raise HTTPException(
            status_code=500,
            detail=f"{type(exc).__name__}: {str(exc)[:500]}",
        ) from exc


@router.get("", response_model=FaultReportListResponse)
def list_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    cluster_id: Optional[int] = None,
    public_only: bool = Query(True),
    bbox: Optional[str] = Query(None, description="min_lng,min_lat,max_lng,max_lat"),
    db: Session = Depends(get_db),
):
    q = db.query(FaultReport)
    if public_only:
        q = q.filter(FaultReport.is_public == True)  # noqa: E712
    if category:
        q = q.filter(FaultReport.category == category)
    if status_filter:
        q = q.filter(FaultReport.status == status_filter)
    if cluster_id is not None:
        q = q.filter(
            (FaultReport.cluster_id == cluster_id) | (FaultReport.id == cluster_id)
        )
    if bbox:
        try:
            min_lng, min_lat, max_lng, max_lat = [float(x) for x in bbox.split(",")]
            q = q.filter(
                text(
                    "ST_Within(location::geometry, "
                    "ST_MakeEnvelope(:min_lng, :min_lat, :max_lng, :max_lat, 4326))"
                ).bindparams(
                    min_lng=min_lng, min_lat=min_lat, max_lng=max_lng, max_lat=max_lat
                )
            )
        except ValueError:
            raise HTTPException(400, "Invalid bbox format")

    total = q.count()
    items = (
        q.order_by(FaultReport.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return FaultReportListResponse(
        items=[_row_to_response(db, r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=ceil(total / page_size) if page_size else 0,
    )


@router.get("/{report_id}", response_model=FaultReportResponse)
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(FaultReport).filter(FaultReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Report not found")
    return _row_to_response(db, report)


@router.patch("/{report_id}/status", response_model=FaultReportResponse)
def update_status(
    report_id: int,
    body: StatusUpdate,
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
    report = db.query(FaultReport).filter(FaultReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Report not found")
    report.status = body.status
    report.updated_at = datetime.utcnow()
    if body.status == "resolved":
        report.resolved_at = datetime.utcnow()
    db.add(report)
    db.commit()
    db.refresh(report)
    return _row_to_response(db, report)


@router.post("/{report_id}/upvote", response_model=FaultReportResponse)
@limiter.limit("30/minute")
def upvote_report(
    request: Request,
    report_id: int,
    body: UpvoteRequest,
    db: Session = Depends(get_db),
):
    report = db.query(FaultReport).filter(FaultReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Report not found")

    existing = (
        db.query(ReportUpvote)
        .filter(ReportUpvote.report_id == report_id, ReportUpvote.voter_hash == body.voter_hash)
        .first()
    )
    if existing:
        raise HTTPException(409, "Already upvoted")

    db.add(ReportUpvote(report_id=report_id, voter_hash=body.voter_hash))
    report.upvote_count = (report.upvote_count or 0) + 1
    if report.upvote_count >= settings.min_upvotes_for_public:
        report.is_public = True
    report.updated_at = datetime.utcnow()
    db.add(report)
    db.commit()
    db.refresh(report)
    return _row_to_response(db, report)
