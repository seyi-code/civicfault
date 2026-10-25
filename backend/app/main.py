import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text, inspect

from app.core.config import settings
from app.api import health, reports, clusters, auth, billing, export, orgs, cron
from app.services.storage import ensure_upload_dir
from app.db.session import engine
from app.db.base import Base
from app.models import fault, user, organization, invite  # noqa: F401

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, default_limits=[settings.rate_limit_default])

app = FastAPI(
    title="CivicFault API",
    description="Community Infrastructure & Public Utility Fault Tracker",
    version="1.5.0",
    docs_url="/docs",
    redoc_url="/redoc",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_default_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://civicfault.vercel.app",
]
origins = list(dict.fromkeys(_default_origins + (settings.cors_origins_list or [])))
if "*" in origins:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=origins != ["*"],
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
app.include_router(billing.router, prefix="/api/v1")
app.include_router(export.router, prefix="/api/v1")
app.include_router(orgs.router, prefix="/api/v1")
app.include_router(cron.router, prefix="/api/v1")


def _add_column_if_missing(table: str, column_sql: str) -> None:
    insp = inspect(engine)
    if table not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns(table)}
    col_name = column_sql.split()[0]
    if col_name in cols:
        return
    with engine.begin() as conn:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column_sql}"))


def _ensure_schema() -> None:
    insp = inspect(engine)
    tables = insp.get_table_names()

    if "fault_reports" in tables:
        cols = {c["name"] for c in insp.get_columns("fault_reports")}
        if "location" in cols and "latitude" not in cols:
            with engine.begin() as conn:
                conn.execute(text("DROP TABLE IF EXISTS report_upvotes CASCADE"))
                conn.execute(text("DROP TABLE IF EXISTS fault_reports CASCADE"))

    Base.metadata.create_all(bind=engine)

    _add_column_if_missing("authority_users", "plan VARCHAR(30) DEFAULT 'free'")
    _add_column_if_missing("authority_users", "plan_expires_at TIMESTAMP")
    _add_column_if_missing("authority_users", "paystack_customer_code VARCHAR(100)")
    _add_column_if_missing("authority_users", "organization_id INTEGER")
    _add_column_if_missing("fault_reports", "organization_id INTEGER")

    logger.info("Database tables ready")


@app.on_event("startup")
def on_startup() -> None:
    try:
        _ensure_schema()
    except Exception as exc:
        logger.exception("Schema setup failed: %s", exp if False else exp if False else exc)


@app.get("/")
def root():
    return {
        "name": "CivicFault",
        "version": "1.5.0",
        "docs": "/docs",
        "health": "/api/v1/health",
        "features": [
            "reports",
            "clusters",
            "authority",
            "paystack",
            "flutterwave",
            "orgs",
            "sla",
            "whatsapp_digest",
            "white_label",
            "team_invites",
            "cron_digests",
        ],
    }
