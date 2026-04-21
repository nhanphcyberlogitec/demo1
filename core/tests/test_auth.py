"""Tests for POST /api/auth/login.

Covers envelope discipline, validation, credentials (including
anti-enumeration byte-identity), rate-limiting, and JWT claims.

The DB is fully stubbed via monkeypatch on `main._find_user_by_email`
so the suite runs without a live Postgres. Rate-limiter state is
reset between tests via the test hook.
"""

from __future__ import annotations

import time
from typing import Dict, Optional

import bcrypt
import pytest
from fastapi.testclient import TestClient
from jose import jwt

import main
from main import JWT_ALGORITHM, JWT_SECRET, app, rate_limiter

SEED_EMAIL = "admin@example.com"
SEED_PASSWORD = "password123"
SEED_ID = "00000000-0000-0000-0000-000000000001"
SEED_NAME = "Administrator"


def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


@pytest.fixture
def admin_row() -> Dict[str, object]:
    return {
        "id": SEED_ID,
        "email": SEED_EMAIL,
        "password_hash": _hash(SEED_PASSWORD),
        "name": SEED_NAME,
        "is_active": True,
    }


@pytest.fixture
def inactive_row() -> Dict[str, object]:
    return {
        "id": SEED_ID,
        "email": SEED_EMAIL,
        "password_hash": _hash(SEED_PASSWORD),
        "name": SEED_NAME,
        "is_active": False,
    }


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """Keep each test isolated from the shared in-process counter."""
    rate_limiter.reset()
    yield
    rate_limiter.reset()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _install_lookup(
    monkeypatch: pytest.MonkeyPatch, row: Optional[Dict[str, object]]
) -> None:
    """Stub the DB lookup to return the given row (or None)."""

    def fake_lookup(email_lower: str):  # noqa: ARG001 - signature match
        return row

    monkeypatch.setattr(main, "_find_user_by_email", fake_lookup)


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


def test_login_success_envelope_and_jwt(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    admin_row: Dict[str, object],
) -> None:
    _install_lookup(monkeypatch, admin_row)

    resp = client.post(
        "/api/auth/login",
        json={"email": SEED_EMAIL, "password": SEED_PASSWORD},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["message"] == ""
    assert set(body["data"].keys()) == {"token", "user"}

    user = body["data"]["user"]
    assert user == {"id": SEED_ID, "email": SEED_EMAIL, "name": SEED_NAME}
    assert "password_hash" not in user  # AC-17

    # JWT claims
    claims = jwt.decode(
        body["data"]["token"], JWT_SECRET, algorithms=[JWT_ALGORITHM]
    )
    assert claims["sub"] == SEED_ID
    assert claims["email"] == SEED_EMAIL
    assert claims["exp"] - claims["iat"] == 3600  # TTL = 60 min


def test_login_success_normalizes_email_case(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    admin_row: Dict[str, object],
) -> None:
    captured = {}

    def fake_lookup(email_lower: str):
        captured["email_lower"] = email_lower
        return admin_row

    monkeypatch.setattr(main, "_find_user_by_email", fake_lookup)

    resp = client.post(
        "/api/auth/login",
        json={"email": "  Admin@Example.COM  ", "password": SEED_PASSWORD},
    )
    assert resp.status_code == 200
    assert captured["email_lower"] == SEED_EMAIL


# ---------------------------------------------------------------------------
# 401 — anti-enumeration (AC-4, AC-15, AC-18)
# ---------------------------------------------------------------------------


def test_login_unknown_email_returns_identical_401(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _install_lookup(monkeypatch, None)
    resp = client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "password123"},
    )
    assert resp.status_code == 401
    assert resp.json() == {
        "success": False,
        "data": None,
        "message": "Invalid email or password",
    }


def test_login_wrong_password_returns_identical_401(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    admin_row: Dict[str, object],
) -> None:
    _install_lookup(monkeypatch, admin_row)
    resp = client.post(
        "/api/auth/login",
        json={"email": SEED_EMAIL, "password": "wrongwrong"},
    )
    assert resp.status_code == 401
    assert resp.json() == {
        "success": False,
        "data": None,
        "message": "Invalid email or password",
    }


def test_login_inactive_user_returns_identical_401(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    inactive_row: Dict[str, object],
) -> None:
    _install_lookup(monkeypatch, inactive_row)
    resp = client.post(
        "/api/auth/login",
        json={"email": SEED_EMAIL, "password": SEED_PASSWORD},
    )
    assert resp.status_code == 401
    assert resp.json() == {
        "success": False,
        "data": None,
        "message": "Invalid email or password",
    }


# ---------------------------------------------------------------------------
# 422 — validation
# ---------------------------------------------------------------------------


def test_login_422_non_json_body(client: TestClient) -> None:
    resp = client.post(
        "/api/auth/login",
        content=b"not-json",
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 422
    assert resp.json()["success"] is False
    assert resp.json()["data"] is None


def test_login_422_missing_email(client: TestClient) -> None:
    resp = client.post("/api/auth/login", json={"password": "password123"})
    assert resp.status_code == 422
    assert resp.json()["message"] == "Email is required"


def test_login_422_invalid_email(client: TestClient) -> None:
    resp = client.post(
        "/api/auth/login", json={"email": "not-an-email", "password": "abcdef"}
    )
    assert resp.status_code == 422
    assert resp.json()["message"] == "Email is invalid"


def test_login_422_short_password(client: TestClient) -> None:
    resp = client.post(
        "/api/auth/login",
        json={"email": SEED_EMAIL, "password": "abc"},
    )
    assert resp.status_code == 422
    assert resp.json()["message"] == "Password must be at least 6 characters"


def test_login_422_missing_password(client: TestClient) -> None:
    resp = client.post("/api/auth/login", json={"email": SEED_EMAIL})
    assert resp.status_code == 422
    assert resp.json()["message"] == "Password is required"


# ---------------------------------------------------------------------------
# 429 — rate limiting (AC-10, AC-11)
# ---------------------------------------------------------------------------


def test_login_rate_limit_blocks_sixth_failed_attempt(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _install_lookup(monkeypatch, None)  # every attempt is a 401

    for _ in range(5):
        r = client.post(
            "/api/auth/login",
            json={"email": "nobody@example.com", "password": "password123"},
        )
        assert r.status_code == 401

    r6 = client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "password123"},
    )
    assert r6.status_code == 429
    assert r6.headers.get("retry-after") == "60"
    assert r6.json() == {
        "success": False,
        "data": None,
        "message": "Too many login attempts. Try again in 60 seconds.",
    }


def test_login_successful_login_resets_rate_limit_counter(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    admin_row: Dict[str, object],
) -> None:
    # 4 failures, then a success — the success should clear the counter.
    state: Dict[str, Optional[Dict[str, object]]] = {"row": None}

    def fake_lookup(email_lower: str):  # noqa: ARG001
        return state["row"]

    monkeypatch.setattr(main, "_find_user_by_email", fake_lookup)

    state["row"] = None
    for _ in range(4):
        r = client.post(
            "/api/auth/login",
            json={"email": "nobody@example.com", "password": "password123"},
        )
        assert r.status_code == 401

    # One success with correct creds — counter resets.
    state["row"] = admin_row
    ok = client.post(
        "/api/auth/login",
        json={"email": SEED_EMAIL, "password": SEED_PASSWORD},
    )
    assert ok.status_code == 200

    # Now 5 more failures should be needed before 429.
    state["row"] = None
    for _ in range(5):
        r = client.post(
            "/api/auth/login",
            json={"email": "nobody@example.com", "password": "password123"},
        )
        assert r.status_code == 401

    r_blocked = client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "password123"},
    )
    assert r_blocked.status_code == 429


# ---------------------------------------------------------------------------
# 500 — unexpected error
# ---------------------------------------------------------------------------


def test_login_500_envelope_on_unexpected_error(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def boom(email_lower: str):  # noqa: ARG001
        raise RuntimeError("db exploded")

    monkeypatch.setattr(main, "_find_user_by_email", boom)

    resp = client.post(
        "/api/auth/login",
        json={"email": SEED_EMAIL, "password": SEED_PASSWORD},
    )
    assert resp.status_code == 500
    assert resp.json() == {
        "success": False,
        "data": None,
        "message": "Something went wrong. Please try again.",
    }


# ---------------------------------------------------------------------------
# Envelope discipline (AC-16)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "case",
    [
        # (payload, expected_status, setup_row)
        ({"email": SEED_EMAIL, "password": SEED_PASSWORD}, 200, "admin"),
        ({"email": SEED_EMAIL, "password": "wrongwrong"}, 401, "admin"),
        ({"email": "bad", "password": "abcdef"}, 422, None),
    ],
)
def test_every_response_follows_envelope(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    admin_row: Dict[str, object],
    case,
) -> None:
    payload, expected, setup = case
    if setup == "admin":
        _install_lookup(monkeypatch, admin_row)
    else:
        _install_lookup(monkeypatch, None)

    resp = client.post("/api/auth/login", json=payload)
    assert resp.status_code == expected
    body = resp.json()
    assert set(body.keys()) == {"success", "data", "message"}
    assert isinstance(body["success"], bool)
    assert isinstance(body["message"], str)
