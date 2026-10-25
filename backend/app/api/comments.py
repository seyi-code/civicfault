from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.session import get_db
from app.models.fault import FaultReport
from app.models.comment import ReportComment
from app.models.user import AuthorityUser
from app.schemas.comment import CommentCreate, CommentOut, CommentList
from app.core.security import get_current_authority_optional

router = APIRouter(prefix="/reports", tags=["comments"])
limiter = Limiter(key_func=get_remote_address)


def _to_out(c: ReportComment) -> CommentOut:
    return CommentOut(
        id=c.id,
        report_id=c.report_id,
        author_label=c.author_label,
        is_staff=bool(c.is_staff),
        body=c.body,
        created_at=c.created_at,
    )


@router.get("/{report_id}/comments", response_model=CommentList)
def list_comments(report_id: int, db: Session = Depends(get_db)):
    report = db.query(FaultReport).filter(FaultReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Report not found")
    rows = (
        db.query(ReportComment)
        .filter(ReportComment.report_id == report_id, ReportComment.is_hidden == False)  # noqa: E712
        .order_by(ReportComment.created_at.asc())
        .limit(200)
        .all()
    )
    return CommentList(items=[_to_out(c) for c in rows], total=len(rows))


@router.post("/{report_id}/comments", response_model=CommentOut, status_code=201)
@limiter.limit("30/minute")
async def add_comment(
    request: Request,
    report_id: int,
    body: CommentCreate,
    db: Session = Depends(get_db),
    user: Optional[AuthorityUser] = Depends(get_current_authority_optional),
):
    report = db.query(FaultReport).filter(FaultReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Report not found")

    text = body.body.strip()
    if not text:
        raise HTTPException(400, "Empty comment")

    if user:
        label = user.full_name or user.email.split("@")[0]
        if user.role == "admin":
            label = f"{label} (Platform)"
        elif user.organization:
            label = f"{label} (Staff)"
        comment = ReportComment(
            report_id=report_id,
            authority_user_id=user.id,
            author_label=label[:120],
            author_hash=None,
            body=text[:2000],
            is_staff=True,
        )
    else:
        label = (body.author_label or "Resident").strip()[:120] or "Resident"
        comment = ReportComment(
            report_id=report_id,
            authority_user_id=None,
            author_label=label,
            author_hash=(body.author_hash or "anon")[:64],
            body=text[:2000],
            is_staff=False,
        )

    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _to_out(comment)


@router.delete("/comments/{comment_id}", status_code=204)
def hide_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_optional),
):
    if not user or user.role not in ("admin", "manager", "authority"):
        raise HTTPException(403, "Staff only")
    c = db.query(ReportComment).filter(ReportComment.id == comment_id).first()
    if not c:
        raise HTTPException(404, "Not found")
    c.is_hidden = True
    db.add(c)
    db.commit()
    return None
