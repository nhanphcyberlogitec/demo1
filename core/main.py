"""Admin Panel backend — login API.

Implements POST /api/auth/login per `.tasks/login-page/TECH_SPEC.md`
(§5.1, §6, §7, §8, §9, §10, §11).

- Envelope: every response is `{success, data, message}`.
- HTTP: 200 success, 401 invalid credentials, 422 validation,
  429 rate-limited, 500 unexpected.
- Auth: bcrypt password verify, JWT HS256, 60 min TTL, claims
  `{sub, email, iat, exp}`.
- Rate limit: 5 failed attempts / 60 s / client IP. Successful
  login clears the counter for that IP.
- Anti-enumeration: the 401 body is byte-identical for unknown
  email, wrong password, and inactive user.
- Structured log: `auth.login attempt email=<..> ip=<..>
  success=<true|false> reason=<ok|invalid_credentials|inactive|
  validation|rate_limited>`.
"""

from __future__ import annotations

import json
import logging
import os
import re
import threading
import time
from collections import deque
from typing import Any, Deque, Dict, Optional

import bcrypt
import psycopg2.extras
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import jwt

from database import get_connection, release_connection

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

JWT_SECRET = os.getenv("JWT_SECRET", "dev-local-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_TTL_SECONDS = 60 * 60  # 60 minutes

# TECH_SPEC §6.1 — server is source of truth for email format.
EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

# TECH_SPEC §7 — verbatim user-visible copy.
GENERIC_AUTH_ERROR = "Invalid email or password"
GENERIC_SERVER_ERROR = "Something went wrong. Please try again."

# TECH_SPEC §9 — rate-limit policy.
RATE_LIMIT_WINDOW_SECONDS = 60
RATE_LIMIT_THRESHOLD = 5
RATE_LIMIT_RETRY_AFTER = 60
RATE_LIMIT_MESSAGE = (
    f"Too many login attempts. Try again in {RATE_LIMIT_RETRY_AFTER} seconds."
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("auth")


def _log_login_attempt(
    email: Optional[str], ip: str, success: bool, reason: str
) -> None:
    """Emit the TECH_SPEC §11 structured line.

    Never logs passwords or tokens.
    """
    safe_email = (email or "").replace(" ", "_")
    logger.info(
        "auth.login attempt email=%s ip=%s success=%s reason=%s",
        safe_email or "-",
        ip,
        "true" if success else "false",
        reason,
    )


# ---------------------------------------------------------------------------
# App + CORS
# ---------------------------------------------------------------------------

app = FastAPI()

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


def _envelope(success: bool, data: Any = None, message: str = "") -> dict:
    return {"success": success, "data": data, "message": message}


def _error_response(
    status_code: int, message: str, headers: Optional[Dict[str, str]] = None
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=_envelope(False, None, message),
        headers=headers or {},
    )


def _success_response(data: Any) -> JSONResponse:
    return JSONResponse(status_code=200, content=_envelope(True, data, ""))


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------


def _create_access_token(user_id: str, email: str) -> str:
    issued_at = int(time.time())
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": issued_at,
        "exp": issued_at + JWT_TTL_SECONDS,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# ---------------------------------------------------------------------------
# Rate limiter (in-process sliding window per IP)
# ---------------------------------------------------------------------------


class _SlidingWindowLimiter:
    """5 failed / 60 s / IP. Successful logins clear the IP's counter.

    Implementation: per-IP deque of failure timestamps. On each check,
    prune timestamps older than the window; count the remainder.
    """

    def __init__(self, window_seconds: int, threshold: int) -> None:
        self._window = window_seconds
        self._threshold = threshold
        self._buckets: Dict[str, Deque[float]] = {}
        self._lock = threading.Lock()

    def _prune(self, bucket: Deque[float], now: float) -> None:
        cutoff = now - self._window
        while bucket and bucket[0] < cutoff:
            bucket.popleft()

    def is_blocked(self, ip: str) -> bool:
        now = time.monotonic()
        with self._lock:
            bucket = self._buckets.get(ip)
            if not bucket:
                return False
            self._prune(bucket, now)
            return len(bucket) >= self._threshold

    def record_failure(self, ip: str) -> None:
        now = time.monotonic()
        with self._lock:
            bucket = self._buckets.setdefault(ip, deque())
            self._prune(bucket, now)
            bucket.append(now)

    def record_success(self, ip: str) -> None:
        with self._lock:
            self._buckets.pop(ip, None)

    def reset(self) -> None:
        """Test hook — clear all state."""
        with self._lock:
            self._buckets.clear()


rate_limiter = _SlidingWindowLimiter(
    window_seconds=RATE_LIMIT_WINDOW_SECONDS,
    threshold=RATE_LIMIT_THRESHOLD,
)


def _client_ip(request: Request) -> str:
    """Best-effort client IP extraction.

    Honors X-Forwarded-For (first hop) if present (reverse proxies in
    deployment). Falls back to the socket peer. Never None.
    """
    xff = request.headers.get("x-forwarded-for")
    if xff:
        first = xff.split(",")[0].strip()
        if first:
            return first
    client = request.client
    if client and client.host:
        return client.host
    return "unknown"


# ---------------------------------------------------------------------------
# Persistence (users)
# ---------------------------------------------------------------------------


def _find_user_by_email(email_lower: str) -> Optional[dict]:
    """Look up a user row by lower(email).

    Columns per TECH_SPEC §4.1: id, email, password_hash, name, is_active.
    Returns None if no row matches. Never exposes password_hash to callers
    other than _verify_password.
    """
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, email, password_hash, name, is_active
                FROM users
                WHERE lower(email) = %s
                LIMIT 1
                """,
                (email_lower,),
            )
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        release_connection(conn)


def _verify_password(plaintext: str, bcrypt_hash: str) -> bool:
    try:
        return bcrypt.checkpw(
            plaintext.encode("utf-8"), bcrypt_hash.encode("utf-8")
        )
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# POST /api/auth/login
# ---------------------------------------------------------------------------


@app.post("/api/auth/login")
async def login(request: Request):
    """Authenticate an administrator.

    Contract: `.tasks/login-page/TECH_SPEC.md` §5.1.
    """
    ip = _client_ip(request)
    email_for_log: Optional[str] = None

    try:
        # 1. Rate-limit gate FIRST (before any DB / bcrypt work).
        if rate_limiter.is_blocked(ip):
            _log_login_attempt(None, ip, False, "rate_limited")
            return _error_response(
                429,
                RATE_LIMIT_MESSAGE,
                headers={"Retry-After": str(RATE_LIMIT_RETRY_AFTER)},
            )

        # 2. Parse body. Must be JSON object.
        raw_body = await request.body()
        try:
            body = json.loads(raw_body) if raw_body else None
        except (ValueError, json.JSONDecodeError):
            _log_login_attempt(None, ip, False, "validation")
            return _error_response(422, "Invalid request body")

        if not isinstance(body, dict):
            _log_login_attempt(None, ip, False, "validation")
            return _error_response(422, "Invalid request body")

        # 3. Validate fields in documented order (TECH_SPEC §6).
        email_raw = body.get("email")
        password_raw = body.get("password")

        if not isinstance(email_raw, str) or email_raw.strip() == "":
            _log_login_attempt(None, ip, False, "validation")
            return _error_response(422, "Email is required")

        email_lower = email_raw.strip().lower()
        email_for_log = email_lower

        if len(email_lower) > 255 or not EMAIL_REGEX.match(email_lower):
            _log_login_attempt(email_for_log, ip, False, "validation")
            return _error_response(422, "Email is invalid")

        if not isinstance(password_raw, str) or len(password_raw) == 0:
            _log_login_attempt(email_for_log, ip, False, "validation")
            return _error_response(422, "Password is required")

        if len(password_raw) < 6:
            _log_login_attempt(email_for_log, ip, False, "validation")
            return _error_response(
                422, "Password must be at least 6 characters"
            )

        # 4. Lookup user + verify. Failures are byte-identical (§10, AC-18).
        user = _find_user_by_email(email_lower)

        if user is None:
            rate_limiter.record_failure(ip)
            _log_login_attempt(email_for_log, ip, False, "invalid_credentials")
            return _error_response(401, GENERIC_AUTH_ERROR)

        if not _verify_password(password_raw, user["password_hash"]):
            rate_limiter.record_failure(ip)
            _log_login_attempt(email_for_log, ip, False, "invalid_credentials")
            return _error_response(401, GENERIC_AUTH_ERROR)

        if not user.get("is_active", False):
            rate_limiter.record_failure(ip)
            _log_login_attempt(email_for_log, ip, False, "inactive")
            # Identical envelope to the two above (AC-18).
            return _error_response(401, GENERIC_AUTH_ERROR)

        # 5. Success. Reset the IP counter (§9) and return JWT + user.
        rate_limiter.record_success(ip)
        token = _create_access_token(str(user["id"]), user["email"])

        _log_login_attempt(email_for_log, ip, True, "ok")
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
        _log_login_attempt(email_for_log, ip, False, "server_error")
        return _error_response(500, GENERIC_SERVER_ERROR)
