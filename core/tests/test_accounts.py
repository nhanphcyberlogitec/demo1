"""
Test coverage for /api/accounts endpoints per BACKEND_API.md.
Runs against the real Postgres DB via TestClient -> core.main:app.
"""


# ---------------------------------------------------------------------------
# Auth gate — every /api/accounts* route requires a valid JWT (401 otherwise)
# ---------------------------------------------------------------------------


class TestAuthGate:
    def test_list_without_token_returns_401(self, client):
        r = client.get("/api/accounts")
        assert r.status_code == 401
        body = r.json()
        assert body["success"] is False
        assert body["message"] == "Not authenticated"
        assert body["data"] is None

    def test_list_with_malformed_header_returns_401(self, client):
        r = client.get("/api/accounts", headers={"Authorization": "NotBearer xxx"})
        assert r.status_code == 401

    def test_list_with_bad_token_returns_401(self, client):
        r = client.get(
            "/api/accounts", headers={"Authorization": "Bearer totally.invalid.token"}
        )
        assert r.status_code == 401

    def test_detail_without_token_returns_401(self, client):
        r = client.get("/api/accounts/00000000-0000-0000-0000-000000000000")
        assert r.status_code == 401

    def test_create_without_token_returns_401(self, client):
        r = client.post("/api/accounts", json={})
        assert r.status_code == 401

    def test_patch_without_token_returns_401(self, client):
        r = client.patch(
            "/api/accounts/00000000-0000-0000-0000-000000000000", json={"name": "x"}
        )
        assert r.status_code == 401

    def test_status_without_token_returns_401(self, client):
        r = client.patch(
            "/api/accounts/00000000-0000-0000-0000-000000000000/status",
            json={"is_active": False},
        )
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/accounts — list, filter, paginate
# ---------------------------------------------------------------------------


class TestListAccounts:
    def test_happy_path_returns_envelope_with_items(self, client, auth_headers):
        r = client.get("/api/accounts", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        data = body["data"]
        assert set(data.keys()) == {"items", "page", "page_size", "total"}
        assert data["page"] == 1
        assert data["page_size"] == 20
        assert isinstance(data["items"], list)
        if data["items"]:
            item = data["items"][0]
            assert set(item.keys()) >= {
                "id",
                "email",
                "name",
                "is_active",
                "created_at",
                "updated_at",
            }
            # password_hash must never be exposed
            assert "password_hash" not in item

    def test_status_filter_active(self, client, auth_headers, created_user):
        r = client.get(
            "/api/accounts",
            params={"status": "active"},
            headers=auth_headers,
        )
        assert r.status_code == 200
        items = r.json()["data"]["items"]
        assert all(u["is_active"] for u in items)

    def test_status_filter_inactive_excludes_active_rows(
        self, client, auth_headers, created_user
    ):
        r = client.get(
            "/api/accounts",
            params={"status": "inactive"},
            headers=auth_headers,
        )
        assert r.status_code == 200
        items = r.json()["data"]["items"]
        assert all(u["is_active"] is False for u in items)

    def test_invalid_status_returns_422(self, client, auth_headers):
        r = client.get(
            "/api/accounts", params={"status": "banana"}, headers=auth_headers
        )
        assert r.status_code == 422
        body = r.json()
        assert body["success"] is False
        assert body["data"]["errors"].get("status")

    def test_search_q_matches_email_substring(
        self, client, auth_headers, created_user
    ):
        partial = created_user["email"].split("@")[0][:6]
        r = client.get(
            "/api/accounts", params={"q": partial}, headers=auth_headers
        )
        assert r.status_code == 200
        emails = [u["email"] for u in r.json()["data"]["items"]]
        assert created_user["email"] in emails

    def test_page_size_out_of_range_returns_422(self, client, auth_headers):
        r = client.get(
            "/api/accounts", params={"page_size": "500"}, headers=auth_headers
        )
        assert r.status_code == 422

    def test_page_zero_returns_422(self, client, auth_headers):
        r = client.get("/api/accounts", params={"page": "0"}, headers=auth_headers)
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/accounts/{id}
# ---------------------------------------------------------------------------


class TestGetAccount:
    def test_happy_path(self, client, auth_headers, created_user):
        r = client.get(
            f"/api/accounts/{created_user['id']}", headers=auth_headers
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["data"]["id"] == created_user["id"]
        assert body["data"]["email"] == created_user["email"]
        assert "password_hash" not in body["data"]

    def test_nonexistent_uuid_returns_404(self, client, auth_headers):
        r = client.get(
            "/api/accounts/00000000-0000-0000-0000-000000000000",
            headers=auth_headers,
        )
        assert r.status_code == 404
        body = r.json()
        assert body["success"] is False
        assert body["message"] == "Account not found"

    def test_malformed_uuid_returns_404(self, client, auth_headers):
        r = client.get("/api/accounts/not-a-uuid", headers=auth_headers)
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/accounts
# ---------------------------------------------------------------------------


class TestCreateAccount:
    def test_create_happy_path(self, client, auth_headers, temp_email):
        email = temp_email("create")
        r = client.post(
            "/api/accounts",
            json={
                "name": "Jane Doe",
                "email": email,
                "password": "Valid1234",
                "is_active": True,
            },
            headers=auth_headers,
        )
        assert r.status_code == 201
        body = r.json()
        assert body["success"] is True
        assert body["message"] == "Account created"
        user = body["data"]
        assert user["email"] == email.lower()
        assert user["name"] == "Jane Doe"
        assert user["is_active"] is True
        assert "password_hash" not in user
        assert "password" not in user

    def test_create_default_is_active(self, client, auth_headers, temp_email):
        email = temp_email("default")
        r = client.post(
            "/api/accounts",
            json={"name": "Default Active", "email": email, "password": "Valid1234"},
            headers=auth_headers,
        )
        assert r.status_code == 201
        assert r.json()["data"]["is_active"] is True

    def test_duplicate_email_returns_409(
        self, client, auth_headers, created_user
    ):
        r = client.post(
            "/api/accounts",
            json={
                "name": "Dup",
                "email": created_user["email"],
                "password": "Valid1234",
            },
            headers=auth_headers,
        )
        assert r.status_code == 409
        body = r.json()
        assert body["success"] is False
        assert body["message"] == "An account with this email already exists"

    def test_duplicate_email_case_insensitive_returns_409(
        self, client, auth_headers, created_user
    ):
        r = client.post(
            "/api/accounts",
            json={
                "name": "Dup upper",
                "email": created_user["email"].upper(),
                "password": "Valid1234",
            },
            headers=auth_headers,
        )
        assert r.status_code == 409

    def test_bad_email_returns_422(self, client, auth_headers):
        r = client.post(
            "/api/accounts",
            json={
                "name": "Bad email",
                "email": "not-an-email",
                "password": "Valid1234",
            },
            headers=auth_headers,
        )
        assert r.status_code == 422
        body = r.json()
        assert "email" in (body["data"]["errors"] or {})

    def test_short_password_returns_422(self, client, auth_headers, temp_email):
        email = temp_email("short")
        r = client.post(
            "/api/accounts",
            json={"name": "Short pw", "email": email, "password": "abc1"},
            headers=auth_headers,
        )
        assert r.status_code == 422
        body = r.json()
        assert "password" in body["data"]["errors"]

    def test_password_missing_digit_returns_422(
        self, client, auth_headers, temp_email
    ):
        email = temp_email("nodigit")
        r = client.post(
            "/api/accounts",
            json={
                "name": "No digit",
                "email": email,
                "password": "onlyletters",
            },
            headers=auth_headers,
        )
        assert r.status_code == 422
        assert "password" in r.json()["data"]["errors"]

    def test_password_missing_letter_returns_422(
        self, client, auth_headers, temp_email
    ):
        email = temp_email("noletter")
        r = client.post(
            "/api/accounts",
            json={
                "name": "No letter",
                "email": email,
                "password": "12345678",
            },
            headers=auth_headers,
        )
        assert r.status_code == 422
        assert "password" in r.json()["data"]["errors"]

    def test_blank_name_returns_422(self, client, auth_headers, temp_email):
        email = temp_email("blankname")
        r = client.post(
            "/api/accounts",
            json={"name": "   ", "email": email, "password": "Valid1234"},
            headers=auth_headers,
        )
        assert r.status_code == 422
        assert "name" in r.json()["data"]["errors"]

    def test_name_too_long_returns_422(self, client, auth_headers, temp_email):
        email = temp_email("longname")
        r = client.post(
            "/api/accounts",
            json={"name": "x" * 101, "email": email, "password": "Valid1234"},
            headers=auth_headers,
        )
        assert r.status_code == 422
        assert "name" in r.json()["data"]["errors"]


# ---------------------------------------------------------------------------
# PATCH /api/accounts/{id}
# ---------------------------------------------------------------------------


class TestUpdateAccount:
    def test_update_name_happy(self, client, auth_headers, created_user):
        r = client.patch(
            f"/api/accounts/{created_user['id']}",
            json={"name": "Updated Name"},
            headers=auth_headers,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["message"] == "Changes saved"
        assert body["data"]["name"] == "Updated Name"

    def test_update_email_happy(
        self, client, auth_headers, created_user, temp_email
    ):
        new_email = temp_email("updated")
        r = client.patch(
            f"/api/accounts/{created_user['id']}",
            json={"email": new_email},
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["data"]["email"] == new_email.lower()

    def test_update_nonexistent_returns_404(self, client, auth_headers):
        r = client.patch(
            "/api/accounts/00000000-0000-0000-0000-000000000000",
            json={"name": "n"},
            headers=auth_headers,
        )
        assert r.status_code == 404

    def test_update_malformed_id_returns_404(self, client, auth_headers):
        r = client.patch(
            "/api/accounts/not-a-uuid",
            json={"name": "n"},
            headers=auth_headers,
        )
        assert r.status_code == 404

    def test_update_colliding_email_returns_409(
        self, client, auth_headers, created_user, temp_email
    ):
        # make a second user
        other_email = temp_email("other")
        r = client.post(
            "/api/accounts",
            json={
                "name": "Other",
                "email": other_email,
                "password": "Valid1234",
            },
            headers=auth_headers,
        )
        assert r.status_code == 201
        other = r.json()["data"]

        r = client.patch(
            f"/api/accounts/{other['id']}",
            json={"email": created_user["email"]},
            headers=auth_headers,
        )
        assert r.status_code == 409

    def test_empty_body_returns_422(self, client, auth_headers, created_user):
        r = client.patch(
            f"/api/accounts/{created_user['id']}",
            json={},
            headers=auth_headers,
        )
        assert r.status_code == 422
        assert r.json()["message"] == "No changes submitted"

    def test_invalid_email_format_returns_422(
        self, client, auth_headers, created_user
    ):
        r = client.patch(
            f"/api/accounts/{created_user['id']}",
            json={"email": "not-an-email"},
            headers=auth_headers,
        )
        assert r.status_code == 422
        assert "email" in r.json()["data"]["errors"]


# ---------------------------------------------------------------------------
# PATCH /api/accounts/{id}/status — activate / deactivate + self-protection
# ---------------------------------------------------------------------------


class TestUpdateStatus:
    def test_deactivate_happy(self, client, auth_headers, created_user):
        r = client.patch(
            f"/api/accounts/{created_user['id']}/status",
            json={"is_active": False},
            headers=auth_headers,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["message"] == "Account deactivated"
        assert body["data"]["is_active"] is False

    def test_activate_happy(self, client, auth_headers, created_user):
        # First deactivate, then activate
        client.patch(
            f"/api/accounts/{created_user['id']}/status",
            json={"is_active": False},
            headers=auth_headers,
        )
        r = client.patch(
            f"/api/accounts/{created_user['id']}/status",
            json={"is_active": True},
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["message"] == "Account activated"
        assert r.json()["data"]["is_active"] is True

    def test_self_deactivation_returns_403(self, client, auth_headers, admin_id):
        r = client.patch(
            f"/api/accounts/{admin_id}/status",
            json={"is_active": False},
            headers=auth_headers,
        )
        assert r.status_code == 403
        body = r.json()
        assert body["success"] is False
        assert body["message"] == "You cannot deactivate your own account"

    def test_self_activation_allowed(self, client, auth_headers, admin_id):
        # Self-reactivation is allowed (not blocked by self-protection)
        r = client.patch(
            f"/api/accounts/{admin_id}/status",
            json={"is_active": True},
            headers=auth_headers,
        )
        assert r.status_code == 200

    def test_nonexistent_returns_404(self, client, auth_headers):
        r = client.patch(
            "/api/accounts/00000000-0000-0000-0000-000000000000/status",
            json={"is_active": False},
            headers=auth_headers,
        )
        assert r.status_code == 404

    def test_malformed_id_returns_404(self, client, auth_headers):
        r = client.patch(
            "/api/accounts/not-a-uuid/status",
            json={"is_active": False},
            headers=auth_headers,
        )
        assert r.status_code == 404

    def test_missing_is_active_returns_422(
        self, client, auth_headers, created_user
    ):
        r = client.patch(
            f"/api/accounts/{created_user['id']}/status",
            json={},
            headers=auth_headers,
        )
        assert r.status_code == 422

    def test_non_boolean_is_active_returns_422(
        self, client, auth_headers, created_user
    ):
        r = client.patch(
            f"/api/accounts/{created_user['id']}/status",
            json={"is_active": "nope"},
            headers=auth_headers,
        )
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/auth/login — inactive user gate
# ---------------------------------------------------------------------------


class TestLoginInactiveGate:
    def test_inactive_user_cannot_login(
        self, client, auth_headers, temp_email
    ):
        email = temp_email("inactive")
        password = "LoginPw123"
        r = client.post(
            "/api/accounts",
            json={
                "name": "Gate Tester",
                "email": email,
                "password": password,
                "is_active": True,
            },
            headers=auth_headers,
        )
        assert r.status_code == 201
        user = r.json()["data"]

        # Verify initially can login
        r = client.post(
            "/api/auth/login", json={"email": email, "password": password}
        )
        assert r.status_code == 200

        # Deactivate
        r = client.patch(
            f"/api/accounts/{user['id']}/status",
            json={"is_active": False},
            headers=auth_headers,
        )
        assert r.status_code == 200

        # Now login should fail with 401 "Account is inactive"
        r = client.post(
            "/api/auth/login", json={"email": email, "password": password}
        )
        assert r.status_code == 401
        body = r.json()
        assert body["success"] is False
        assert body["message"] == "Account is inactive"
        assert body["data"] is None

    def test_inactive_with_wrong_password_returns_generic_401(
        self, client, auth_headers, temp_email
    ):
        """Password is checked before is_active, so wrong password on an inactive
        user returns "Invalid email or password", not "Account is inactive"."""
        email = temp_email("leak")
        r = client.post(
            "/api/accounts",
            json={
                "name": "Leak Test",
                "email": email,
                "password": "Correct123",
                "is_active": True,
            },
            headers=auth_headers,
        )
        user = r.json()["data"]

        client.patch(
            f"/api/accounts/{user['id']}/status",
            json={"is_active": False},
            headers=auth_headers,
        )

        r = client.post(
            "/api/auth/login", json={"email": email, "password": "WrongPw123"}
        )
        assert r.status_code == 401
        assert r.json()["message"] == "Invalid email or password"
