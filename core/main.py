"""Admin Panel — FastAPI entry point.

Currently exposes the login endpoint defined in
``.tasks/login-page/TECH_SPEC.md`` §4.1. All endpoints follow the
repo-wide envelope::

    { "success": bool, "data": object | null, "message": str }

422 responses additionally include an ``errors`` array with field-level
detail (see TECH_SPEC §4.1.4).
"""

from __future__ import annotations

import logging
import os
import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import bcrypt
import psycopg2
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import jwt
from pydantic import BaseModel, Field, ValidationError, field_validator

from database import get_connection, release_connection


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

JWT_SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY",
    "dev-secret-change-me-in-production-please-do-not-ship-this-default",
)
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # TECH_SPEC §6.1

# Email format mirrors TECH_SPEC §5.1 (kept loose deliberately — full RFC-5322
# is delegated to Pydantic's email validator if one is later swapped in).
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

logger = logging.getLogger("admin.auth")


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="Admin Panel API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Envelope helpers
# ---------------------------------------------------------------------------


def envelope(
    *,
    success: bool,
    data: Any = None,
    message: str = "",
    errors: Optional[list[dict]] = None,
) -> dict:
    body: dict = {"success": success, "data": data, "message": message}
    if errors is not None:
        body["errors"] = errors
    return body


# ---------------------------------------------------------------------------
# Request models / validation
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    """POST /api/auth/login body — see TECH_SPEC §5.

    The validators below produce error messages that map 1:1 onto the messages
    in TECH_SPEC §2.10. Empty / whitespace-only values are treated as
    "required" (not "too short") to match the spec's distinction between
    BR-2 and BR-4.
    """

    email: str = Field(...)
    password: str = Field(...)

    @field_validator("email", mode="before")
    @classmethod
    def _validate_email(cls, v: Any) -> str:
        if not isinstance(v, str):
            raise ValueError("Email is required")
        v = v.strip().lower()
        if not v:
            raise ValueError("Email is required")
        if len(v) > 255:
            raise ValueError("Email is too long")
        if not _EMAIL_RE.match(v):
            raise ValueError("Enter a valid email address")
        return v

    @field_validator("password", mode="before")
    @classmethod
    def _validate_password(cls, v: Any) -> str:
        if not isinstance(v, str):
            raise ValueError("Password is required")
        if not v:
            raise ValueError("Password is required")
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password is too long")
        return v


# Map a Pydantic ``missing`` error to the human-readable "required" message.
_MISSING_MESSAGES = {
    "email": "Email is required",
    "password": "Password is required",
}


def _format_field_errors(exc: RequestValidationError) -> list[dict]:
    out: list[dict] = []
    for err in exc.errors():
        loc = err.get("loc", ())
        # loc usually looks like ("body", "email") for body-field errors.
        field = next(
            (str(part) for part in reversed(loc) if isinstance(part, str) and part != "body"),
            "body",
        )
        err_type = err.get("type", "")
        msg = err.get("msg", "Invalid value")

        if err_type == "missing":
            msg = _MISSING_MESSAGES.get(field, f"{field} is required")
        elif err_type.startswith("value_error"):
            # Pydantic prefixes custom ValueError messages with "Value error, ".
            cleaned = msg
            if cleaned.startswith("Value error, "):
                cleaned = cleaned[len("Value error, "):]
            msg = cleaned

        out.append({"field": field, "message": msg})
    return out


# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------


@app.exception_handler(RequestValidationError)
async def _on_validation_error(request: Request, exc: RequestValidationError):
    """Translate FastAPI's default 422 into the repo envelope.

    A malformed JSON body (json_invalid) is reclassified as 400 per
    TECH_SPEC §4.1.3.
    """
    for err in exc.errors():
        if err.get("type") == "json_invalid":
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content=envelope(success=False, data=None, message="Malformed request"),
            )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=envelope(
            success=False,
            data=None,
            message="Validation failed",
            errors=_format_field_errors(exc),
        ),
    )


@app.exception_handler(Exception)
async def _on_unhandled(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=envelope(success=False, data=None, message="Internal server error"),
    )


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------


def _verify_password(plain: str, hashed: str) -> bool:
    """Return True iff ``plain`` matches the stored bcrypt hash. Never raises."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        # Malformed hash on disk → treat as auth failure, not 500.
        return False


def _create_access_token(*, user_id: str, email: str) -> tuple[str, int]:
    """Return (token, expires_in_seconds) for the given user."""
    iat = int(time.time())
    exp_seconds = ACCESS_TOKEN_EXPIRE_MINUTES * 60
    exp = iat + exp_seconds
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": iat,
        "exp": exp,
    }
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return token, exp_seconds


def _fetch_user_by_email(email: str) -> Optional[dict]:
    """Look up a user by lowercased email. Returns None if not found.

    Selects only the columns the login endpoint needs; ``password_hash``
    is included for verification but never returned to the client.
    """
    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, email, password_hash, name
                FROM users
                WHERE email = %s
                LIMIT 1
                """,
                (email,),
            )
            row = cur.fetchone()
        if row is None:
            return None
        return {
            "id": str(row[0]),
            "email": row[1],
            "password_hash": row[2],
            "name": row[3],
        }
    finally:
        release_connection(conn)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/api/health", tags=["meta"])
async def health() -> dict:
    return envelope(success=True, data={"status": "ok"}, message="")


@app.post("/api/auth/login", tags=["auth"])
async def login(body: LoginRequest) -> JSONResponse:
    """Authenticate an admin user and return a JWT.

    See TECH_SPEC §4.1 for the full contract:
    - 200: ``{ token, token_type, expires_in, user }``
    - 401: identical body for "user not found" and "bad password"
    - 422 / 400 / 500 are produced by the handlers above.
    """
    user = _fetch_user_by_email(body.email)
    if user is None or not _verify_password(body.password, user["password_hash"]):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content=envelope(success=False, data=None, message="Invalid credentials"),
        )

    token, expires_in = _create_access_token(user_id=user["id"], email=user["email"])

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=envelope(
            success=True,
            data={
                "token": token,
                "token_type": "Bearer",
                "expires_in": expires_in,
                "user": {
                    "id": user["id"],
                    "email": user["email"],
                    "name": user["name"],
                },
            },
            message="Login successful",
        ),
    )
