"""Spatial clustering of reports using PostGIS."""
from __future__ import annotations
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.config import settings

def assign_cluster(
    db: Session,
    latitude: float,
    longitude: float,
    category: str,
    radius_meters: float | None = None,
) -> int | None:
    radius = radius_meters if radius_meters is not None else settings.cluster_radius_meters
    lock_key = abs(hash(category)) % 2_147_483_647
    db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_key})
    query = text(
        """
        SELECT id, COALESCE(cluster_id, id) AS cluster_id
        FROM fault_reports
        WHERE category = :category
          AND status NOT IN ('resolved', 'rejected')
          AND ST_DWithin(
                location::geography,
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                :radius
              )
        ORDER BY created_at ASC
        LIMIT 1
        """
    )
    row = db.execute(
        query, {"category": category, "lng": longitude, "lat": latitude, "radius": radius},
    ).fetchone()
    if row:
        return int(row.cluster_id)
    return None
