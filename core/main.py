from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import jwt
from pydantic import BaseModel, EmailStr

import database

# JWT Configuration
SECRET_KEY = "super-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

app = FastAPI(
    title="Core API",
    description="Admin Panel backend API",
)

# CORS middleware — allow frontend at localhost:3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Models ---

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# --- Helpers ---

def api_response(success: bool, data=None, message: str = "", status_code: int = 200):
    return JSONResponse(
        status_code=status_code,
        content={"success": success, "data": data, "message": message},
    )


# --- Exception Handlers ---

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    for error in exc.errors():
        if "email" in error.get("loc", []):
            return api_response(
                success=False,
                message="Invalid email format",
                status_code=422,
            )
    # Fallback for other validation errors
    messages = "; ".join(e["msg"] for e in exc.errors())
    return api_response(success=False, message=messages, status_code=422)


# --- Routes ---

@app.get("/")
async def read_root():
    return {"message": "Welcome to the Core API!"}


@app.post("/api/auth/login")
async def login(body: LoginRequest):
    # Validate password length
    if len(body.password) < 6:
        return api_response(
            success=False,
            message="Password must be at least 6 characters",
            status_code=422,
        )

    # Query user by email
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
        return api_response(
            success=False,
            message="Invalid email or password",
            status_code=401,
        )

    user_id, name, email, password_hash = user

    # Verify password with bcrypt
    if not bcrypt.checkpw(body.password.encode("utf-8"), password_hash.encode("utf-8")):
        return api_response(
            success=False,
            message="Invalid email or password",
            status_code=401,
        )

    # Generate JWT token
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token = jwt.encode(
        {"sub": str(user_id), "email": email, "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )

    return api_response(
        success=True,
        data={
            "token": token,
            "user": {"id": str(user_id), "name": name, "email": email},
        },
    )
