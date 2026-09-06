from fastapi.testclient import TestClient
from unittest.mock import patch


def test_health_check_healthy(client: TestClient):
    with patch("app.api.v1.health.check_database_connection", return_value=True):
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        assert "version" in data


def test_health_check_degraded(client: TestClient):
    with patch("app.api.v1.health.check_database_connection", return_value=False):
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["database"] == "disconnected"


def test_version_endpoint(client: TestClient):
    response = client.get("/api/version")
    assert response.status_code == 200
    data = response.json()
    assert data["version"] == "1.0.0"
    assert data["name"] == "ContextVault API"
    assert "environment" in data
