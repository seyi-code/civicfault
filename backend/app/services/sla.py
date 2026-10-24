from datetime import datetime, timedelta
from typing import Optional

OPEN_STATUSES = {"pending", "confirmed", "in_progress"}


def hours_open(created_at: datetime, resolved_at: Optional[datetime] = None) -> float:
    end = resolved_at or datetime.utcnow()
    if created_at.tzinfo:
        created_at = created_at.replace(tzinfo=None)
    if end.tzinfo:
        end = end.replace(tzinfo=None)
    return max(0.0, (end - created_at).total_seconds() / 3600.0)


def is_overdue(
    created_at: datetime,
    status: str,
    sla_hours: int = 72,
    resolved_at: Optional[datetime] = None,
) -> bool:
    if status not in OPEN_STATUSES:
        return False
    return hours_open(created_at, resolved_at) > sla_hours


def sla_deadline(created_at: datetime, sla_hours: int = 72) -> datetime:
    if created_at.tzinfo:
        created_at = created_at.replace(tzinfo=None)
    return created_at + timedelta(hours=sla_hours)
