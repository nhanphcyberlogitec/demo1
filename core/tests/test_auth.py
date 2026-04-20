import uuid
from datetime import datetime, timezone
from unittest.mock import patch

import bcrypt
import pytest
from fastapi.testclient import TestClient
from jose import jwt

import main
from main import ACCESS_TOKEN_EXPIRE_MINUTES, ALGORITHM, SECRET_KEY, app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=4)).decode("utf-8")


def _user_row(
    *,
    email: str = "admin@example.com",
    password: str = "password123",
    full_name: str | None = "Admin User",
    is_active: bool = True,
    user_id: uuid.UUID | None = None,
) -> dict:
    return {
        "id": user_id or uuid.uuid4(),
        "email": email,
        "password_hash": _hash(password),
        "full_name": full_name,
        "is_active": is_active,
    }


def test_login_success_returns_envelope_and_valid_token(client: TestClient) -> None:
    user = _user_row()
    with patch.object(main, "fetch_user_by_email", return_value=user):
        res = client.post(
            "/api/auth/login",
            json={"email": "admin@example.com", "password": "password123"},
        )

    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["message"] == "Login successful."
    assert body["data"]["user"] == {
        "id": str(user["id"]),
        "email": "admin@example.com",
        "full_name": "Admin User",
    }

    token = body["data"]["token"]
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert payload["sub"] == str(user["id"])
    assert payload["email"] == "admin@example.com"
    now_ts = int(datetime.now(timezone.utc).timestamp())
    assert abs(payload["iat"] - now_ts) <= 5
    expected_exp = now_ts + ACCESS_TOKEN_EXPIRE_MINUTES * 60
    assert abs(payload["exp"] - expected_exp) <= 5


def test_login_wrong_password_returns_401_with_exact_message(client: TestClient) -> None:
    user = _user_row(password="correct-password")
    with patch.object(main, "fetch_user_by_email", return_value=user):
        res = client.post(
            "/api/auth/login",
            json={"email": "admin@example.com", "password": "wrong-password"},
        )

    assert res.status_code == 401
    body = res.json()
    assert body == {"success": False, "data": None, "message": "Invalid email or password."}


def test_login_unknown_email_returns_401_same_message(client: TestClient) -> None:
    with patch.object(main, "fetch_user_by_email", return_value=None):
        res = client.post(
            "/api/auth/login",
            json={"email": "nobody@example.com", "password": "password123"},
        )

    assert res.status_code == 401
    body = res.json()
    assert body == {"success": False, "data": None, "message": "Invalid email or password."}


def test_login_inactive_user_returns_401(client: TestClient) -> None:
    user = _user_row(is_active=False)
    with patch.object(main, "fetch_user_by_email", return_value=user):
        res = client.post(
            "/api/auth/login",
            json={"email": "admin@example.com", "password": "password123"},
        )

    assert res.status_code == 401
    assert res.json()["message"] == "Invalid email or password."


def test_login_malformed_email_returns_422(client: TestClient) -> None:
    res = client.post(
        "/api/auth/login",
        json={"email": "not-an-email", "password": "password123"},
    )
    assert res.status_code == 422
    assert res.json() == {"success": False, "data": None, "message": "Invalid request."}


def test_login_short_password_returns_422(client: TestClient) -> None:
    res = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "abc"},
    )
    assert res.status_code == 422
    assert res.json() == {"success": False, "data": None, "message": "Invalid request."}


def test_login_missing_password_returns_422(client: TestClient) -> None:
    res = client.post("/api/auth/login", json={"email": "admin@example.com"})
    assert res.status_code == 422
    assert res.json() == {"success": False, "data": None, "message": "Invalid request."}


def test_login_email_lookup_is_case_insensitive(client: TestClient) -> None:
    user = _user_row(email="admin@example.com")
    captured: dict = {}

    def fake_lookup(email: str):
        captured["email"] = email
        return user

    with patch.object(main, "fetch_user_by_email", side_effect=fake_lookup):
        res = client.post(
            "/api/auth/login",
            json={"email": "ADMIN@example.com", "password": "password123"},
        )

    assert res.status_code == 200
    assert captured["email"].lower() == "admin@example.com"
    assert res.json()["data"]["user"]["email"] == "admin@example.com"


def test_me_without_token_returns_401(client: TestClient) -> None:
    res = client.get("/api/auth/me")
    assert res.status_code == 401
    assert res.json() == {
        "success": False,
        "data": None,
        "message": "Session expired. Please sign in again.",
    }


def test_me_with_invalid_token_returns_401(client: TestClient) -> None:
    res = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert res.status_code == 401
    assert res.json()["message"] == "Session expired. Please sign in again."


def test_me_with_valid_token_returns_user(client: TestClient) -> None:
    user_id = uuid.uuid4()
    user = {
        "id": user_id,
        "email": "admin@example.com",
        "full_name": "Admin User",
        "is_active": True,
    }
    token = main._create_access_token(str(user_id), user["email"])

    with patch.object(main, "fetch_user_by_id", return_value=user):
        res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["data"]["user"] == {
        "id": str(user_id),
        "email": "admin@example.com",
        "full_name": "Admin User",
    }
