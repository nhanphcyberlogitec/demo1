# core/routers/auth.py
"""
Authentication routes for ShipTrack Pro.
Endpoints:
  POST /api/auth/login   — validate credentials, issue JWT
  POST /api/auth/logout  — invalidate / blacklist token
  GET  /api/auth/me      — return current user from JWT
"""

from __future__ import annotations

import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import ExpiredSignatureError, JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, field_validator

# ---------------------------------------------------------------------------
# Config — loaded from environment; defaults are DEV-ONLY fallbacks
# ---------------------------------------------------------------------------

JWT_SECRET: str = os.environ.get("JWT_SECRET", "dev-secret-change-in-production")
JWT_ALGORITHM: str = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_HOURS: int = 24          # short-lived (no "remember me")
REMEMBER_TOKEN_EXPIRE_DAYS: int = 30         # long-lived  ("remember me")

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ---------------------------------------------------------------------------
# In-memory user store (replace with DB in production)
# ---------------------------------------------------------------------------

_USERS: dict[str, dict[str, Any]] = {
    "admin@shiptrack.com": {
        "id": "usr_admin001",
        "email": "admin@shiptrack.com",
        "name": "Admin User",
        "role": "admin",
        "avatarUrl": None,
        # bcrypt hash of "password123"
        "hashed_password": pwd_context.hash("password123"),
        "lastLoginAt": None,
    },
    "captain@shiptrackpro.com": {
        "id": "usr_abc123",
        "email": "captain@shiptrackpro.com",
        "name": "Captain James",
        "role": "operator",
        "avatarUrl": None,
        "hashed_password": pwd_context.hash("s3cur3P@ssw0rd"),
        "lastLoginAt": None,
    },
}

# ---------------------------------------------------------------------------
# Token blacklist (stateless-friendly; replace with Redis/DB in production)
# ---------------------------------------------------------------------------

_TOKEN_BLACKLIST: set[str] = set()

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    rememberMe: bool = False

    @field_validator("password")
    @classmethod
    def password_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Password must not be empty")
        return v


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    avatarUrl: str | None = None
    lastLoginAt: str | None = None


class LoginData(BaseModel):
    token: str
    user: UserOut


class MeData(BaseModel):
    user: UserOut


class SuccessResponse(BaseModel):
    success: bool = True


class LoginResponse(BaseModel):
    success: bool = True
    data: LoginData


class MeResponse(BaseModel):
    success: bool = True
    data: MeData


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_token(user_id: str, remember_me: bool) -> str:
    """Issue a signed JWT for the given user."""
    if remember_me:
        expire = datetime.now(timezone.utc) + timedelta(days=REMEMBER_TOKEN_EXPIRE_DAYS)
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)

    payload = {
        "sub": user_id,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a JWT.
    Raises HTTPException on any error.
    """
    if token in _TOKEN_BLACKLIST:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ErrorDetail(
                code="UNAUTHORIZED",
                message="Invalid or missing authentication token",
            ).model_dump(),
        )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ErrorDetail(
                code="TOKEN_EXPIRED",
                message="Your session has expired. Please log in again.",
            ).model_dump(),
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ErrorDetail(
                code="UNAUTHORIZED",
                message="Invalid or missing authentication token",
            ).model_dump(),
        )


def _get_user_by_id(user_id: str) -> dict[str, Any] | None:
    for u in _USERS.values():
        if u["id"] == user_id:
            return u
    return None


# ---------------------------------------------------------------------------
# Bearer dependency
# ---------------------------------------------------------------------------

_bearer = HTTPBearer(auto_error=False)


def _require_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> tuple[str, dict[str, Any]]:
    """
    Dependency that extracts + validates the Bearer token.
    Returns (raw_token, jwt_payload).
    """
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ErrorDetail(
                code="UNAUTHORIZED",
                message="Invalid or missing authentication token",
            ).model_dump(),
        )
    token = credentials.credentials
    payload = _decode_token(token)
    return token, payload


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post(
    "/login",
    response_model=LoginResponse,
    responses={
        401: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
    },
)
async def login(body: LoginRequest) -> LoginResponse:
    """Authenticate a user and return a JWT."""
    email_lower = body.email.lower()
    user = _USERS.get(email_lower)

    if user is None or not pwd_context.verify(body.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ErrorDetail(
                code="INVALID_CREDENTIALS",
                message="Invalid email or password",
            ).model_dump(),
        )

    # Update lastLoginAt
    now_iso = datetime.now(timezone.utc).isoformat()
    user["lastLoginAt"] = now_iso

    token = _make_token(user["id"], body.rememberMe)

    return LoginResponse(
        success=True,
        data=LoginData(
            token=token,
            user=UserOut(
                id=user["id"],
                email=user["email"],
                name=user["name"],
                role=user["role"],
                avatarUrl=user.get("avatarUrl"),
            ),
        ),
    )


@router.post(
    "/logout",
    response_model=SuccessResponse,
    responses={401: {"model": ErrorResponse}},
)
async def logout(
    auth: tuple[str, dict[str, Any]] = Depends(_require_token),
) -> SuccessResponse:
    """Blacklist the current token so it cannot be reused."""
    raw_token, _payload = auth
    _TOKEN_BLACKLIST.add(raw_token)
    return SuccessResponse(success=True)


@router.get(
    "/me",
    response_model=MeResponse,
    responses={401: {"model": ErrorResponse}},
)
async def me(
    auth: tuple[str, dict[str, Any]] = Depends(_require_token),
) -> MeResponse:
    """Return the profile of the currently authenticated user."""
    _raw_token, payload = auth
    user_id: str = payload.get("sub", "")
    user = _get_user_by_id(user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ErrorDetail(
                code="UNAUTHORIZED",
                message="Invalid or missing authentication token",
            ).model_dump(),
        )

    return MeResponse(
        success=True,
        data=MeData(
            user=UserOut(
                id=user["id"],
                email=user["email"],
                name=user["name"],
                role=user["role"],
                avatarUrl=user.get("avatarUrl"),
                lastLoginAt=user.get("lastLoginAt"),
            )
        ),
    )
