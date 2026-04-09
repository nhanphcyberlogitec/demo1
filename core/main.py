# core/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator
import bcrypt
from jose import jwt
from email_validator import validate_email, EmailNotValidError
import database

# Initialize the FastAPI application
app = FastAPI(
    title="Core API",
    description="A simple core API built with FastAPI."
)

# CORS middleware — allow the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JWT configuration
SECRET_KEY = "secret-key-demo"
ALGORITHM = "HS256"


# Pydantic model for login request
class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email_field(cls, v: str) -> str:
        try:
            validate_email(v, check_deliverability=False)
        except EmailNotValidError as exc:
            raise ValueError(str(exc)) from exc
        return v

    @field_validator("password")
    @classmethod
    def validate_password_field(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


def make_response(success: bool, data, message: str, status_code: int = 200):
    return JSONResponse(
        status_code=status_code,
        content={"success": success, "data": data, "message": message},
    )


# Keep existing routes
@app.get("/")
async def read_root():
    """Returns a simple welcome message."""
    return {"message": "Welcome to the Core API!"}


@app.get("/items/{item_id}")
async def read_item(item_id: int, q: str | None = None):
    """Retrieves an item by its ID."""
    if q:
        return {"item_id": item_id, "q": q}
    return {"item_id": item_id}


# Login endpoint
@app.post("/api/auth/login")
async def login(body: LoginRequest):
    """Authenticate a user and return a JWT token."""
    conn = None
    try:
        conn = database.get_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT id, name, email, password_hash FROM users WHERE email = %s",
            (body.email,)
        )
        user = cur.fetchone()
        cur.close()
    except Exception:
        if conn:
            conn.close()
        return make_response(False, None, "Internal server error", 500)
    finally:
        if conn:
            conn.close()

    if user is None:
        return make_response(False, None, "Invalid email or password", 401)

    user_id, user_name, user_email, password_hash = user

    password_matches = bcrypt.checkpw(
        body.password.encode("utf-8"),
        password_hash.encode("utf-8")
    )

    if not password_matches:
        return make_response(False, None, "Invalid email or password", 401)

    token_payload = {"sub": str(user_id), "email": user_email}
    token = jwt.encode(token_payload, SECRET_KEY, algorithm=ALGORITHM)

    return make_response(
        True,
        {
            "token": token,
            "user": {"id": user_id, "name": user_name, "email": user_email},
        },
        "",
        200,
    )


# Custom 422 handler to return consistent JSON
from fastapi.exceptions import RequestValidationError

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    errors = exc.errors()
    messages = []
    for error in errors:
        field = ".".join(str(loc) for loc in error["loc"] if loc != "body")
        msg = error["msg"]
        messages.append(f"{field}: {msg}")
    message = "Validation failed: " + "; ".join(messages)
    return JSONResponse(
        status_code=422,
        content={"success": False, "data": None, "message": message},
    )
