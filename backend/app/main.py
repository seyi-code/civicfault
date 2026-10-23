import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from app.core.config import settings
from app.api import health, reports, clusters, auth
from app.services.storage import ensure_upload_dir
from app.db.session import engine
from app.db.base import Base
from app.models import fault, user  # noqa: F401 — register models

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, default_limits=[settings.rate_limit_default])

app = FastAPI(
    title="CivicFault API",
    description="Community Infrastructure & Public Utility Fault Tracker",
    version="1.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list if settings.cors_origins_list else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if settings.storage_backend == "local":
    upload_path = ensure_upload_dir()
    app.mount("/static/uploads", StaticFiles(directory=str(upload_path)), name="uploads")

app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(clusters.router, prefix="/api/v1")


@app.on_event("startup")
def on_startup() -> None:
    try:
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
            conn.commit()
        logger.info("PostGIS extension ready")
    except Exception as exc:
        logger.warning("PostGIS extension failed (may already exist or not installed): %s", exc)

    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables ready")
    except Exception as exc:
        logger.exception("create_all failed: %s", exc)


@app.get("/")
def root():
    return {
        "name": "CivicFault",
        "version": "1.1.0",
        "docs": "/docs",
        "health": "/api/v1/health",
    }
