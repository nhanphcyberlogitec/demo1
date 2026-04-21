"""Tests for POST /api/auth/login.

These tests stub `main.get_user_by_email` so they don't hit a real database.
Coverage targets TECH_SPEC §4 / §5 directly:
  - Happy path (200 + envelope + JWT claims + no password leakage).
  - Unknown email and wrong password both return the same generic 401.
  - Client validation (empty email, invalid format, empty/short password).
  - Envelope shape on every response.
"""

from __future__ import annotations

from typing import Optional

import bcrypt
import pytest
from fastapi.testclient import TestClient
from jose import jwt

import main
from main import JWT_ALGORITHM, JWT_SECRET, app


FAKE_USER_ID = "11111111-2222-3333-4444-555555555555"
FAKE_EMAIL = "admin@example.com"
FAKE_PASSWORD = "password123"


def _fake_user_hash() -> str:
    return bcrypt.hashpw(FAKE_PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def stub_no_users(monkeypatch):
    """Default stub: every lookup returns None."""
    monkeypatch.setattr(main, "get_user_by_email", lambda email: None)


@pytest.fixture
def stub_admin(monkeypatch):
    """Stub exposing a single admin user with a bcrypt-hashed known password."""
    hashed = _fake_user_hash()
    captured = {}

    def fake_lookup(email: str) -> Optional[dict]:
        captured["email"] = email
        if email == FAKE_EMAIL:
            return {
                "id": FAKE_USER_ID,
                "email": FAKE_EMAIL,
                "password_hash": hashed,
            }
        return None

    monkeypatch.setattr(main, "get_user_by_email", fake_lookup)
    return captured


# ---------------------------------------------------------------------------
# Envelope + happy path
# ---------------------------------------------------------------------------


def test_login_success_returns_200_envelope_with_token_and_user(client, stub_admin):
    resp = client.post(
        "/api/auth/login",
        json={"email": FAKE_EMAIL, "password": FAKE_PASSWORD},
    )
    assert resp.status_code == 200
    body = resp.json()

    # Envelope shape.
    assert body["success"] is True
    assert body["message"] == "Login successful"
    assert set(body.keys()) == {"success", "data", "message"}

    # Data shape.
    assert set(body["data"].keys()) == {"token", "user"}
    assert body["data"]["user"] == {"id": FAKE_USER_ID, "email": FAKE_EMAIL}

    # JWT payload has sub, email, exp and is HS256-signed.
    token = body["data"]["token"]
    decoded = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    assert decoded["sub"] == FAKE_USER_ID
    assert decoded["email"] == FAKE_EMAIL
    assert "exp" in decoded


def test_login_success_never_leaks_password_hash(client, stub_admin):
    resp = client.post(
        "/api/auth/login",
        json={"email": FAKE_EMAIL, "password": FAKE_PASSWORD},
    )
    assert resp.status_code == 200
    raw = resp.text
    assert "password_hash" not in raw
    assert "$2b$" not in raw  # bcrypt prefix must not appear in the response


def test_login_normalizes_email_before_lookup(client, stub_admin):
    resp = client.post(
        "/api/auth/login",
        json={"email": "  ADMIN@Example.COM  ", "password": FAKE_PASSWORD},
    )
    assert resp.status_code == 200
    # The handler must hand the lookup a trimmed + lowercased email.
    assert stub_admin["email"] == FAKE_EMAIL


# ---------------------------------------------------------------------------
# 401 — unknown email vs wrong password must be indistinguishable
# ---------------------------------------------------------------------------


def test_login_unknown_email_returns_401_generic(client, stub_no_users):
    resp = client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": FAKE_PASSWORD},
    )
    assert resp.status_code == 401
    assert resp.json() == {
        "success": False,
        "data": None,
        "message": "Invalid email or password",
    }


def test_login_wrong_password_returns_401_generic(client, stub_admin):
    resp = client.post(
        "/api/auth/login",
        json={"email": FAKE_EMAIL, "password": "wrongpassword"},
    )
    assert resp.status_code == 401
    assert resp.json() == {
        "success": False,
        "data": None,
        "message": "Invalid email or password",
    }


def test_401_bodies_are_identical_for_unknown_and_wrong(client, monkeypatch):
    # Unknown email arm
    monkeypatch.setattr(main, "get_user_by_email", lambda email: None)
    a = client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": FAKE_PASSWORD},
    )

    # Wrong password arm
    hashed = _fake_user_hash()
    monkeypatch.setattr(
        main,
        "get_user_by_email",
        lambda email: {
            "id": FAKE_USER_ID,
            "email": FAKE_EMAIL,
            "password_hash": hashed,
        }
        if email == FAKE_EMAIL
        else None,
    )
    b = client.post(
        "/api/auth/login",
        json={"email": FAKE_EMAIL, "password": "wrongpassword"},
    )

    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


# ---------------------------------------------------------------------------
# 422 — client-side validation fallback via server
# ---------------------------------------------------------------------------


def _assert_422_envelope(resp):
    assert resp.status_code == 422
    body = resp.json()
    assert body["success"] is False
    assert body["message"] == "Validation failed"
    assert "errors" in body["data"]
    assert isinstance(body["data"]["errors"], dict)
    return body["data"]["errors"]


def test_422_on_missing_email(client):
    resp = client.post(
        "/api/auth/login",
        json={"password": FAKE_PASSWORD},
    )
    errors = _assert_422_envelope(resp)
    assert errors.get("email") == "Email is required"


def test_422_on_empty_email(client):
    resp = client.post(
        "/api/auth/login",
        json={"email": "   ", "password": FAKE_PASSWORD},
    )
    errors = _assert_422_envelope(resp)
    assert errors.get("email") == "Email is required"


def test_422_on_invalid_email_format(client):
    resp = client.post(
        "/api/auth/login",
        json={"email": "not-an-email", "password": FAKE_PASSWORD},
    )
    errors = _assert_422_envelope(resp)
    assert errors.get("email") == "Enter a valid email address"


def test_422_on_short_password(client):
    resp = client.post(
        "/api/auth/login",
        json={"email": FAKE_EMAIL, "password": "short"},
    )
    errors = _assert_422_envelope(resp)
    assert errors.get("password") == "Password must be at least 8 characters"


def test_422_on_empty_password(client):
    resp = client.post(
        "/api/auth/login",
        json={"email": FAKE_EMAIL, "password": ""},
    )
    errors = _assert_422_envelope(resp)
    assert errors.get("password") == "Password is required"


def test_422_collects_errors_for_multiple_fields(client):
    resp = client.post(
        "/api/auth/login",
        json={"email": "", "password": ""},
    )
    errors = _assert_422_envelope(resp)
    assert errors.get("email") == "Email is required"
    assert errors.get("password") == "Password is required"


def test_422_on_email_too_long(client):
    # 256 chars total (245 + "@example.com") — over the 254 cap.
    long_local = "a" * 245
    long_email = f"{long_local}@example.com"
    assert len(long_email) > 254
    resp = client.post(
        "/api/auth/login",
        json={"email": long_email, "password": FAKE_PASSWORD},
    )
    errors = _assert_422_envelope(resp)
    assert errors.get("email") == "Email is too long"


def test_422_on_password_too_long(client):
    # 129 chars — over the 128 cap.
    long_pw = "a" * 129
    resp = client.post(
        "/api/auth/login",
        json={"email": FAKE_EMAIL, "password": long_pw},
    )
    errors = _assert_422_envelope(resp)
    assert errors.get("password") == "Password is too long"
