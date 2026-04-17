import os
import sys
import uuid

import pytest
from fastapi.testclient import TestClient

CORE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if CORE_DIR not in sys.path:
    sys.path.insert(0, CORE_DIR)

from main import app  # noqa: E402
from database import get_connection, release_connection  # noqa: E402


ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "password123"


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


@pytest.fixture(scope="session")
def admin_token(client):
    resp = client.post(
        "/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]["token"]


@pytest.fixture(scope="session")
def admin_id(client, admin_token):
    resp = client.get(
        "/api/accounts",
        params={"q": ADMIN_EMAIL},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    match = next(u for u in items if u["email"] == ADMIN_EMAIL)
    return match["id"]


@pytest.fixture
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


_CREATED_EMAILS: list[str] = []


def _cleanup_email(email: str):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE LOWER(email) = %s", (email.lower(),))
            conn.commit()
    finally:
        release_connection(conn)


@pytest.fixture
def temp_email():
    def _make(prefix: str = "qa") -> str:
        email = f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"
        _CREATED_EMAILS.append(email)
        return email

    yield _make


@pytest.fixture(autouse=True)
def _cleanup_after_test():
    yield
    while _CREATED_EMAILS:
        email = _CREATED_EMAILS.pop()
        try:
            _cleanup_email(email)
        except Exception:
            pass


@pytest.fixture
def created_user(client, auth_headers, temp_email):
    email = temp_email("user")
    resp = client.post(
        "/api/accounts",
        json={
            "name": "QA Test User",
            "email": email,
            "password": "Qapass123",
            "is_active": True,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["data"]
