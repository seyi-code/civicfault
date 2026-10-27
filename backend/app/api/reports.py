from datetime import datetime
from math import ceil
from typing import Annotated, Optional
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import desc
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.session import get_db
from app.models.fault import FaultReport, ReportUpvote
from app.models.organization import Organization
from app.schemas.fault import (
    FaultReportResponse,
    FaultReportListResponse,
    StatusUpdate,
    PinUpdate,
    ReportEdit,
    UpvoteRequest,
)
from app.services.ml import pipeline, CANONICAL_CATEGORIES
from app.services.clustering import assign_cluster
from app.services.storage import save_upload
from app.services.sla import hours_open, is_overdue
from app.services.geocode import reverse_geocode
from app.core.security import get_current_authority, get_current_resident_optional
from app.core.config import settings
from app.models.user import AuthorityUser

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reports", tags=["reports"])
limiter = Limiter(key_func=get_remote_address)


def _sla_hours_for(report: FaultReport, db: Session) -> int:
    if report.organization_id:
        org = db.query(Organization).filter(Organization.id == report.organization_id).first()
        if org:
            return org.sla_hours or 72
    return 72


def _row_to_response(report: FaultReport, db: Session) -> FaultReportResponse:
    sla = _sla_hours_for(report, db)
    return FaultReportResponse(
        id=report.id,
        category=report.category,
        confidence=report.confidence,
        image_url=report.image_url,
        description=report.description,
        status=report.status,
        latitude=float(report.latitude),
        longitude=float(report.longitude),
        address_label=getattr(report, "address_label", None),
        cluster_id=report.cluster_id or report.id,
        organization_id=report.organization_id,
        reporter_id=getattr(report, "reporter_id", None),
        severity=report.severity,
        upvote_count=report.upvote_count or 0,
        is_public=bool(report.is_public),
        is_pinned=bool(getattr(report, "is_pinned", False)),
        created_at=report.created_at,
        updated_at=report.updated_at,
        resolved_at=report.resolved_at,
        hours_open=round(hours_open(report.created_at, report.resolved_at), 1),
        is_overdue=is_overdue(report.created_at, report.status, sla, report.resolved_at),
        sla_hours=sla,
    )


def _can_manage(user: AuthorityUser, report: FaultReport) -> bool:
    if user.role == "admin":
        return True
    if user.organization_id and report.organization_id == user.organization_id:
        return True
    return False


def _require_manage(user: AuthorityUser, report: FaultReport) -> None:
    if _can_manage(user, report):
        return
    if report.organization_id is None and user.role == "admin":
        return
    if report.organization_id is None:
        raise HTTPException(403, "Only platform admin can edit community reports")
    raise HTTPException(403, "Report belongs to another organization")


@router.post("", response_model=FaultReportResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def create_report(
    request: Request,
    latitude: Annotated[float, Form(ge=-90, le=90)],
    longitude: Annotated[float, Form(ge=-180, le=180)],
    file: Annotated[UploadFile, File()],
    description: Annotated[Optional[str], Form()] = None,
    category: Annotated[Optional[str], Form()] = None,
    organization_id: Annotated[Optional[int], Form()] = None,
    org_slug: Annotated[Optional[str], Form()] = None,
    db: Session = Depends(get_db),
    resident=Depends(get_current_resident_optional),
):
    try:
        image_url, image_bytes = await save_upload(file)

        # User-selected category wins (Phase 0). Mock/AI is fallback only.
        user_cat = (category or "").strip().lower().replace(" ", "_")
        if user_cat in CANONICAL_CATEGORIES:
            final_category = user_cat
            confidence = None  # human-labeled — no AI %
        else:
            final_category, confidence = pipeline.predict_category(image_bytes)

        try:
            cluster_id = assign_cluster(db, latitude, longitude, final_category)
        except Exception as exc:
            logger.warning("Clustering skipped: %s", exc)
            db.rollback()
            cluster_id = None

        org_id = organization_id
        is_public = settings.min_upvotes_for_public <= 0
        if org_slug and not org_id:
            org = db.query(Organization).filter(Organization.slug == org_slug).first()
            if org:
                org_id = org.id

        address_label = await reverse_geocode(latitude, longitude)

        report = FaultReport(
            category=final_category,
            confidence=confidence,
            image_url=image_url,
            description=description,
            status="pending",
            latitude=latitude,
            longitude=longitude,
            address_label=address_label,
            cluster_id=cluster_id,
            organization_id=org_id,
            reporter_id=resident.id if resident is not None else None,
            upvote_count=0,
            is_public=is_public,
            is_pinned=False,
        )
        db.add(report)
        db.commit()
        db.refresh(report)

        if report.cluster_id is None:
            report.cluster_id = report.id
            db.add(report)
            db.commit()
            db.refresh(report)

        return _row_to_response(report, db)
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
    organization_id: Optional[int] = None,
    org_slug: Optional[str] = None,
    public_only: bool = Query(True),
    overdue_only: bool = Query(False),
    q: Optional[str] = Query(None),
    bbox: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(FaultReport)
    if public_only and not organization_id and not org_slug:
        query = query.filter(FaultReport.is_public == True)  # noqa: E712
    if org_slug:
        org = db.query(Organization).filter(Organization.slug == org_slug).first()
        if org:
            organization_id = org.id
    if organization_id is not None:
        query = query.filter(FaultReport.organization_id == organization_id)
    if category:
        query = query.filter(FaultReport.category == category)
    if status_filter:
        query = query.filter(FaultReport.status == status_filter)
    if cluster_id is not None:
        query = query.filter(
            (FaultReport.cluster_id == cluster_id) | (FaultReport.id == cluster_id)
        )
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            (FaultReport.category.ilike(like))
            | (FaultReport.description.ilike(like))
            | (FaultReport.address_label.ilike(like))
        )
    if bbox:
        try:
            min_lng, min_lat, max_lng, max_lat = [float(x) for x in bbox.split(",")]
            query = query.filter(
                FaultReport.longitude >= min_lng,
                FaultReport.longitude <= max_lng,
                FaultReport.latitude >= min_lat,
                FaultReport.latitude <= max_lat,
            )
        except ValueError:
            raise HTTPException(400, "Invalid bbox format")

    total = query.count()
    items = (
        query.order_by(desc(FaultReport.is_pinned), FaultReport.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    responses = [_row_to_response(r, db) for r in items]
    if overdue_only:
        responses = [r for r in responses if r.is_overdue]
        total = len(responses)
    return FaultReportListResponse(
        items=responses,
        total=total,
        page=page,
        page_size=page_size,
        pages=ceil(total / page_size) if page_size else 0,
    )


@router.get("/workspace", response_model=FaultReportListResponse)
def list_workspace_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    q: Optional[str] = Query(None),
    org_id: Optional[int] = Query(None, description="Platform admin only: view-as workspace"),
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
    query = db.query(FaultReport)
    if org_id is not None:
        if user.role != "admin":
            raise HTTPException(403, "Only platform admin can view-as a workspace")
        query = query.filter(FaultReport.organization_id == org_id)
    elif user.organization_id:
        query = query.filter(FaultReport.organization_id == user.organization_id)
    else:
        query = query.filter(FaultReport.is_public == True)  # noqa: E712
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            (FaultReport.category.ilike(like))
            | (FaultReport.description.ilike(like))
            | (FaultReport.address_label.ilike(like))
            | (FaultReport.status.ilike(like))
        )
    total = query.count()
    items = (
        query.order_by(desc(FaultReport.is_pinned), FaultReport.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return FaultReportListResponse(
        items=[_row_to_response(r, db) for r in items],
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
    return _row_to_response(report, db)


@router.patch("/{report_id}", response_model=FaultReportResponse)
def edit_report(
    report_id: int,
    body: ReportEdit,
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
    report = db.query(FaultReport).filter(FaultReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Report not found")
    _require_manage(user, report)

    data = body.model_dump(exclude_unset=True)
    if "description" in data:
        report.description = data["description"]
    if "category" in data and data["category"]:
        report.category = data["category"]
        report.confidence = None  # staff correction — not model score
    if "address_label" in data:
        report.address_label = data["address_label"]
    if "severity" in data:
        report.severity = data["severity"]
    if "status" in data and data["status"]:
        report.status = data["status"]
        if data["status"] == "resolved":
            report.resolved_at = datetime.utcnow()
        elif data["status"] != "resolved":
            report.resolved_at = None

    report.updated_at = datetime.utcnow()
    db.add(report)
    db.commit()
    db.refresh(report)
    return _row_to_response(report, db)


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
    if not _can_manage(user, report) and report.organization_id is not None:
        raise HTTPException(403, "Report belongs to another organization")
    report.status = body.status
    report.updated_at = datetime.utcnow()
    if body.status == "resolved":
        report.resolved_at = datetime.utcnow()
    elif body.status != "resolved":
        report.resolved_at = None
    db.add(report)
    db.commit()
    db.refresh(report)
    return _row_to_response(report, db)


@router.patch("/{report_id}/pin", response_model=FaultReportResponse)
def pin_report(
    report_id: int,
    body: PinUpdate,
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
    report = db.query(FaultReport).filter(FaultReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Report not found")
    if not _can_manage(user, report) and report.organization_id is not None:
        raise HTTPException(403, "Report belongs to another organization")
    if not _can_manage(user, report) and user.role != "admin":
        if report.organization_id is None and user.role != "admin":
            raise HTTPException(403, "Only platform admin can pin community reports")
    report.is_pinned = body.is_pinned
    report.updated_at = datetime.utcnow()
    db.add(report)
    db.commit()
    db.refresh(report)
    return _row_to_response(report, db)


@router.delete("/{report_id}", status_code=204)
def delete_report(
    report_id: int,
    hard: bool = Query(False),
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority),
):
    report = db.query(FaultReport).filter(FaultReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Report not found")

    if not _can_manage(user, report):
        if user.role != "admin":
            raise HTTPException(
                403,
                "Only platform admin can remove community public reports. "
                "Org staff may only manage reports tagged to their workspace.",
            )

    if hard:
        if user.role != "admin":
            raise HTTPException(403, "Hard delete is platform-admin only")
        db.query(ReportUpvote).filter(ReportUpvote.report_id == report_id).delete()
        db.delete(report)
        db.commit()
        return None

    report.status = "rejected"
    report.is_public = False
    report.is_pinned = False
    report.updated_at = datetime.utcnow()
    db.add(report)
    db.commit()
    return None


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
    return _row_to_response(report, db)
