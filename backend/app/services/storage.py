"""Storage abstraction: local disk or S3/MinIO."""
from __future__ import annotations

import logging
import uuid
from pathlib import Path
from typing import Tuple

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

logger = logging.getLogger(__name__)


def ensure_upload_dir() -> Path:
    path = Path(settings.upload_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _s3_client():
    import boto3
    kwargs = {
        "region_name": settings.s3_region,
        "aws_access_key_id": settings.s3_access_key,
        "aws_secret_access_key": settings.s3_secret_key,
    }
    if settings.s3_endpoint_url:
        kwargs["endpoint_url"] = settings.s3_endpoint_url
    return boto3.client("s3", **kwargs)


async def save_upload(file: UploadFile) -> Tuple[str, bytes]:
    if file.content_type not in settings.allowed_image_types_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported image type. Allowed: {settings.allowed_image_types}",
        )

    raw = await file.read()
    if len(raw) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(raw) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image exceeds {settings.max_upload_mb} MB limit",
        )

    ext_map = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }
    ext = ext_map.get(file.content_type, ".jpg")
    filename = f"{uuid.uuid4().hex}{ext}"

    if settings.storage_backend == "s3":
        return await _save_s3(filename, raw, file.content_type)
    return _save_local(filename, raw)


def _save_local(filename: str, raw: bytes) -> Tuple[str, bytes]:
    upload_dir = ensure_upload_dir()
    dest = upload_dir / filename
    with open(dest, "wb") as f:
        f.write(raw)
    return f"/static/uploads/{filename}", raw


async def _save_s3(filename: str, raw: bytes, content_type: str) -> Tuple[str, bytes]:
    if not settings.s3_bucket:
        raise HTTPException(500, "S3 bucket not configured")
    client = _s3_client()
    key = f"reports/{filename}"
    extra = {"ContentType": content_type}
    try:
        client.put_object(Bucket=settings.s3_bucket, Key=key, Body=raw, **extra)
    except Exception as exc:
        logger.exception("S3 upload failed")
        raise HTTPException(500, f"Storage error: {exc}") from exc

    if settings.s3_public_base_url:
        url = f"{settings.s3_public_base_url.rstrip('/')}/{key}"
    else:
        url = f"s3://{settings.s3_bucket}/{key}"
    return url, raw
