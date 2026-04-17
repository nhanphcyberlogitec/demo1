import logging
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import psycopg2
from fastapi import Depends, FastAPI, Header, Query, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, Field

from database import get_connection, release_connection

SECRET_KEY = "super-secret-key-change-in-production"
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60

logger = logging.getLogger("account")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Core API",
    description="Admin Panel backend — authentication and core endpoints.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def envelope(success: bool, data, message: str) -> dict:
    return {"success": success, "data": data, "message": message}


NO_STORE_HEADERS = {"Cache-Control": "no-store"}

INVALID_CREDENTIALS_MESSAGE = "Invalid email or password"
ACCOUNT_INACTIVE_MESSAGE = "Account is inactive"
NOT_AUTHENTICATED_MESSAGE = "Not authenticated"
EMAIL_IN_USE_MESSAGE = "Email already in use"
INVALID_CURRENT_PASSWORD_MESSAGE = "Invalid current password"
ACCOUNT_NOT_FOUND_MESSAGE = "Account not found"
SELF_DEACTIVATION_MESSAGE = "You cannot deactivate your own account"
DUPLICATE_EMAIL_MESSAGE = "An account with this email already exists"


def _field_errors_from_pydantic(exc: RequestValidationError) -> dict:
    errors: dict = {}
    for err in exc.errors():
        loc = err.get("loc", ())
        field = next((p for p in loc if p != "body"), None)
        if field is None:
            continue
        if field not in errors:
            errors[str(field)] = err.get("msg", "Invalid value")
    return errors


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    path = request.url.path
    if (
        path.startswith("/api/account/")
        or path.startswith("/api/accounts")
        or path == "/api/auth/register"
    ):
        errors = _field_errors_from_pydantic(exc)
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=envelope(False, {"errors": errors} if errors else None, "Validation failed"),
            headers=NO_STORE_HEADERS,
        )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=envelope(False, None, "Invalid email or password format."),
        headers=NO_STORE_HEADERS,
    )


def _not_authenticated_response() -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content=envelope(False, None, NOT_AUTHENTICATED_MESSAGE),
        headers=NO_STORE_HEADERS,
    )


class NotAuthenticatedError(Exception):
    pass


@app.exception_handler(NotAuthenticatedError)
async def not_authenticated_handler(request: Request, exc: NotAuthenticatedError):
    return _not_authenticated_response()


class CurrentUser(BaseModel):
    id: str
    email: str
    password_hash: str
    is_active: bool
    name: Optional[str]
    created_at: datetime
    updated_at: datetime


def get_current_user(authorization: Optional[str] = Header(default=None)) -> CurrentUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise NotAuthenticatedError()

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise NotAuthenticatedError()

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise NotAuthenticatedError()

    user_id = payload.get("sub")
    if not user_id:
        raise NotAuthenticatedError()

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, password_hash, is_active, name, "
                "created_at, updated_at FROM users WHERE id = %s",
                (user_id,),
            )
            row = cur.fetchone()
    finally:
        release_connection(conn)

    if row is None:
        raise NotAuthenticatedError()

    uid, email, password_hash, is_active, name, created_at, updated_at = row
    if not is_active:
        raise NotAuthenticatedError()

    return CurrentUser(
        id=str(uid),
        email=email,
        password_hash=password_hash,
        is_active=is_active,
        name=name,
        created_at=created_at,
        updated_at=updated_at,
    )


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=255)


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    confirm_password: str

    model_config = {"extra": "ignore"}


def create_access_token(user_id: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES),
        "iat": now,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


def _invalid_credentials_response() -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content=envelope(False, None, INVALID_CREDENTIALS_MESSAGE),
        headers=NO_STORE_HEADERS,
    )


def _account_inactive_response() -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content=envelope(False, None, ACCOUNT_INACTIVE_MESSAGE),
        headers=NO_STORE_HEADERS,
    )


@app.post("/api/auth/login")
async def login(payload: LoginRequest):
    email = payload.email.lower()

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, password_hash, is_active "
                "FROM users WHERE LOWER(email) = %s",
                (email,),
            )
            row = cur.fetchone()
    finally:
        release_connection(conn)

    if row is None:
        return _invalid_credentials_response()

    user_id, user_email, password_hash, is_active = row

    if not bcrypt.checkpw(payload.password.encode("utf-8"), password_hash.encode("utf-8")):
        return _invalid_credentials_response()

    if not is_active:
        return _account_inactive_response()

    user_id_str = str(user_id)
    token = create_access_token(user_id_str, user_email)

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=envelope(
            True,
            {
                "token": token,
                "user": {"id": user_id_str, "email": user_email},
            },
            "Login successful",
        ),
        headers=NO_STORE_HEADERS,
    )


@app.post("/api/auth/register")
async def register(payload: RegisterRequest):
    errors: dict = {}

    normalized_name, name_err = _validate_name(payload.name)
    if name_err is not None:
        errors["name"] = name_err

    email_value = str(payload.email).strip().lower()
    if not email_value:
        errors["email"] = "Email is required"

    pw_err = _validate_password(payload.password)
    if pw_err:
        errors["password"] = pw_err

    if "password" not in errors and payload.password != payload.confirm_password:
        errors["confirm_password"] = "Passwords do not match"

    if errors:
        return _validation_error_response(errors)

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM users WHERE LOWER(email) = %s",
                (email_value,),
            )
            if cur.fetchone() is not None:
                return _duplicate_email_response()

            password_hash = bcrypt.hashpw(
                payload.password.encode("utf-8"), bcrypt.gensalt()
            ).decode("utf-8")

            try:
                cur.execute(
                    "INSERT INTO users (email, password_hash, name, is_active) "
                    "VALUES (%s, %s, %s, TRUE) RETURNING id, email",
                    (email_value, password_hash, normalized_name),
                )
            except psycopg2.errors.UniqueViolation:
                conn.rollback()
                return _duplicate_email_response()
            new_id, new_email = cur.fetchone()
            conn.commit()
    finally:
        release_connection(conn)

    new_id_str = str(new_id)
    token = create_access_token(new_id_str, new_email)

    logger.info("account.registered id=%s email=%s", new_id_str, new_email)
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=envelope(
            True,
            {
                "token": token,
                "user": {"id": new_id_str, "email": new_email},
            },
            "Account created",
        ),
        headers=NO_STORE_HEADERS,
    )


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_PASSWORD_LETTER_RE = re.compile(r"[A-Za-z]")
_PASSWORD_DIGIT_RE = re.compile(r"[0-9]")


def _iso_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _profile_dict(user: CurrentUser) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "is_active": user.is_active,
        "created_at": _iso_utc(user.created_at),
        "updated_at": _iso_utc(user.updated_at),
    }


def _user_row_dict(row) -> dict:
    uid, email, name, is_active, created_at, updated_at = row
    return {
        "id": str(uid),
        "email": email,
        "name": name,
        "is_active": is_active,
        "created_at": _iso_utc(created_at),
        "updated_at": _iso_utc(updated_at),
    }


def _validation_error_response(errors: dict, message: str = "Validation failed") -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=envelope(False, {"errors": errors} if errors else None, message),
        headers=NO_STORE_HEADERS,
    )


def _validate_name(raw_value) -> tuple[Optional[str], Optional[str]]:
    """Return (normalized_name, error). Treats empty / whitespace / too long as errors."""
    if raw_value is None:
        return None, "Name is required"
    if not isinstance(raw_value, str):
        return None, "Must be a string"
    trimmed = raw_value.strip()
    if trimmed == "":
        return None, "Name is required"
    if _CONTROL_CHAR_RE.search(trimmed):
        return None, "Contains disallowed control characters"
    codepoints = list(trimmed)
    if len(codepoints) < 1 or len(codepoints) > 100:
        return None, "Must be 1–100 characters"
    return unicodedata.normalize("NFC", trimmed), None


def _validate_password(raw_value) -> Optional[str]:
    if not isinstance(raw_value, str):
        return "Must be a string"
    if len(raw_value) < 8 or len(raw_value) > 128:
        return "Password must be 8–128 characters"
    if not _PASSWORD_LETTER_RE.search(raw_value) or not _PASSWORD_DIGIT_RE.search(raw_value):
        return "Password must contain at least one letter and one digit"
    return None


# ---------------------------------------------------------------------------
# Existing /api/account/me endpoints (session profile)
# ---------------------------------------------------------------------------


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = Field(default=None)
    email: Optional[EmailStr] = Field(default=None)

    model_config = {"extra": "ignore"}


@app.get("/api/account/me")
async def get_account_me(current_user: CurrentUser = Depends(get_current_user)):
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=envelope(True, _profile_dict(current_user), "OK"),
    )


@app.patch("/api/account/me")
async def patch_account_me(
    payload: UpdateProfileRequest,
    raw: Request,
    current_user: CurrentUser = Depends(get_current_user),
):
    body = await raw.json() if raw.headers.get("content-length") not in (None, "0") else {}
    if not isinstance(body, dict):
        body = {}

    errors: dict = {}
    updates: dict = {}

    name_touched = "name" in body
    email_touched = "email" in body

    if name_touched:
        normalized, err = _validate_name(payload.name)
        if err is not None:
            errors["name"] = err
        else:
            updates["name"] = normalized

    new_email: Optional[str] = None
    if email_touched:
        if payload.email is None:
            errors["email"] = "Email cannot be empty"
        else:
            new_email = str(payload.email).strip().lower()
            if not new_email:
                errors["email"] = "Email cannot be empty"
            else:
                updates["email"] = new_email

    if errors:
        return _validation_error_response(errors)

    if not updates:
        return _validation_error_response({}, "No changes submitted")

    set_clauses = []
    params: list = []
    if "name" in updates:
        set_clauses.append("name = %s")
        params.append(updates["name"])
    if "email" in updates:
        set_clauses.append("email = %s")
        params.append(updates["email"])
    set_clauses.append("updated_at = now()")
    params.append(current_user.id)

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            if "email" in updates:
                cur.execute(
                    "SELECT 1 FROM users WHERE LOWER(email) = %s AND id <> %s",
                    (updates["email"], current_user.id),
                )
                if cur.fetchone() is not None:
                    conn.rollback()
                    return JSONResponse(
                        status_code=status.HTTP_409_CONFLICT,
                        content=envelope(False, None, EMAIL_IN_USE_MESSAGE),
                        headers=NO_STORE_HEADERS,
                    )

            sql = (
                "UPDATE users SET "
                + ", ".join(set_clauses)
                + " WHERE id = %s RETURNING id, email, name, is_active, "
                "created_at, updated_at"
            )
            try:
                cur.execute(sql, tuple(params))
            except psycopg2.errors.UniqueViolation:
                conn.rollback()
                return JSONResponse(
                    status_code=status.HTTP_409_CONFLICT,
                    content=envelope(False, None, EMAIL_IN_USE_MESSAGE),
                    headers=NO_STORE_HEADERS,
                )
            row = cur.fetchone()
            conn.commit()
    finally:
        release_connection(conn)

    logger.info(
        "account.profile_updated user_id=%s changed_fields=%s",
        current_user.id,
        sorted(updates.keys()),
    )
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=envelope(True, _user_row_dict(row), "Profile updated"),
        headers=NO_STORE_HEADERS,
    )


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=255)
    new_password: str = Field(min_length=1, max_length=255)
    confirm_password: str = Field(min_length=1, max_length=255)


@app.post("/api/account/password")
async def post_account_password(
    payload: ChangePasswordRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    errors: dict = {}

    pw_err = _validate_password(payload.new_password)
    if pw_err:
        errors["new_password"] = pw_err

    if "new_password" not in errors and payload.new_password != payload.confirm_password:
        errors["confirm_password"] = "Passwords do not match"

    if errors:
        return _validation_error_response(errors)

    if not bcrypt.checkpw(
        payload.current_password.encode("utf-8"),
        current_user.password_hash.encode("utf-8"),
    ):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content=envelope(False, None, INVALID_CURRENT_PASSWORD_MESSAGE),
            headers=NO_STORE_HEADERS,
        )

    if payload.new_password == payload.current_password:
        return _validation_error_response(
            {"new_password": "New password must differ from current password"}
        )

    new_hash = bcrypt.hashpw(payload.new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET password_hash = %s, updated_at = now() WHERE id = %s",
                (new_hash, current_user.id),
            )
            conn.commit()
    finally:
        release_connection(conn)

    logger.info("account.password_changed user_id=%s", current_user.id)
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=envelope(True, None, "Password updated"),
        headers=NO_STORE_HEADERS,
    )


# ---------------------------------------------------------------------------
# /api/accounts — admin account management
# ---------------------------------------------------------------------------


ACCOUNT_SELECT_COLUMNS = "id, email, name, is_active, created_at, updated_at"


class CreateAccountRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    is_active: Optional[bool] = True

    model_config = {"extra": "ignore"}


class UpdateAccountRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None

    model_config = {"extra": "ignore"}


class UpdateStatusRequest(BaseModel):
    is_active: bool

    model_config = {"extra": "ignore"}


def _not_found_response() -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content=envelope(False, None, ACCOUNT_NOT_FOUND_MESSAGE),
        headers=NO_STORE_HEADERS,
    )


def _duplicate_email_response() -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content=envelope(False, None, DUPLICATE_EMAIL_MESSAGE),
        headers=NO_STORE_HEADERS,
    )


@app.get("/api/accounts")
async def list_accounts(
    q: Optional[str] = Query(default=None, max_length=100),
    status_: Optional[str] = Query(default="all", alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _current: CurrentUser = Depends(get_current_user),
):
    errors: dict = {}

    status_value = (status_ or "all").strip().lower()
    if status_value not in ("active", "inactive", "all"):
        errors["status"] = "Must be one of active, inactive, all"

    search_term: Optional[str] = None
    if q is not None:
        trimmed = q.strip()
        if trimmed:
            if len(trimmed) > 100:
                errors["q"] = "Must be at most 100 characters"
            else:
                search_term = trimmed

    if errors:
        return _validation_error_response(errors)

    where_clauses: list = []
    params: list = []

    if status_value == "active":
        where_clauses.append("is_active = TRUE")
    elif status_value == "inactive":
        where_clauses.append("is_active = FALSE")

    if search_term is not None:
        where_clauses.append("(LOWER(name) LIKE %s OR LOWER(email) LIKE %s)")
        like = f"%{search_term.lower()}%"
        params.extend([like, like])

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    offset = (page - 1) * page_size

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM users {where_sql}", tuple(params))
            total = cur.fetchone()[0]

            cur.execute(
                f"SELECT {ACCOUNT_SELECT_COLUMNS} FROM users {where_sql} "
                "ORDER BY created_at DESC, id DESC LIMIT %s OFFSET %s",
                tuple(params) + (page_size, offset),
            )
            rows = cur.fetchall()
    finally:
        release_connection(conn)

    items = [_user_row_dict(r) for r in rows]
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=envelope(
            True,
            {"items": items, "page": page, "page_size": page_size, "total": total},
            "",
        ),
        headers=NO_STORE_HEADERS,
    )


def _fetch_account(account_id: str) -> Optional[tuple]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    f"SELECT {ACCOUNT_SELECT_COLUMNS} FROM users WHERE id = %s",
                    (account_id,),
                )
            except psycopg2.errors.InvalidTextRepresentation:
                conn.rollback()
                return None
            return cur.fetchone()
    finally:
        release_connection(conn)


@app.get("/api/accounts/{account_id}")
async def get_account(
    account_id: str,
    _current: CurrentUser = Depends(get_current_user),
):
    row = _fetch_account(account_id)
    if row is None:
        return _not_found_response()
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=envelope(True, _user_row_dict(row), ""),
        headers=NO_STORE_HEADERS,
    )


@app.post("/api/accounts")
async def create_account(
    payload: CreateAccountRequest,
    _current: CurrentUser = Depends(get_current_user),
):
    errors: dict = {}

    normalized_name, name_err = _validate_name(payload.name)
    if name_err is not None:
        errors["name"] = name_err

    email_value = str(payload.email).strip().lower()
    if not email_value:
        errors["email"] = "Email is required"

    pw_err = _validate_password(payload.password)
    if pw_err:
        errors["password"] = pw_err

    is_active = True if payload.is_active is None else bool(payload.is_active)

    if errors:
        return _validation_error_response(errors)

    password_hash = bcrypt.hashpw(
        payload.password.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM users WHERE LOWER(email) = %s",
                (email_value,),
            )
            if cur.fetchone() is not None:
                return _duplicate_email_response()

            try:
                cur.execute(
                    "INSERT INTO users (email, password_hash, name, is_active) "
                    "VALUES (%s, %s, %s, %s) "
                    f"RETURNING {ACCOUNT_SELECT_COLUMNS}",
                    (email_value, password_hash, normalized_name, is_active),
                )
            except psycopg2.errors.UniqueViolation:
                conn.rollback()
                return _duplicate_email_response()
            row = cur.fetchone()
            conn.commit()
    finally:
        release_connection(conn)

    logger.info("account.created id=%s email=%s", row[0], email_value)
    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content=envelope(True, _user_row_dict(row), "Account created"),
        headers=NO_STORE_HEADERS,
    )


@app.patch("/api/accounts/{account_id}")
async def update_account(
    account_id: str,
    payload: UpdateAccountRequest,
    raw: Request,
    _current: CurrentUser = Depends(get_current_user),
):
    body = await raw.json() if raw.headers.get("content-length") not in (None, "0") else {}
    if not isinstance(body, dict):
        body = {}

    errors: dict = {}
    updates: dict = {}

    if "name" in body:
        normalized, err = _validate_name(payload.name)
        if err is not None:
            errors["name"] = err
        else:
            updates["name"] = normalized

    if "email" in body:
        if payload.email is None:
            errors["email"] = "Email cannot be empty"
        else:
            new_email = str(payload.email).strip().lower()
            if not new_email:
                errors["email"] = "Email cannot be empty"
            else:
                updates["email"] = new_email

    if errors:
        return _validation_error_response(errors)

    if not updates:
        return _validation_error_response({}, "No changes submitted")

    set_clauses = []
    params: list = []
    if "name" in updates:
        set_clauses.append("name = %s")
        params.append(updates["name"])
    if "email" in updates:
        set_clauses.append("email = %s")
        params.append(updates["email"])
    set_clauses.append("updated_at = now()")
    params.append(account_id)

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    f"SELECT 1 FROM users WHERE id = %s",
                    (account_id,),
                )
            except psycopg2.errors.InvalidTextRepresentation:
                conn.rollback()
                return _not_found_response()
            if cur.fetchone() is None:
                return _not_found_response()

            if "email" in updates:
                cur.execute(
                    "SELECT 1 FROM users WHERE LOWER(email) = %s AND id <> %s",
                    (updates["email"], account_id),
                )
                if cur.fetchone() is not None:
                    return _duplicate_email_response()

            sql = (
                "UPDATE users SET "
                + ", ".join(set_clauses)
                + f" WHERE id = %s RETURNING {ACCOUNT_SELECT_COLUMNS}"
            )
            try:
                cur.execute(sql, tuple(params))
            except psycopg2.errors.UniqueViolation:
                conn.rollback()
                return _duplicate_email_response()
            row = cur.fetchone()
            conn.commit()
    finally:
        release_connection(conn)

    if row is None:
        return _not_found_response()

    logger.info(
        "account.updated id=%s changed_fields=%s",
        account_id,
        sorted(updates.keys()),
    )
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=envelope(True, _user_row_dict(row), "Changes saved"),
        headers=NO_STORE_HEADERS,
    )


@app.patch("/api/accounts/{account_id}/status")
async def update_account_status(
    account_id: str,
    payload: UpdateStatusRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    if not payload.is_active and str(account_id) == str(current_user.id):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content=envelope(False, None, SELF_DEACTIVATION_MESSAGE),
            headers=NO_STORE_HEADERS,
        )

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    "UPDATE users SET is_active = %s, updated_at = now() "
                    f"WHERE id = %s RETURNING {ACCOUNT_SELECT_COLUMNS}",
                    (payload.is_active, account_id),
                )
            except psycopg2.errors.InvalidTextRepresentation:
                conn.rollback()
                return _not_found_response()
            row = cur.fetchone()
            if row is None:
                conn.rollback()
                return _not_found_response()
            conn.commit()
    finally:
        release_connection(conn)

    msg = "Account activated" if payload.is_active else "Account deactivated"
    logger.info("account.status_changed id=%s is_active=%s", account_id, payload.is_active)
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=envelope(True, _user_row_dict(row), msg),
        headers=NO_STORE_HEADERS,
    )
