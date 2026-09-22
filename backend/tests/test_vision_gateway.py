"""
Tests for ContextVault Vision AI Gateway & Normalization Engine (Sprint P2-C).
Verifies:
- /api/vision/ping, /api/vision/health, /api/vision/model-info
- /api/vision/analyze, /api/vision/batch
- Regex helpers (amount, date, upi, pnr, flight, order_id, merchant, currency)
- Standardized normalized response contract compliance
"""

import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.vision_gateway_service import vision_gateway_service


@pytest.fixture
def client():
    return TestClient(app)


def test_vision_ping_endpoint(client):
    response = client.get("/api/vision/ping")
    assert response.status_code == 200
    data = response.json()
    assert "online" in data
    assert "latency" in data


def test_vision_health_endpoint(client):
    response = client.get("/api/vision/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "online" in data


def test_vision_model_info_endpoint(client):
    response = client.get("/api/vision/model-info")
    assert response.status_code == 200
    data = response.json()
    assert data["model"] == "Qwen/Qwen2.5-VL-3B-Instruct"
    assert "vram_allocated_gb" in data


def test_vision_analyze_normalized_schema(client):
    # Test file upload
    file_content = b"fake-screenshot-jpeg-bytes-content"
    files = {"image": ("payment_receipt.jpg", io.BytesIO(file_content), "image/jpeg")}

    response = client.post("/api/vision/analyze", files=files)
    assert response.status_code == 200
    data = response.json()

    # Verify strict standardized contract fields
    assert "title" in data
    assert "summary" in data
    assert "confidence" in data
    assert isinstance(data["confidence"], (int, float))
    assert 0.0 <= data["confidence"] <= 1.0
    assert "screen_type" in data
    assert "category" in data
    assert "folder_hierarchy" in data
    assert isinstance(data["folder_hierarchy"], list)
    assert "entities" in data
    assert isinstance(data["entities"], dict)
    assert "tags" in data
    assert isinstance(data["tags"], list)
    assert "ocr_text" in data
    assert len(data["ocr_text"]) > 0
    assert "bullet_points" in data
    assert isinstance(data["bullet_points"], list)


def test_vision_batch_endpoint(client):
    files = [
        ("images", ("shot1.jpg", io.BytesIO(b"bytes1"), "image/jpeg")),
        ("images", ("shot2.jpg", io.BytesIO(b"bytes2"), "image/jpeg")),
    ]
    response = client.post("/api/vision/batch", files=files)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 2
    for item in data:
        assert "ocr_text" in item
        assert "folder_hierarchy" in item


def test_regex_helpers():
    # Amount extraction
    assert vision_gateway_service.extract_amount("Total paid ₹1,450.50 via UPI") == 1450.50
    assert vision_gateway_service.extract_amount("Amount: INR 450") == 450.0
    assert vision_gateway_service.extract_amount("Total: $29.99") == 29.99

    # Currency normalization
    assert vision_gateway_service.normalize_currency("Paid in USD $50") == "USD"
    assert vision_gateway_service.normalize_currency("Transferred ₹500") == "INR"

    # Date extraction
    assert vision_gateway_service.extract_date("Transaction on 2026-09-22T10:45:00") == "2026-09-22T10:45:00"

    # UPI extraction
    assert vision_gateway_service.extract_upi_id("Paid to merchant@okaxis successfully") == "merchant@okaxis"

    # PNR extraction
    assert vision_gateway_service.extract_pnr("IRCTC PNR: 4521098471 confirmed") == "4521098471"
    assert vision_gateway_service.extract_pnr("Flight Booking Ref: WXYZ89") == "WXYZ89"

    # Flight number extraction
    assert vision_gateway_service.extract_flight_number("Flight 6E 2041 to Mumbai") == "6E2041"

    # Merchant cleaning
    assert vision_gateway_service.clean_merchant("Paid to Starbucks India Pvt Ltd") == "Starbucks India"


def test_normalization_with_rich_input():
    raw = {
        "title": "Starbucks Order",
        "summary": "Coffee purchase",
        "category": "finance",
        "ocr_text": "Paid ₹450 to Starbucks India via Google Pay",
        "application": "Starbucks India",
        "entities": {
            "bank": "HDFC Bank",
            "orderId": "ORD-123456",
        },
        "tags": ["starbucks", "coffee"],
        "confidence": 98,
    }

    normalized = vision_gateway_service.normalize_vision_response(raw)

    assert normalized["confidence"] == 0.98
    assert normalized["merchant"] == "Starbucks India"
    assert normalized["amount"] == 450.0
    assert normalized["currency"] == "INR"
    assert normalized["payment_method"] == "UPI"
    assert normalized["entities"]["bank"] == "HDFC Bank"
    assert normalized["entities"]["orderId"] == "ORD-123456"
    assert "starbucks" in normalized["tags"]
    assert "finance" in normalized["tags"]
    assert "Starbucks India" in normalized["folder_hierarchy"]
    assert normalized["ocr_text"] == "Paid ₹450 to Starbucks India via Google Pay"
