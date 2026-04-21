"""FastAPI entry point for the Admin Panel backend.

Currently implements a single endpoint:
    POST /api/auth/login

See `.tasks/login-page/TECH_SPEC.md` §4 for the full contract. This module is
the single source of truth for request/response shapes and status codes until
the routing layer grows large enough to warrant splitting.
"""

from __future__ import annotations

import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import bcrypt
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import jwt
from pydantic import BaseModel, ConfigDict, field_validator

import database

# ----------------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------------

# JWT config per TECH_SPEC §8.1: HS256, 60-minute expiry. The secret defaults to
# a development placeholder; production MUST supply JWT_SECRET via environment.
JWT_SECRET = os.getenv("JWT_SECRET", "dev-insecure-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_MINUTES = 60

# Simple RFC-lite email regex from TECH_SPEC §5.1.
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

# ----------------------------------------------------------------------------
# App + CORS
# ----------------------------------------------------------------------------

app = FastAPI(title="Admin Panel API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------------------------------------------------------------
# Response helpers — always shape the envelope { success, data, message }
# ----------------------------------------------------------------------------


def _ok(data: Any, message: str = "") -> Dict[str, Any]:
    return {"success": True, "data": data, "message": message}


def _err(status: int, message: str, data: Any = None) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"success": False, "data": data, "message": message},
    )


# ----------------------------------------------------------------------------
# Pydantic model
# ----------------------------------------------------------------------------


class LoginRequest(BaseModel):
    """Login request body.

    Validators emit exactly the messages listed in TECH_SPEC §5 so the custom
    422 handler can forward them verbatim as safe, user-facing copy.
    """

    # validate_default=True ensures our custom validators fire even when the
    # client omits the field entirely — giving us "Email/Password is required"
    # copy instead of Pydantic's default "Field required" text.
    model_config = ConfigDict(validate_default=True)

    email: str = ""
    password: str = ""

    @field_validator("email", mode="before")
    @classmethod
    def _validate_email(cls, v: Any) -> str:
        if v is None:
            v = ""
        if not isinstance(v, str):
            raise ValueError("Email is required")
        v = v.strip()
        if not v:
            raise ValueError("Email is required")
        if len(v) > 254:
            raise ValueError("Email is too long")
        if not _EMAIL_RE.match(v):
            raise ValueError("Enter a valid email address")
        return v.lower()

    @field_validator("password", mode="before")
    @classmethod
    def _validate_password(cls, v: Any) -> str:
        if v is None:
            v = ""
        if not isinstance(v, str):
            raise ValueError("Password is required")
        if not v:
            raise ValueError("Password is required")
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password is too long")
        return v


# ----------------------------------------------------------------------------
# Exception handlers — reshape FastAPI defaults to our envelope
# ----------------------------------------------------------------------------


def _strip_value_error_prefix(msg: str) -> str:
    # Pydantic v2 prefixes ValueError messages with "Value error, ".
    prefix = "Value error, "
    return msg[len(prefix):] if msg.startswith(prefix) else msg


def _fallback_message_for(field: str, err_type: str) -> str:
    """Fallback copy for errors raised by Pydantic itself (missing, type, etc)."""
    if field == "email":
        return "Email is required"
    if field == "password":
        return "Password is required"
    return "Invalid value"


@app.exception_handler(RequestValidationError)
async def handle_validation_error(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors: Dict[str, str] = {}
    for err in exc.errors():
        loc = err.get("loc", ())
        # loc is typically ("body", "<field>"); body-level errors are just ("body",)
        field = loc[-1] if len(loc) >= 2 else "body"
        if not isinstance(field, str):
            field = str(field)

        err_type = err.get("type", "")
        raw_msg = err.get("msg", "")
        if err_type.startswith("value_error"):
            msg = _strip_value_error_prefix(raw_msg)
        else:
            msg = _fallback_message_for(field, err_type)

        # Keep first error per field (matches TECH_SPEC §4.3 "Only fields that
        # failed are present" — one message each).
        errors.setdefault(field, msg)

    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "data": {"errors": errors},
            "message": "Validation failed",
        },
    )


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    # Defense-in-depth 500 envelope per TECH_SPEC §4.3.
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "data": None,
            "message": "Internal server error",
        },
    )


# ----------------------------------------------------------------------------
# DB lookup (module-level so tests can monkeypatch it)
# ----------------------------------------------------------------------------


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Fetch a user by normalized email. Returns None if no match.

    `email` is expected to be already trim+lowercased by the Pydantic validator.
    The SQL uses lower(email) to leverage the `users_email_key` unique index
    from DB_SCHEMA.md §3.3 and to stay safe even if a caller forgets to
    normalize.
    """
    conn = database.get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, password_hash FROM users WHERE lower(email) = %s",
                (email,),
            )
            row = cur.fetchone()
            if row is None:
                return None
            return {
                "id": str(row[0]),
                "email": row[1],
                "password_hash": row[2],
            }
    finally:
        database.release_connection(conn)


# ----------------------------------------------------------------------------
# JWT helper
# ----------------------------------------------------------------------------


def create_access_token(*, user_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRY_MINUTES)
    payload = {"sub": user_id, "email": email, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# ----------------------------------------------------------------------------
# Routes
# ----------------------------------------------------------------------------


@app.post("/api/auth/login")
def login(req: LoginRequest):
    """Authenticate an admin user and issue a short-lived JWT.

    Contract: TECH_SPEC §4 / §5 / §8.1. Returns identical 401 for
    unknown-email and wrong-password to avoid user enumeration.
    """
    user = get_user_by_email(req.email)
    if user is None:
        return _err(401, "Invalid email or password")

    try:
        password_ok = bcrypt.checkpw(
            req.password.encode("utf-8"),
            user["password_hash"].encode("utf-8"),
        )
    except (ValueError, TypeError):
        # Malformed hash in DB — treat as auth failure, don't leak detail.
        password_ok = False

    if not password_ok:
        return _err(401, "Invalid email or password")

    token = create_access_token(user_id=str(user["id"]), email=user["email"])

    return _ok(
        {
            "token": token,
            "user": {
                "id": str(user["id"]),
                "email": user["email"],
            },
        },
        message="Login successful",
    )
