import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import bcrypt
from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, Field

from database import get_connection, release_connection

SECRET_KEY = os.environ.get(
    "JWT_SECRET_KEY",
    "dev-only-secret-change-me-in-production-please-do-not-ship-this",
)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

INVALID_CREDENTIALS_MESSAGE = "Invalid email or password."
INVALID_REQUEST_MESSAGE = "Invalid request."
SESSION_EXPIRED_MESSAGE = "Session expired. Please sign in again."
SERVER_ERROR_MESSAGE = "Something went wrong. Please try again."
LOGIN_SUCCESS_MESSAGE = "Login successful."

logger = logging.getLogger("auth")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


def envelope(success: bool, data: Any, message: str) -> dict:
    return {"success": success, "data": data, "message": message}


def json_envelope(status_code: int, success: bool, data: Any, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=envelope(success, data, message))


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


def _create_access_token(user_id: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _verify_password(plain: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def fetch_user_by_email(email: str) -> Optional[dict]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, email, password_hash, full_name, is_active
                FROM public.users
                WHERE lower(email) = lower(%s)
                LIMIT 1
                """,
                (email,),
            )
            row = cur.fetchone()
    finally:
        release_connection(conn)
    if row is None:
        return None
    return {
        "id": row[0],
        "email": row[1],
        "password_hash": row[2],
        "full_name": row[3],
        "is_active": row[4],
    }


def fetch_user_by_id(user_id: str) -> Optional[dict]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, email, full_name, is_active
                FROM public.users
                WHERE id = %s
                LIMIT 1
                """,
                (user_id,),
            )
            row = cur.fetchone()
    finally:
        release_connection(conn)
    if row is None:
        return None
    return {
        "id": row[0],
        "email": row[1],
        "full_name": row[2],
        "is_active": row[3],
    }


def _log_login_attempt(email_lower: str, outcome: str) -> None:
    logger.info("login_attempt email=%s outcome=%s", email_lower, outcome)


@app.exception_handler(RequestValidationError)
async def on_validation_error(_: Request, __: RequestValidationError) -> JSONResponse:
    return json_envelope(422, False, None, INVALID_REQUEST_MESSAGE)


@app.exception_handler(Exception)
async def on_unhandled_exception(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled_error: %s", exc.__class__.__name__)
    return json_envelope(500, False, None, SERVER_ERROR_MESSAGE)


@app.post("/api/auth/login")
def login(body: LoginRequest) -> JSONResponse:
    email_lower = body.email.lower()
    user = fetch_user_by_email(body.email)

    if user is None or not user["is_active"] or not _verify_password(body.password, user["password_hash"]):
        _log_login_attempt(email_lower, "invalid_credentials")
        return json_envelope(401, False, None, INVALID_CREDENTIALS_MESSAGE)

    token = _create_access_token(str(user["id"]), user["email"])
    _log_login_attempt(email_lower, "success")
    return json_envelope(
        200,
        True,
        {
            "token": token,
            "user": {
                "id": str(user["id"]),
                "email": user["email"],
                "full_name": user["full_name"],
            },
        },
        LOGIN_SUCCESS_MESSAGE,
    )


_bearer_scheme = HTTPBearer(auto_error=False)


@app.get("/api/auth/me")
def me(credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme)) -> JSONResponse:
    if credentials is None or credentials.scheme.lower() != "bearer" or not credentials.credentials:
        return json_envelope(401, False, None, SESSION_EXPIRED_MESSAGE)

    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return json_envelope(401, False, None, SESSION_EXPIRED_MESSAGE)

    user_id = payload.get("sub")
    if not user_id:
        return json_envelope(401, False, None, SESSION_EXPIRED_MESSAGE)

    user = fetch_user_by_id(user_id)
    if user is None or not user["is_active"]:
        return json_envelope(401, False, None, SESSION_EXPIRED_MESSAGE)

    return json_envelope(
        200,
        True,
        {
            "user": {
                "id": str(user["id"]),
                "email": user["email"],
                "full_name": user["full_name"],
            },
        },
        "",
    )
