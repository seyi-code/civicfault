from fastapi import APIRouter
from sqlalchemy import text
from app.db.session import engine

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    db_ok = False
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            db_ok = True
    except Exception:
        pass
    return {
        "status": "ok" if db_ok else "degraded",
        "database": "up" if db_ok else "down",
    }
