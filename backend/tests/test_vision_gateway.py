import io
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch


def test_vision_health_healthy(client: TestClient):
    mock_health = {
        "status": "healthy",
        "modelLoaded": True,
        "provider": "local",
        "model": "Qwen2.5-VL-3B-Instruct",
        "device": "cuda",
        "gpu": "RTX 4050",
    }
    with patch("app.api.v1.vision.vision_gateway_service.check_health", new_callable=AsyncMock) as mock_check:
        mock_check.return_value = mock_health
        response = client.get("/api/vision/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["modelLoaded"] is True
        assert data["gpu"] == "RTX 4050"


def test_vision_model_info(client: TestClient):
    mock_info = {
        "modelName": "Qwen2.5-VL-3B-Instruct",
        "precision": "fp16",
        "device": "cuda",
        "vramUsage": "4.2 GB / 6.0 GB",
        "maxResolution": 1024,
    }
    with patch("app.api.v1.vision.vision_gateway_service.get_model_info", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_info
        response = client.get("/api/vision/model-info")
        assert response.status_code == 200
        data = response.json()
        assert data["modelName"] == "Qwen2.5-VL-3B-Instruct"
        assert data["maxResolution"] == 1024


def test_vision_analyze_proxy(client: TestClient):
    mock_result = {
        "category": "Finance",
        "confidence": 98,
        "summary": "UPI payment to Swiggy for ₹550.",
        "tags": ["upi", "swiggy", "food", "payment"],
        "entities": {
            "merchant": "Swiggy",
            "amount": "550",
            "currency": "INR",
            "date": "2026-09-17",
            "paymentMethod": "UPI",
        },
    }
    with patch("app.api.v1.vision.vision_gateway_service.analyze_image", new_callable=AsyncMock) as mock_analyze:
        mock_analyze.return_value = mock_result
        file_content = b"fake_image_bytes_123"
        files = {"image": ("test.jpg", io.BytesIO(file_content), "image/jpeg")}
        response = client.post("/api/vision/analyze", files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "Finance"
        assert data["confidence"] == 98
        assert data["entities"]["merchant"] == "Swiggy"
