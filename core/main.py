# core/main.py

import re
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import jwt
from pydantic import BaseModel

import database

app = FastAPI(title="Core API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

JWT_SECRET = "super-secret-key-change-in-production"
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_MINUTES = 60

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


class LoginRequest(BaseModel):
    email: str
    password: str


@app.get("/")
async def read_root():
    return {"message": "Welcome to the Core API!"}


@app.post("/api/auth/login")
async def login(body: LoginRequest):
    # Validate email format
    if not EMAIL_REGEX.match(body.email):
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "data": None,
                "message": "Validation failed: Please enter a valid email address",
            },
        )

    # Validate password length
    if len(body.password) < 6:
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "data": None,
                "message": "Validation failed: Password must be at least 6 characters",
            },
        )

    # Query user from database
    conn = database.get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, name, email, password_hash FROM users WHERE email = %s",
            (body.email,),
        )
        user = cur.fetchone()
        cur.close()
    finally:
        conn.close()

    if not user:
        return JSONResponse(
            status_code=401,
            content={
                "success": False,
                "data": None,
                "message": "Invalid email or password",
            },
        )

    user_id, user_name, user_email, password_hash = user

    # Verify password with bcrypt
    if not bcrypt.checkpw(body.password.encode("utf-8"), password_hash.encode("utf-8")):
        return JSONResponse(
            status_code=401,
            content={
                "success": False,
                "data": None,
                "message": "Invalid email or password",
            },
        )

    # Generate JWT token
    payload = {
        "sub": str(user_id),
        "email": user_email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRATION_MINUTES),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    return {
        "success": True,
        "data": {
            "token": token,
            "user": {
                "id": str(user_id),
                "name": user_name,
                "email": user_email,
            },
        },
        "message": "",
    }