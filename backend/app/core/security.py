from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=False)

ALGORITHM = "HS256"
ALLOWED_ROLES = ("authority", "admin", "manager")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(
    subject: str, role: str = "authority", expires_minutes: Optional[int] = None
) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.access_token_expire_minutes
    )
    payload = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token — please sign in again",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


async def get_current_authority(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_token(token)
    email = payload.get("sub")
    role = payload.get("role")
    if not email or role not in ALLOWED_ROLES:
        raise HTTPException(status_code=403, detail="Authority role required")
    if isinstance(email, str) and email.startswith("resident:"):
        raise HTTPException(status_code=403, detail="Authority role required")

    from app.models.user import AuthorityUser

    user = (
        db.query(AuthorityUser)
        .filter(AuthorityUser.email == email, AuthorityUser.is_active == True)  # noqa: E712
        .first()
    )
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


async def get_current_authority_optional(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError:
        return None
    email = payload.get("sub")
    role = payload.get("role")
    if not email or role not in ALLOWED_ROLES:
        return None
    if isinstance(email, str) and email.startswith("resident:"):
        return None
    from app.models.user import AuthorityUser

    return (
        db.query(AuthorityUser)
        .filter(AuthorityUser.email == email, AuthorityUser.is_active == True)  # noqa: E712
        .first()
    )


async def get_current_resident(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    if not token:
        raise HTTPException(401, "Not authenticated")
    payload = decode_token(token)
    sub = payload.get("sub") or ""
    role = payload.get("role")
    if role != "resident" or not str(sub).startswith("resident:"):
        raise HTTPException(403, "Resident account required")
    email = str(sub).replace("resident:", "", 1)
    from app.models.resident import ResidentUser

    user = (
        db.query(ResidentUser)
        .filter(ResidentUser.email == email, ResidentUser.is_active == True)  # noqa: E712
        .first()
    )
    if not user:
        raise HTTPException(401, "Resident not found or suspended")
    return user


async def get_current_resident_optional(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError:
        return None
    sub = payload.get("sub") or ""
    if payload.get("role") != "resident" or not str(sub).startswith("resident:"):
        return None
    email = str(sub).replace("resident:", "", 1)
    from app.models.resident import ResidentUser

    return (
        db.query(ResidentUser)
        .filter(ResidentUser.email == email, ResidentUser.is_active == True)  # noqa: E712
        .first()
    )
