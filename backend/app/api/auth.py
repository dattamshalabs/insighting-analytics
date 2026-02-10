"""Authentication API endpoints."""

from __future__ import annotations

import datetime
import hashlib
import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.orm import RefreshToken, User
from app.models.schemas import (
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserCreate,
    UserOut,
)
from app.services.auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
    verify_token,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


def _hash_token(token: str) -> str:
    """Create a hash of the refresh token for storage."""
    return hashlib.sha256(token.encode()).hexdigest()


@router.post("/register", response_model=UserOut, status_code=201)
async def register(body: UserCreate, db: Session = Depends(get_db)):
    """Register a new user account."""
    # Check if email already exists
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        role="user",  # Default role
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    logger.info("New user registered: %s", user.email)
    return UserOut(
        id=user.id,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate and get access/refresh tokens."""
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    # Create tokens
    access_token = create_access_token({"sub": user.id, "email": user.email, "role": user.role})
    refresh_token = create_refresh_token({"sub": user.id})

    # Store refresh token hash
    expires_at = datetime.datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    token_record = RefreshToken(
        user_id=user.id,
        token_hash=_hash_token(refresh_token),
        expires_at=expires_at,
    )
    db.add(token_record)

    # Update last login
    user.last_login_at = datetime.datetime.utcnow()
    db.commit()

    logger.info("User logged in: %s", user.email)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(body: RefreshRequest, db: Session = Depends(get_db)):
    """Get new access token using refresh token."""
    payload = verify_token(body.refresh_token, "refresh")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    # Verify token exists in database and is not revoked
    token_hash = _hash_token(body.refresh_token)
    token_record = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.user_id == user_id,
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,
        )
        .first()
    )
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found or revoked",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or disabled",
        )

    # Revoke old refresh token
    token_record.revoked = True

    # Create new tokens
    access_token = create_access_token({"sub": user.id, "email": user.email, "role": user.role})
    new_refresh_token = create_refresh_token({"sub": user.id})

    # Store new refresh token
    expires_at = datetime.datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    new_token_record = RefreshToken(
        user_id=user.id,
        token_hash=_hash_token(new_refresh_token),
        expires_at=expires_at,
    )
    db.add(new_token_record)
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/logout", status_code=204)
async def logout(
    body: RefreshRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Logout by revoking the refresh token."""
    token_hash = _hash_token(body.refresh_token)
    token_record = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.user_id == current_user.id,
            RefreshToken.token_hash == token_hash,
        )
        .first()
    )
    if token_record:
        token_record.revoked = True
        db.commit()

    logger.info("User logged out: %s", current_user.email)


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user profile."""
    return UserOut(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        last_login_at=current_user.last_login_at,
    )
