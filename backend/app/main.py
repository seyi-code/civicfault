import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text, inspect

from app.core.config import settings
from app.api import health, reports, clusters, auth
from app.services.storage import ensure_upload_dir
from app.db.session import engine
from app.db.base import Base
from app.models import fault, user  # noqa: F401

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, default_limits=[settings.rate_limit_default])

app = FastAPI(
    title="CivicFault API",
    description="Community Infrastructure & Public Utility Fault Tracker",
    version="1.2.0",
    docs_url="/docs",
    redoc_url="/redoc",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

origins = settings.cors_origins_list if settings.cors_origins_list else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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


def _ensure_schema() -> None:
    """Create tables. Migrate away from old PostGIS geometry column if present."""
    insp = inspect(engine)
    tables = insp.get_table_names()

    if "fault_reports" in tables:
        cols = {c["name"] for c in insp.get_columns("fault_reports")}
        # Old schema had geometry `location` and no latitude/longitude
        if "location" in cols and "latitude" not in cols:
            logger.warning("Migrating fault_reports away from PostGIS geometry column")
            with engine.begin() as conn:
                conn.execute(text("DROP TABLE IF EXISTS report_upvotes CASCADE"))
                conn.execute(text("DROP TABLE IF EXISTS fault_reports CASCADE"))

    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ready")


@app.on_event("startup")
def on_startup() -> None:
    try:
        _ensure_schema()
    except Exception as exc:
        logger.exception("Schema setup failed: %s", exc)


@app.get("/")
def root():
    return {
        "name": "CivicFault",
        "version": "1.2.0",
        "docs": "/docs",
        "health": "/api/v1/health",
    }
