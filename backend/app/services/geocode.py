"""Reverse geocoding via OpenStreetMap Nominatim (free, rate-limited)."""
from __future__ import annotations

import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


async def reverse_geocode(lat: float, lng: float) -> Optional[str]:
    """Return a short human place name, or None on failure."""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={
                    "lat": lat,
                    "lon": lng,
                    "format": "json",
                    "zoom": 18,
                    "addressdetails": 1,
                },
                headers={"User-Agent": "CivicFault/1.5 (community infrastructure tracker)"},
            )
        if r.status_code != 200:
            return None
        data = r.json()
        addr = data.get("address") or {}
        # Prefer street-level pieces useful in Kampala / UG
        parts = []
        for key in (
            "road",
            "pedestrian",
            "neighbourhood",
            "suburb",
            "village",
            "city_district",
            "city",
            "town",
            "county",
        ):
            if addr.get(key) and addr[key] not in parts:
                parts.append(addr[key])
            if len(parts) >= 3:
                break
        if parts:
            return ", ".join(parts[:3])
        return data.get("display_name")
    except Exception as exc:
        logger.warning("reverse_geocode failed: %s", exc)
        return None
