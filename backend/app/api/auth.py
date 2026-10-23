from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import AuthorityUser
from app.schemas.auth import AuthorityRegister, AuthorityLogin, TokenResponse, AuthorityOut
from app.core.security import hash_password, verify_password, create_access_token, get_current_authority
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthorityOut, status_code=201)
def register(body: AuthorityRegister, db: Session = Depends(get_db)):
    user_count = db.query(AuthorityUser).count()
    # First user always allowed (bootstrap). Later users only in non-production
    # or when AUTHORITY_BOOTSTRAP_KEY matches (via organization field as optional key —
    # prefer env OPEN_REGISTRATION=true for demos).
    open_reg = settings.environment != "production" or user_count == 0
    if not open_reg:
        raise HTTPException(
            403,
            "Open registration disabled. Ask an existing admin or set ENVIRONMENT=development.",
        )

    existing = db.query(AuthorityUser).filter(AuthorityUser.email == body.email.lower()).first()
    if existing:
        raise HTTPException(400, "Email already registered")

    user = AuthorityUser(
        email=body.email.lower(),
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        organization=body.organization,
        role="admin" if user_count == 0 else "authority",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(body: AuthorityLogin, db: Session = Depends(get_db)):
    user = db.query(AuthorityUser).filter(AuthorityUser.email == body.email.lower()).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(403, "Account inactive")
    token = create_access_token(subject=user.email, role=user.role)
    return TokenResponse(access_token=token, role=user.role)


@router.get("/me", response_model=AuthorityOut)
def me(user: AuthorityUser = Depends(get_current_authority)):
    return user
