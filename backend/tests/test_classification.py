from fastapi.testclient import TestClient
from app.services.classification_service import ClassificationService


def test_classification_service_entity_extraction():
    service = ClassificationService()
    text = """
    TAX INVOICE
    Amazon Seller Services Pvt Ltd
    Order # 402-1234567-8901234
    Date: 2026-09-01
    Bill To: john.doe@example.com
    Customer Support: +1 (555) 234-5678
    Tracking: https://amazon.com/orders/track
    Item: Mechanical Keyboard
    Subtotal: $120.00
    Tax: $12.00
    Total Paid: $132.00
    """
    entities = service.extract_entities(text)
    assert any("132.00" in a or "120.00" in a for a in entities.amounts)
    assert any("amazon.com" in u for u in entities.urls)
    assert "john.doe@example.com" in entities.emails
    assert "Amazon" in entities.merchants
    assert any("2026-09-01" in d for d in entities.dates)


def test_classification_service_code_detection():
    service = ClassificationService()
    text = """
    import sys
    from fastapi import FastAPI
    def start_server():
        app = FastAPI()
        return app
    # git commit -m "fix server"
    Traceback (most recent call last):
    SyntaxError: unexpected EOF while parsing
    """
    result = service.classify(ocr_text=text, file_name="screenshot_vscode.png", detected_app="VS Code")
    assert result.category == "Code & Tech"
    assert result.confidence >= 0.70
    assert result.subCategory in ["GitHub", "Stack Traces", "Snippets", "Terminal & Logs"]


def test_classification_service_finance_upi():
    service = ClassificationService()
    text = "Paid to Starbucks. UPI Ref No: 239482938492. Account balance debited ₹350.00. Transaction successful."
    result = service.classify(ocr_text=text, detected_app="Google Pay")
    assert result.category == "Finance & Banking"
    assert result.subCategory == "UPI Transfers"
    assert result.detectedApp == "Google Pay"


def test_classify_endpoint(client: TestClient, auth_headers: dict):
    resp = client.post(
        "/api/classification/classify",
        headers=auth_headers,
        json={
            "ocrText": "Flight Boarding Pass Seat: 14B Terminal 2 Gate 42 Airline: Delta Departure: 08:30 JFK",
            "fileName": "boarding_pass.png",
            "detectedApp": None,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    data = body["data"]
    assert data["category"] == "Travel & Tickets"
    assert data["subCategory"] == "Flights"
    assert data["confidence"] > 0.6
