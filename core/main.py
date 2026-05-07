"""FastAPI entry point for the Admin Panel backend.

Implements:
    POST /api/auth/login                 — see `.tasks/login-page/TECH_SPEC.md` §4.
    GET  /api/users                      — see `.tasks/dashboard-user-crud/TECH_SPEC.md` §5.2.
    POST /api/users                      — see TECH_SPEC §5.3.
    PATCH /api/users/{id}                — see TECH_SPEC §5.4.
    DELETE /api/users/{id}               — see TECH_SPEC §5.5.

This module is the single source of truth for request/response shapes and
status codes until the routing layer grows large enough to warrant splitting.
"""

from __future__ import annotations

import os
import re
import uuid as uuid_lib
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

import bcrypt
import psycopg2
from fastapi import Depends, FastAPI, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import jwt
from pydantic import BaseModel, ConfigDict, field_validator
from starlette.exceptions import HTTPException as StarletteHTTPException

import database

# ----------------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------------

# JWT config per TECH_SPEC §8.1: HS256, 60-minute expiry. The secret defaults to
# a development placeholder; production MUST supply JWT_SECRET via environment.
JWT_SECRET = os.getenv("JWT_SECRET", "dev-insecure-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_MINUTES = 60

# Simple RFC-lite email regex from `.tasks/login-page/TECH_SPEC.md` §5.1 and
# `.tasks/dashboard-user-crud/TECH_SPEC.md` §6.1 — same regex on both sides.
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

# Role enum per dashboard-user-crud TECH_SPEC §6.3.
_VALID_ROLES = {"admin", "user"}

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


def _ok(data: Any, message: str = "", status: int = 200) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"success": True, "data": data, "message": message},
    )


def _err(status: int, message: str, data: Any = None) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"success": False, "data": data, "message": message},
    )


def _user_to_dto(row: Tuple[Any, ...]) -> Dict[str, Any]:
    """Shape a (id, email, name, role, created_at, updated_at) tuple into the
    public UserDTO. `password_hash` is never selected into this function and
    never appears in any response (TECH_SPEC §8 AC-19).
    """
    created_at = row[4]
    updated_at = row[5]
    return {
        "id": str(row[0]),
        "email": row[1],
        "name": row[2],
        "role": row[3],
        "created_at": created_at.isoformat() if isinstance(created_at, datetime) else created_at,
        "updated_at": updated_at.isoformat() if isinstance(updated_at, datetime) else updated_at,
    }


# ----------------------------------------------------------------------------
# Pydantic models — every validator emits the exact §6 message text so the
# RequestValidationError handler can forward it verbatim as user-facing copy.
# ----------------------------------------------------------------------------


class LoginRequest(BaseModel):
    """Login request body (login TECH_SPEC §4)."""

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


# Helpers shared by Create/Update validators so both emit identical copy.
def _check_email(v: Any) -> str:
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


def _check_name(v: Any) -> str:
    if not isinstance(v, str):
        raise ValueError("Name is required")
    v = v.strip()
    if not v:
        raise ValueError("Name is required")
    if len(v) > 100:
        raise ValueError("Name is too long")
    return v


def _check_role(v: Any) -> str:
    if not isinstance(v, str):
        raise ValueError("Role is required")
    v = v.strip()
    if not v:
        raise ValueError("Role is required")
    if v not in _VALID_ROLES:
        raise ValueError("Invalid role")
    return v


def _check_password(v: Any) -> str:
    if not isinstance(v, str):
        raise ValueError("Password is required")
    if not v:
        raise ValueError("Password is required")
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters")
    if len(v) > 128:
        raise ValueError("Password is too long")
    return v


class CreateUserRequest(BaseModel):
    """POST /api/users body (TECH_SPEC §5.3, §6).

    All fields required (server defaults role to 'user' when missing per §6.3).
    `validate_default=True` ensures missing fields run their validator and emit
    a ValueError with the §6 message (instead of Pydantic's "Field required").
    """

    model_config = ConfigDict(validate_default=True)

    email: str = ""
    name: str = ""
    role: str = "user"
    password: str = ""

    @field_validator("email", mode="before")
    @classmethod
    def _v_email(cls, v: Any) -> str:
        if v is None:
            v = ""
        return _check_email(v)

    @field_validator("name", mode="before")
    @classmethod
    def _v_name(cls, v: Any) -> str:
        if v is None:
            v = ""
        return _check_name(v)

    @field_validator("role", mode="before")
    @classmethod
    def _v_role(cls, v: Any) -> str:
        # `None` and missing both fall back to the field default 'user' before
        # we get here (Pydantic uses the default), so we always validate a
        # concrete string. An explicit empty string still triggers
        # "Role is required".
        if v is None:
            v = "user"
        return _check_role(v)

    @field_validator("password", mode="before")
    @classmethod
    def _v_password(cls, v: Any) -> str:
        if v is None:
            v = ""
        return _check_password(v)


class UpdateUserRequest(BaseModel):
    """PATCH /api/users/{id} body (TECH_SPEC §5.4, §6).

    All fields optional. `None` (and absent) means "do not change". Empty
    string explicitly fails validation (e.g. clearing a required field is
    not allowed).
    """

    email: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def _v_email(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        return _check_email(v)

    @field_validator("name", mode="before")
    @classmethod
    def _v_name(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        return _check_name(v)

    @field_validator("role", mode="before")
    @classmethod
    def _v_role(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        return _check_role(v)

    @field_validator("password", mode="before")
    @classmethod
    def _v_password(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        return _check_password(v)


# ----------------------------------------------------------------------------
# Exception handlers — reshape FastAPI / Starlette defaults into our envelope
# ----------------------------------------------------------------------------


def _strip_value_error_prefix(msg: str) -> str:
    # Pydantic v2 prefixes ValueError messages with "Value error, ".
    prefix = "Value error, "
    return msg[len(prefix):] if msg.startswith(prefix) else msg


def _fallback_message_for(field: str, err_type: str) -> str:
    """Fallback copy for errors raised by Pydantic itself (missing, type, etc).

    Our validators run with `mode="before"` and `validate_default=True`, so in
    practice this fallback is rarely hit — but if Pydantic produces a non-
    `value_error` (e.g. wrong JSON type at the top level), pick a sensible
    user-facing message keyed on the field name.
    """
    if field == "email":
        return "Email is required"
    if field == "password":
        return "Password is required"
    if field == "name":
        return "Name is required"
    if field == "role":
        return "Role is required"
    if field == "page":
        return "Page must be a positive integer"
    if field == "limit":
        return "Limit must be between 1 and 100"
    return "Invalid value"


@app.exception_handler(RequestValidationError)
async def handle_validation_error(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors: Dict[str, str] = {}
    for err in exc.errors():
        loc = err.get("loc", ())
        # loc is typically ("body", "<field>"); body-level errors are just ("body",).
        field = loc[-1] if len(loc) >= 2 else "body"
        if not isinstance(field, str):
            field = str(field)

        err_type = err.get("type", "")
        raw_msg = err.get("msg", "")
        if err_type.startswith("value_error"):
            msg = _strip_value_error_prefix(raw_msg)
        else:
            msg = _fallback_message_for(field, err_type)

        # Keep first error per field — one message each.
        errors.setdefault(field, msg)

    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "data": {"errors": errors},
            "message": "Validation failed",
        },
    )


@app.exception_handler(StarletteHTTPException)
async def handle_http_exception(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    """Reshape any HTTPException (incl. 401 from `current_user`) into the envelope."""
    detail = exc.detail
    message = detail if isinstance(detail, str) else (str(detail) if detail else "")
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "data": None, "message": message},
    )


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    # Defense-in-depth 500 envelope.
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "data": None,
            "message": "Internal server error",
        },
    )


# ----------------------------------------------------------------------------
# DB lookups (module-level so tests can monkeypatch them)
# ----------------------------------------------------------------------------


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Fetch a user by normalized email. Returns None if no match.

    `email` is expected to be already trim+lowercased by the Pydantic
    validator. The SQL uses lower(email) so the case-insensitive unique index
    `users_email_lower_key` (DB_SCHEMA.md §3.3) is hit and the lookup stays
    safe even if a caller forgets to normalize.
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


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Resolve a JWT `sub` to a current user row.

    Returns {id, email, role} or None if the id is malformed or no row exists.
    `password_hash` is intentionally not selected (TECH_SPEC §8 AC-19).
    """
    try:
        uuid_lib.UUID(str(user_id))
    except (ValueError, AttributeError, TypeError):
        return None

    conn = database.get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, role FROM users WHERE id = %s",
                (user_id,),
            )
            row = cur.fetchone()
            if row is None:
                return None
            return {"id": str(row[0]), "email": row[1], "role": row[2]}
    finally:
        database.release_connection(conn)


# ----------------------------------------------------------------------------
# JWT helpers + bearer dependency (TECH_SPEC §7.1)
# ----------------------------------------------------------------------------


def create_access_token(*, user_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRY_MINUTES)
    payload = {"sub": user_id, "email": email, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def current_user(
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> Dict[str, Any]:
    """Bearer-JWT dependency for every protected endpoint.

    Returns {id, email, role} for the authenticated user. Raises 401
    "Not authenticated" on any failure (missing header, malformed scheme,
    decode/signature/expiry failure, or `sub` resolves to no row).
    """
    if not authorization:
        raise StarletteHTTPException(status_code=401, detail="Not authenticated")

    parts = authorization.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise StarletteHTTPException(status_code=401, detail="Not authenticated")

    token = parts[1].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:  # JWTError, ExpiredSignatureError, JWTClaimsError, etc.
        raise StarletteHTTPException(status_code=401, detail="Not authenticated")

    sub = payload.get("sub")
    if not sub:
        raise StarletteHTTPException(status_code=401, detail="Not authenticated")

    user = get_user_by_id(str(sub))
    if user is None:
        raise StarletteHTTPException(status_code=401, detail="Not authenticated")
    return user


# ----------------------------------------------------------------------------
# Search / SQL helpers
# ----------------------------------------------------------------------------


def _escape_like(term: str) -> str:
    """Escape `\\`, `%`, and `_` so user input can't unintentionally act as a
    LIKE wildcard. Postgres's default LIKE escape character is `\\`; pair this
    helper with `LIKE '...' ` (no `ESCAPE` clause needed when default applies).
    """
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


# ----------------------------------------------------------------------------
# Routes — auth
# ----------------------------------------------------------------------------


@app.post("/api/auth/login")
def login(req: LoginRequest):
    """Authenticate an admin user and issue a short-lived JWT.

    Contract: login TECH_SPEC §4 / §5 / §8.1. Returns identical 401 for
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


# ----------------------------------------------------------------------------
# Routes — users CRUD (TECH_SPEC §5)
# ----------------------------------------------------------------------------


def _validate_uuid(user_id: str) -> bool:
    try:
        uuid_lib.UUID(user_id)
        return True
    except (ValueError, AttributeError, TypeError):
        return False


@app.get("/api/users")
def list_users(request: Request, _user: Dict[str, Any] = Depends(current_user)):
    """List users — paginated, optional case-insensitive search on email/name.

    Contract: TECH_SPEC §5.2. Ordering: `created_at DESC, id ASC`.
    Search uses `lower(col) LIKE` with `%` and `_` escaped (TECH_SPEC §6.6).
    """
    q_raw = request.query_params.get("q", "")
    page_raw = request.query_params.get("page", "1")
    limit_raw = request.query_params.get("limit", "10")

    errors: Dict[str, str] = {}

    try:
        page = int(page_raw)
        if page < 1:
            errors["page"] = "Page must be a positive integer"
    except (ValueError, TypeError):
        errors["page"] = "Page must be a positive integer"
        page = 0  # placeholder to keep type-checker happy; not used on error path

    try:
        limit = int(limit_raw)
        if limit < 1 or limit > 100:
            errors["limit"] = "Limit must be between 1 and 100"
    except (ValueError, TypeError):
        errors["limit"] = "Limit must be between 1 and 100"
        limit = 0

    if errors:
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "data": {"errors": errors},
                "message": "Validation failed",
            },
        )

    q_norm = (q_raw or "").strip()

    where_clause = ""
    where_params: Tuple[Any, ...] = ()
    if q_norm:
        pattern = f"%{_escape_like(q_norm.lower())}%"
        where_clause = " WHERE lower(email) LIKE %s OR lower(name) LIKE %s"
        where_params = (pattern, pattern)

    conn = database.get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT count(*) FROM users{where_clause}", where_params)
            total = int(cur.fetchone()[0])

            offset = (page - 1) * limit
            cur.execute(
                f"SELECT id, email, name, role, created_at, updated_at FROM users"
                f"{where_clause} ORDER BY created_at DESC, id ASC "
                "LIMIT %s OFFSET %s",
                where_params + (limit, offset),
            )
            rows = cur.fetchall()
    finally:
        database.release_connection(conn)

    items = [_user_to_dto(r) for r in rows]
    total_pages = (total + limit - 1) // limit if total > 0 else 0

    return _ok(
        {
            "items": items,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": total_pages,
            },
        }
    )


@app.post("/api/users")
def create_user(
    body: CreateUserRequest, _user: Dict[str, Any] = Depends(current_user)
):
    """Create a new user (TECH_SPEC §5.3).

    422 with `data.errors.email = "Email already in use"` on duplicate.
    Password is bcrypt-hashed; never echoed back in the response.
    """
    conn = database.get_connection()
    try:
        with conn.cursor() as cur:
            # Pre-check uniqueness so we can emit the field-keyed 422 message.
            cur.execute(
                "SELECT 1 FROM users WHERE lower(email) = %s",
                (body.email,),
            )
            if cur.fetchone() is not None:
                conn.rollback()
                return _err(
                    422,
                    "Email already in use",
                    {"errors": {"email": "Email already in use"}},
                )

            password_hash = bcrypt.hashpw(
                body.password.encode("utf-8"), bcrypt.gensalt()
            ).decode("utf-8")

            try:
                cur.execute(
                    "INSERT INTO users (email, password_hash, name, role) "
                    "VALUES (%s, %s, %s, %s) "
                    "RETURNING id, email, name, role, created_at, updated_at",
                    (body.email, password_hash, body.name, body.role),
                )
            except psycopg2.errors.UniqueViolation:
                # Race window between pre-check and insert — same shape.
                conn.rollback()
                return _err(
                    422,
                    "Email already in use",
                    {"errors": {"email": "Email already in use"}},
                )

            row = cur.fetchone()
            conn.commit()
    finally:
        database.release_connection(conn)

    return _ok(_user_to_dto(row), message="User created", status=201)


@app.patch("/api/users/{user_id}")
def update_user(
    user_id: str,
    body: UpdateUserRequest,
    current: Dict[str, Any] = Depends(current_user),
):
    """Partial-update a user (TECH_SPEC §5.4).

    Only fields explicitly sent by the client are changed (`exclude_unset`).
    Email uniqueness is checked excluding the current row. The "last admin"
    rule (§7.3) runs inside the same transaction as the write.
    """
    if not _validate_uuid(user_id):
        return _err(404, "User not found")

    # `exclude_unset=True` distinguishes "field not sent" from "field set to None"
    # — we want to ignore the former and validate the latter (validators above
    # treat None as "no change", so an explicit null is also a no-op for that
    # field, but it'll still appear in the dict here).
    changes = body.model_dump(exclude_unset=True)
    # Drop None values — they are explicit no-ops per the validator contract.
    changes = {k: v for k, v in changes.items() if v is not None}

    if not changes:
        return _err(
            422,
            "Validation failed",
            {"errors": {"_": "No changes provided"}},
        )

    conn = database.get_connection()
    try:
        with conn.cursor() as cur:
            # Lock the target row for the duration of the txn so the last-admin
            # check is consistent with the write.
            cur.execute(
                "SELECT id, email, name, role FROM users WHERE id = %s FOR UPDATE",
                (user_id,),
            )
            row = cur.fetchone()
            if row is None:
                conn.rollback()
                return _err(404, "User not found")

            current_email, _current_name, current_role = row[1], row[2], row[3]

            # Email uniqueness — excluding self.
            if "email" in changes and changes["email"] != current_email:
                cur.execute(
                    "SELECT 1 FROM users WHERE lower(email) = %s AND id <> %s",
                    (changes["email"], user_id),
                )
                if cur.fetchone() is not None:
                    conn.rollback()
                    return _err(
                        422,
                        "Email already in use",
                        {"errors": {"email": "Email already in use"}},
                    )

            # Last-admin demotion check (TECH_SPEC §7.3).
            if (
                "role" in changes
                and current_role == "admin"
                and changes["role"] != "admin"
            ):
                cur.execute(
                    "SELECT count(*) FROM users WHERE role = 'admin' AND id <> %s",
                    (user_id,),
                )
                other_admins = int(cur.fetchone()[0])
                if other_admins == 0:
                    conn.rollback()
                    return _err(
                        422,
                        "Cannot remove the last administrator",
                        {"errors": {"role": "Cannot remove the last administrator"}},
                    )

            # Build UPDATE.
            set_clauses = []
            params: list = []
            for field in ("email", "name", "role"):
                if field in changes:
                    set_clauses.append(f"{field} = %s")
                    params.append(changes[field])
            if "password" in changes:
                hashed = bcrypt.hashpw(
                    changes["password"].encode("utf-8"), bcrypt.gensalt()
                ).decode("utf-8")
                set_clauses.append("password_hash = %s")
                params.append(hashed)
            set_clauses.append("updated_at = now()")

            params.append(user_id)
            try:
                cur.execute(
                    f"UPDATE users SET {', '.join(set_clauses)} WHERE id = %s "
                    "RETURNING id, email, name, role, created_at, updated_at",
                    tuple(params),
                )
            except psycopg2.errors.UniqueViolation:
                conn.rollback()
                return _err(
                    422,
                    "Email already in use",
                    {"errors": {"email": "Email already in use"}},
                )

            updated = cur.fetchone()
            conn.commit()
    finally:
        database.release_connection(conn)

    return _ok(_user_to_dto(updated), message="User updated")


@app.delete("/api/users/{user_id}")
def delete_user(
    user_id: str, current: Dict[str, Any] = Depends(current_user)
):
    """Hard-delete a user (TECH_SPEC §5.5).

    Self-delete: 400 "You cannot delete your own account". Last-admin: 400
    "Cannot remove the last administrator". The last-admin check runs in the
    same transaction as the DELETE.
    """
    if not _validate_uuid(user_id):
        return _err(404, "User not found")

    if user_id == current["id"]:
        return _err(400, "You cannot delete your own account")

    conn = database.get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, role FROM users WHERE id = %s FOR UPDATE",
                (user_id,),
            )
            row = cur.fetchone()
            if row is None:
                conn.rollback()
                return _err(404, "User not found")

            target_role = row[1]
            if target_role == "admin":
                cur.execute(
                    "SELECT count(*) FROM users WHERE role = 'admin' AND id <> %s",
                    (user_id,),
                )
                other_admins = int(cur.fetchone()[0])
                if other_admins == 0:
                    conn.rollback()
                    return _err(400, "Cannot remove the last administrator")

            cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
            conn.commit()
    finally:
        database.release_connection(conn)

    return _ok(None, message="User deleted")
