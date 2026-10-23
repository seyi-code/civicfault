"""Spatial clustering without PostGIS (haversine approximation)."""

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
    """
    Find an open report of the same category within radius_meters.
    Uses haversine distance so it works on plain PostgreSQL.
    """
    radius = radius_meters if radius_meters is not None else settings.cluster_radius_meters

    # Approximate degrees for a quick prefilter (1 deg lat ~ 111km)
    deg = max(radius / 111_000.0, 0.0001)

    query = text(
        """
        SELECT id, COALESCE(cluster_id, id) AS cluster_id
        FROM fault_reports
        WHERE category = :category
          AND status NOT IN ('resolved', 'rejected')
          AND latitude BETWEEN :lat - :deg AND :lat + :deg
          AND longitude BETWEEN :lng - :deg AND :lng + :deg
          AND (
            6371000 * 2 * ASIN(SQRT(
              POWER(SIN(RADIANS((latitude - :lat) / 2)), 2) +
              COS(RADIANS(:lat)) * COS(RADIANS(latitude)) *
              POWER(SIN(RADIANS((longitude - :lng) / 2)), 2)
            ))
          ) <= :radius
        ORDER BY created_at ASC
        LIMIT 1
        """
    )
    row = db.execute(
        query,
        {
            "category": category,
            "lat": latitude,
            "lng": longitude,
            "deg": deg,
            "radius": radius,
        },
    ).fetchone()

    if row:
        return int(row.cluster_id)
    return None
