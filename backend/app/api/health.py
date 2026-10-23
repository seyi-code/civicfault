from fastapi import APIRouter
from sqlalchemy import text
from app.db.session import engine

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    db_ok = False
    error = None
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            db_ok = True
    except Exception as exc:
        # Short type + message; strip anything after @ to avoid leaking passwords in URLs
        msg = str(exc).split("\n")[0]
        if "@" in msg and ":" in msg:
            msg = msg.split("@")[0].rsplit(":", 1)[0] + "@***"
        error = f"{type(exc).__name__}: {msg[:200]}"
    return {
        "status": "ok" if db_ok else "degraded",
        "database": "up" if db_ok else "down",
        "error": error,
    }
