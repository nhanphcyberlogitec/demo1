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


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=envelope(False, None, "Invalid email or password format."),
    )


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


def create_access_token(user_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "email": email, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


@app.get("/")
async def read_root():
    return envelope(True, {"service": "core-api"}, "")


@app.post("/api/auth/login")
async def login(payload: LoginRequest):
    email = payload.email.strip().lower()
    password = payload.password

    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, password_hash, created_at, updated_at "
                "FROM users WHERE email = %s",
                (email,),
            )
            row = cur.fetchone()
    finally:
        if conn is not None:
            release_connection(conn)

    if row is None:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content=envelope(False, None, "Invalid email or password."),
        )

    user_id, user_email, password_hash, created_at, updated_at = row

    if not bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8")):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content=envelope(False, None, "Invalid email or password."),
        )

    token = create_access_token(str(user_id), user_email)
    data = {
        "token": token,
        "user": {
            "id": str(user_id),
            "email": user_email,
            "created_at": created_at,
            "updated_at": updated_at,
        },
    }
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=jsonable_encoder(envelope(True, data, "Login successful.")),
    )
