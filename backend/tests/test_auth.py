from fastapi.testclient import TestClient


def test_auth_full_flow(client: TestClient):
    # 1. Register user
    reg_payload = {
        "username": "kirtandarji",
        "email": "kirtan@contextvault.com",
        "password": "SuperSecretPassword123!",
    }
    reg_resp = client.post("/api/auth/register", json=reg_payload)
    assert reg_resp.status_code == 201, reg_resp.text
    reg_data = reg_resp.json()
    assert reg_data["success"] is True
    assert "accessToken" in reg_data["data"]
    assert "refreshToken" in reg_data["data"]
    assert reg_data["data"]["username"] == "kirtandarji"
    assert reg_data["data"]["email"] == "kirtan@contextvault.com"

    access_token = reg_data["data"]["accessToken"]
    refresh_token = reg_data["data"]["refreshToken"]

    # 2. Duplicate registration should fail
    dup_resp = client.post("/api/auth/register", json=reg_payload)
    assert dup_resp.status_code == 409
    dup_data = dup_resp.json()
    assert dup_data["success"] is False
    assert len(dup_data["errors"]) > 0

    # 3. Login with email
    login_payload = {
        "emailOrUsername": "kirtan@contextvault.com",
        "password": "SuperSecretPassword123!",
    }
    login_resp = client.post("/api/auth/login", json=login_payload)
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    assert login_data["success"] is True
    assert "accessToken" in login_data["data"]

    # 4. Login with wrong password
    bad_login_resp = client.post(
        "/api/auth/login",
        json={"emailOrUsername": "kirtandarji", "password": "WrongPassword!"},
    )
    assert bad_login_resp.status_code == 401
    bad_data = bad_login_resp.json()
    assert bad_data["success"] is False

    # 5. Access Profile with Bearer token
    profile_resp = client.get(
        "/api/auth/profile",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert profile_resp.status_code == 200
    profile_data = profile_resp.json()
    assert profile_data["success"] is True
    assert profile_data["data"]["username"] == "kirtandarji"
    assert profile_data["data"]["email"] == "kirtan@contextvault.com"

    # 6. Access Profile without token
    unauth_resp = client.get("/api/auth/profile")
    assert unauth_resp.status_code == 401
    unauth_data = unauth_resp.json()
    assert unauth_data["success"] is False

    # 7. Refresh token
    refresh_resp = client.post(
        "/api/auth/refresh",
        json={"refreshToken": refresh_token},
    )
    assert refresh_resp.status_code == 200
    refresh_data = refresh_resp.json()
    assert refresh_data["success"] is True
    assert "accessToken" in refresh_data["data"]
    new_refresh = refresh_data["data"]["refreshToken"]

    # 8. Re-using old rotated refresh token should fail
    reused_resp = client.post(
        "/api/auth/refresh",
        json={"refreshToken": refresh_token},
    )
    assert reused_resp.status_code == 401

    # 9. Logout / Revoke current refresh token
    logout_resp = client.post(
        "/api/auth/logout",
        json={"refreshToken": new_refresh},
    )
    assert logout_resp.status_code == 200
    logout_data = logout_resp.json()
    assert logout_data["success"] is True
