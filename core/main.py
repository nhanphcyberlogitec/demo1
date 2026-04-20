import json
import logging
import os
import re
import time
from typing import Any, Optional

import bcrypt
import psycopg2.extras
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import jwt

from database import get_connection, release_connection

logger = logging.getLogger(__name__)

JWT_SECRET = os.getenv("JWT_SECRET", "dev-local-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_TTL_SECONDS = 60 * 60

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

GENERIC_AUTH_ERROR = "Invalid email or password"
GENERIC_SERVER_ERROR = "Something went wrong. Please try again."

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _envelope(success: bool, data: Any = None, message: str = "") -> dict:
    return {"success": success, "data": data, "message": message}


def _error_response(status_code: int, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=_envelope(False, None, message),
    )


def _success_response(data: Any) -> JSONResponse:
    return JSONResponse(status_code=200, content=_envelope(True, data, ""))


def _create_access_token(user_id: str, email: str) -> str:
    issued_at = int(time.time())
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": issued_at,
        "exp": issued_at + JWT_TTL_SECONDS,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _find_user_by_email(email_lower: str) -> Optional[dict]:
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id, email, password_hash, name "
                "FROM users WHERE lower(email) = %s LIMIT 1",
                (email_lower,),
            )
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        release_connection(conn)


def _verify_password(plaintext: str, bcrypt_hash: str) -> bool:
    try:
        return bcrypt.checkpw(plaintext.encode("utf-8"), bcrypt_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


@app.post("/api/auth/login")
async def login(request: Request):
    try:
        raw_body = await request.body()
        try:
            body = json.loads(raw_body) if raw_body else None
        except (ValueError, json.JSONDecodeError):
            return _error_response(422, "Invalid request body")

        if not isinstance(body, dict):
            return _error_response(422, "Invalid request body")

        email_raw = body.get("email")
        password_raw = body.get("password")

        if not isinstance(email_raw, str) or email_raw.strip() == "":
            return _error_response(422, "Email is required")

        email_lower = email_raw.strip().lower()

        if not EMAIL_REGEX.match(email_lower):
            return _error_response(422, "Please enter a valid email address")

        if not isinstance(password_raw, str) or len(password_raw) < 1:
            return _error_response(422, "Password is required")

        user = _find_user_by_email(email_lower)
        if user is None:
            return _error_response(401, GENERIC_AUTH_ERROR)

        if not _verify_password(password_raw, user["password_hash"]):
            return _error_response(401, GENERIC_AUTH_ERROR)

        token = _create_access_token(str(user["id"]), email_lower)

        return _success_response(
            {
                "token": token,
                "user": {
                    "id": str(user["id"]),
                    "email": user["email"],
                    "name": user.get("name"),
                },
            }
        )
    except Exception:
        logger.exception("Unexpected error during login")
        return _error_response(500, GENERIC_SERVER_ERROR)
