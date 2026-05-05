"""Integration tests for ``POST /api/auth/login``.

The tests run against the live local Postgres seed (``admin@example.com`` /
``password123``). If the database is not reachable the whole module is skipped
so CI without Postgres still passes.

Mapping to TECH_SPEC §7.10 acceptance criteria is noted on each test.
"""

from __future__ import annotations

import pytest

# --- DB availability gate ----------------------------------------------------

psycopg2 = pytest.importorskip("psycopg2")

from database import DB_CONFIG  # noqa: E402

try:
    _probe = psycopg2.connect(**DB_CONFIG)
    with _probe.cursor() as _cur:
        _cur.execute(
            "SELECT 1 FROM users WHERE email = 'admin@example.com' LIMIT 1"
        )
        _row = _cur.fetchone()
    _probe.close()
    if _row is None:
        pytest.skip(
            "Seed user admin@example.com missing — apply DB_SCHEMA.md first.",
            allow_module_level=True,
        )
except psycopg2.Error as exc:  # pragma: no cover — env-dependent
    pytest.skip(
        f"Postgres unreachable, skipping auth tests: {exc}",
        allow_module_level=True,
    )

from fastapi.testclient import TestClient  # noqa: E402
from jose import jwt  # noqa: E402

from main import JWT_ALGORITHM, JWT_SECRET_KEY, app  # noqa: E402


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


# --- Happy path (AC-26, AC-30) ----------------------------------------------


def test_login_success_returns_token_and_user(client: TestClient) -> None:
    resp = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "password123"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["message"] == "Login successful"

    data = body["data"]
    assert data["token_type"] == "Bearer"
    assert data["expires_in"] == 3600
    assert isinstance(data["token"], str) and data["token"]

    user = data["user"]
    assert user["email"] == "admin@example.com"
    assert "id" in user and user["id"]
    assert "name" in user
    assert "password_hash" not in user  # never leaked


def test_login_token_decodes_with_required_claims(client: TestClient) -> None:
    resp = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "password123"},
    )
    token = resp.json()["data"]["token"]
    claims = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])

    assert claims["email"] == "admin@example.com"
    assert claims["sub"]  # uuid string
    assert isinstance(claims["iat"], int)
    assert isinstance(claims["exp"], int)
    assert claims["exp"] - claims["iat"] == 3600


def test_login_normalises_email_case_and_whitespace(client: TestClient) -> None:
    resp = client.post(
        "/api/auth/login",
        json={"email": "  Admin@Example.COM  ", "password": "password123"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["user"]["email"] == "admin@example.com"


# --- 401 paths (AC-27, AC-28) -----------------------------------------------


def test_login_wrong_password_returns_401(client: TestClient) -> None:
    resp = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "wrongpassword"},
    )
    assert resp.status_code == 401
    body = resp.json()
    assert body == {"success": False, "data": None, "message": "Invalid credentials"}


def test_login_unknown_email_returns_same_401(client: TestClient) -> None:
    resp = client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "password123"},
    )
    assert resp.status_code == 401
    # Identical body to the wrong-password case → no user enumeration.
    assert resp.json() == {
        "success": False,
        "data": None,
        "message": "Invalid credentials",
    }


# --- 422 validation (AC-29) -------------------------------------------------


def test_login_missing_fields_returns_422_with_field_errors(client: TestClient) -> None:
    resp = client.post("/api/auth/login", json={})
    assert resp.status_code == 422
    body = resp.json()
    assert body["success"] is False
    assert body["data"] is None
    assert body["message"] == "Validation failed"

    fields = {e["field"]: e["message"] for e in body["errors"]}
    assert fields["email"] == "Email is required"
    assert fields["password"] == "Password is required"


def test_login_invalid_email_format_returns_422(client: TestClient) -> None:
    resp = client.post(
        "/api/auth/login",
        json={"email": "not-an-email", "password": "password123"},
    )
    assert resp.status_code == 422
    body = resp.json()
    assert any(
        e["field"] == "email" and "valid email" in e["message"].lower()
        for e in body["errors"]
    )


def test_login_short_password_returns_422(client: TestClient) -> None:
    resp = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "short"},
    )
    assert resp.status_code == 422
    body = resp.json()
    assert any(
        e["field"] == "password" and "at least 8" in e["message"]
        for e in body["errors"]
    )


def test_login_empty_email_string_returns_422(client: TestClient) -> None:
    resp = client.post(
        "/api/auth/login",
        json={"email": "", "password": "password123"},
    )
    assert resp.status_code == 422
    body = resp.json()
    assert any(
        e["field"] == "email" and e["message"] == "Email is required"
        for e in body["errors"]
    )


# --- 400 malformed body (AC-29) ---------------------------------------------


def test_login_malformed_json_returns_400(client: TestClient) -> None:
    resp = client.post(
        "/api/auth/login",
        content=b"{not valid json",
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 400
    assert resp.json() == {
        "success": False,
        "data": None,
        "message": "Malformed request",
    }
