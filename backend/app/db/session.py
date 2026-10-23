from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from app.core.config import settings


def _normalize_database_url(url: str) -> str:
    """Railway often provides postgres://; SQLAlchemy + psycopg2 need postgresql+psycopg2://."""
    if not url:
        return url
    u = url.strip()
    if u.startswith("postgres://"):
        u = "postgresql://" + u[len("postgres://") :]
    if u.startswith("postgresql://") and "+psycopg" not in u.split("://", 1)[0]:
        u = "postgresql+psycopg2://" + u[len("postgresql://") :]
    return u


DATABASE_URL = _normalize_database_url(settings.database_url)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
