from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import FastAPI, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import jwt
from pydantic import BaseModel, EmailStr, Field

from database import get_connection, release_connection

SECRET_KEY = "super-secret-key-change-in-production"
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60

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


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=envelope(False, None, "Invalid email or password format."),
        headers=NO_STORE_HEADERS,
    )


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=255)


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

    if not is_active:
        return _invalid_credentials_response()

    if not bcrypt.checkpw(payload.password.encode("utf-8"), password_hash.encode("utf-8")):
        return _invalid_credentials_response()

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
