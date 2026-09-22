"""
Pytest test suite for VisionGatewayService (ContextVault Vision AI Gateway).

Coverage map
------------
 1.  check_health()  — 200 response   → status=="healthy", online==True
 2.  check_health()  — ConnectError   → status=="offline", online==False
 3.  ping_server()   — 200 response   → online==True, latency > 0
 4.  ping_server()   — ConnectError   → online==False, latency==0
 5.  get_model_info() — 200 response  → dict has "model" key
 6.  get_model_info() — ConnectError  → fallback dict has "model" key
 7.  analyze_image() — 200 + raw JSON → category=="finance", merchant, amount
 8.  analyze_image() — ConnectError ×2 → fallback with category=="other"
 9.  analyze_batch() — 2 images       → list of 2 results
10.  normalize_vision_response()      — rich input validation
11.  extract_amount('₹1,234.50')      → 1234.5
12.  extract_amount('no amount here') → None
13.  extract_date('2026-09-22')       → '2026-09-22'
14.  extract_upi_id(...)              → 'merchant@oksbi'
15.  clean_merchant(...)              → 'Swiggy'

No real network calls are made. All HTTP traffic is intercepted with
httpx.MockTransport or unittest.mock.patch / AsyncMock.
"""

from __future__ import annotations

import json
from typing import Any, Dict
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
import pytest_asyncio  # noqa: F401 — ensures plugin is present

from app.services.vision_gateway_service import VisionGatewayService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

BASE_URL = "http://vision-test-server:8001"

# A fresh service instance that always points at our fake URL so we never
# accidentally hit a real server even if a mock leaks.
def _make_service() -> VisionGatewayService:
    return VisionGatewayService(
        base_url=BASE_URL,
        timeout=10,
        health_timeout=5,
    )


def _mock_transport(status_code: int = 200, json_body: Any = None, text_body: str = "") -> httpx.MockTransport:
    """Return an httpx.MockTransport that always responds with the given status / body."""
    if json_body is not None:
        content = json.dumps(json_body).encode()
        headers = {"content-type": "application/json"}
    else:
        content = text_body.encode()
        headers = {"content-type": "text/plain"}

    def _handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code=status_code, content=content, headers=headers)

    return httpx.MockTransport(_handler)


def _connect_error_transport() -> httpx.MockTransport:
    """Return a MockTransport that always raises httpx.ConnectError."""
    def _handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Connection refused")

    return httpx.MockTransport(_handler)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def svc() -> VisionGatewayService:
    """Fresh VisionGatewayService instance per test."""
    return _make_service()


# ---------------------------------------------------------------------------
# 1. check_health() — 200 healthy response
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_check_health_online(svc: VisionGatewayService) -> None:
    """Health endpoint returns 200 → status='healthy', online=True."""
    health_json = {"status": "healthy", "model": "Qwen2.5-VL-3B-Instruct"}
    transport = _mock_transport(200, health_json)

    with patch("httpx.AsyncClient", lambda **kw: httpx.AsyncClient(transport=transport, **{k: v for k, v in kw.items() if k != "transport"})):
        # Patch AsyncClient to use our mock transport
        original_init = httpx.AsyncClient.__init__

        class _PatchedClient(httpx.AsyncClient):
            def __init__(self, **kwargs: Any) -> None:
                kwargs.pop("transport", None)
                super().__init__(transport=transport, **kwargs)

        with patch("app.services.vision_gateway_service.httpx.AsyncClient", _PatchedClient):
            result = await svc.check_health()

    assert result["status"] == "healthy"
    assert result["online"] is True


# ---------------------------------------------------------------------------
# 2. check_health() — ConnectError → offline
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_check_health_offline(svc: VisionGatewayService) -> None:
    """ConnectError on health check → status='offline', online=False."""
    transport = _connect_error_transport()

    class _PatchedClient(httpx.AsyncClient):
        def __init__(self, **kwargs: Any) -> None:
            kwargs.pop("transport", None)
            super().__init__(transport=transport, **kwargs)

    with patch("app.services.vision_gateway_service.httpx.AsyncClient", _PatchedClient):
        result = await svc.check_health()

    assert result["status"] == "offline"
    assert result["online"] is False


# ---------------------------------------------------------------------------
# 3. ping_server() — 200 → online=True, latency > 0
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ping_server_online(svc: VisionGatewayService) -> None:
    """Successful ping → online=True and latency is positive."""
    transport = _mock_transport(200, {"ok": True})

    class _PatchedClient(httpx.AsyncClient):
        def __init__(self, **kwargs: Any) -> None:
            kwargs.pop("transport", None)
            super().__init__(transport=transport, **kwargs)

    with patch("app.services.vision_gateway_service.httpx.AsyncClient", _PatchedClient):
        result = await svc.ping_server()

    assert result["online"] is True
    assert result["latency"] > 0


# ---------------------------------------------------------------------------
# 4. ping_server() — ConnectError → online=False, latency==0
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ping_server_offline(svc: VisionGatewayService) -> None:
    """ConnectError on ping → online=False, latency==0."""
    transport = _connect_error_transport()

    class _PatchedClient(httpx.AsyncClient):
        def __init__(self, **kwargs: Any) -> None:
            kwargs.pop("transport", None)
            super().__init__(transport=transport, **kwargs)

    with patch("app.services.vision_gateway_service.httpx.AsyncClient", _PatchedClient):
        result = await svc.ping_server()

    assert result["online"] is False
    assert result["latency"] == 0


# ---------------------------------------------------------------------------
# 5. get_model_info() — 200 → dict has "model" key
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_model_info_online(svc: VisionGatewayService) -> None:
    """get_model_info returns server JSON that contains 'model' key."""
    model_json = {
        "model": "Qwen/Qwen2.5-VL-3B-Instruct",
        "provider": "local_qwen_vl",
        "vram_allocated_gb": "~4.2 GB",
    }
    transport = _mock_transport(200, model_json)

    class _PatchedClient(httpx.AsyncClient):
        def __init__(self, **kwargs: Any) -> None:
            kwargs.pop("transport", None)
            super().__init__(transport=transport, **kwargs)

    with patch("app.services.vision_gateway_service.httpx.AsyncClient", _PatchedClient):
        result = await svc.get_model_info()

    assert "model" in result
    assert result["model"] == "Qwen/Qwen2.5-VL-3B-Instruct"


# ---------------------------------------------------------------------------
# 6. get_model_info() — ConnectError → fallback dict with "model" key
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_model_info_offline_fallback(svc: VisionGatewayService) -> None:
    """ConnectError on get_model_info → built-in fallback dict with 'model' key."""
    transport = _connect_error_transport()

    class _PatchedClient(httpx.AsyncClient):
        def __init__(self, **kwargs: Any) -> None:
            kwargs.pop("transport", None)
            super().__init__(transport=transport, **kwargs)

    with patch("app.services.vision_gateway_service.httpx.AsyncClient", _PatchedClient):
        result = await svc.get_model_info()

    assert "model" in result
    # Must fall back to the hardcoded Qwen model string
    assert "Qwen" in result["model"]


# ---------------------------------------------------------------------------
# 7. analyze_image() — 200 with vision JSON → normalized response
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_analyze_image_success(svc: VisionGatewayService) -> None:
    """Successful vision analysis returns normalized dict with correct fields."""
    raw_vision_response = {
        "title": "Receipt",
        "category": "finance",
        "confidence": 0.95,
        "ocr_text": "Paid ₹150 to Swiggy",
        "merchant": "Swiggy",
        "amount": 150,
    }
    transport = _mock_transport(200, raw_vision_response)

    class _PatchedClient(httpx.AsyncClient):
        def __init__(self, **kwargs: Any) -> None:
            kwargs.pop("transport", None)
            super().__init__(transport=transport, **kwargs)

    with patch("app.services.vision_gateway_service.httpx.AsyncClient", _PatchedClient):
        result = await svc.analyze_image(b"fake-bytes", "receipt.jpg", "image/jpeg")

    assert result["category"] == "finance"
    assert result["merchant"] == "Swiggy"
    assert result["amount"] == 150.0


# ---------------------------------------------------------------------------
# 8. analyze_image() — ConnectError on both attempts → fallback (category=="other")
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_analyze_image_fallback_on_connect_error(svc: VisionGatewayService) -> None:
    """Both retry attempts fail with ConnectError → local fallback response."""
    transport = _connect_error_transport()

    class _PatchedClient(httpx.AsyncClient):
        def __init__(self, **kwargs: Any) -> None:
            kwargs.pop("transport", None)
            super().__init__(transport=transport, **kwargs)

    # asyncio.sleep must not block tests; patch it out
    with patch("app.services.vision_gateway_service.asyncio.sleep", new_callable=AsyncMock):
        with patch("app.services.vision_gateway_service.httpx.AsyncClient", _PatchedClient):
            result = await svc.analyze_image(b"fake-bytes", "screen.jpg", "image/jpeg")

    # Fallback category is always "other"
    assert isinstance(result, dict)
    assert result["category"] == "other"


# ---------------------------------------------------------------------------
# 9. analyze_batch() — two images → list of 2 results
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_analyze_batch_returns_two_results(svc: VisionGatewayService) -> None:
    """analyze_batch with 2 files returns a list of exactly 2 dicts."""
    # Use a fallback-friendly transport so no real server is needed
    transport = _connect_error_transport()

    class _PatchedClient(httpx.AsyncClient):
        def __init__(self, **kwargs: Any) -> None:
            kwargs.pop("transport", None)
            super().__init__(transport=transport, **kwargs)

    files_data = [
        ("img1", b"bytes1", "shot1.jpg"),
        ("img2", b"bytes2", "shot2.jpg"),
    ]

    with patch("app.services.vision_gateway_service.asyncio.sleep", new_callable=AsyncMock):
        with patch("app.services.vision_gateway_service.httpx.AsyncClient", _PatchedClient):
            results = await svc.analyze_batch(files_data)

    assert isinstance(results, list)
    assert len(results) == 2
    for item in results:
        assert isinstance(item, dict)
        assert "category" in item
        assert "ocr_text" in item


# ---------------------------------------------------------------------------
# 10. normalize_vision_response() — rich input, verify all contract fields
# ---------------------------------------------------------------------------

def test_normalize_vision_response_full_contract(svc: VisionGatewayService) -> None:
    """normalize_vision_response maps rich raw input to full Phase-2 contract."""
    raw: Dict[str, Any] = {
        "title": "Swiggy Order",
        "summary": "Food delivery payment",
        "category": "finance",
        "ocr_text": "Paid ₹450 to Swiggy via Google Pay",
        "merchant": "Swiggy",
        "amount": 450,
        "confidence": 95,          # >1 → should be scaled to 0.95
        "tags": ["food", "delivery"],
        "entities": {"orderId": "ORD-999"},
        "bullet_points": ["Total: ₹450", "Delivered in 28 min"],
    }
    result = svc.normalize_vision_response(raw)

    # Required keys
    required_keys = [
        "title", "summary", "confidence", "screen_type", "category",
        "folder_hierarchy", "merchant", "amount", "currency",
        "payment_method", "date", "entities", "tags", "ocr_text", "bullet_points",
    ]
    for key in required_keys:
        assert key in result, f"Missing key: {key}"

    assert result["category"] == "finance"
    assert result["merchant"] == "Swiggy"
    assert result["amount"] == 450.0
    assert result["confidence"] == pytest.approx(0.95)
    assert result["payment_method"] == "UPI"          # "Google Pay" detected
    assert "finance" in result["tags"]
    assert isinstance(result["folder_hierarchy"], list)
    assert len(result["folder_hierarchy"]) >= 1
    assert result["entities"]["orderId"] == "ORD-999"
    assert "Total: ₹450" in result["bullet_points"]


def test_normalize_vision_response_empty_input(svc: VisionGatewayService) -> None:
    """normalize_vision_response handles empty dict without raising."""
    result = svc.normalize_vision_response({})

    assert isinstance(result, dict)
    assert result["category"] == "other"
    assert result["confidence"] == pytest.approx(0.95)
    assert isinstance(result["tags"], list)
    assert isinstance(result["entities"], dict)
    assert isinstance(result["folder_hierarchy"], list)


def test_normalize_vision_response_nested_extracted_data(svc: VisionGatewayService) -> None:
    """normalize_vision_response unwraps nested 'extracted_data' wrapper."""
    raw = {
        "extracted_data": {
            "title": "Train Ticket",
            "category": "travel",
            "ocr_text": "PNR: 4521098471 IRCTC",
        }
    }
    result = svc.normalize_vision_response(raw)

    assert result["category"] == "travel"
    # PNR should be extracted from ocr_text
    assert result["entities"].get("pnr") == "4521098471"


# ---------------------------------------------------------------------------
# 11. extract_amount('₹1,234.50') → 1234.5
# ---------------------------------------------------------------------------

def test_extract_amount_with_rupee_symbol() -> None:
    """Indian Rupee symbol with comma-separated amount is parsed correctly."""
    result = VisionGatewayService.extract_amount("₹1,234.50")
    assert result == pytest.approx(1234.5)


# ---------------------------------------------------------------------------
# 12. extract_amount('no amount here') → None
# ---------------------------------------------------------------------------

def test_extract_amount_no_match() -> None:
    """Text with no numerical amount returns None."""
    result = VisionGatewayService.extract_amount("no amount here")
    assert result is None


# ---------------------------------------------------------------------------
# 13. extract_date('2026-09-22') → '2026-09-22'
# ---------------------------------------------------------------------------

def test_extract_date_iso_format() -> None:
    """ISO date string is matched and returned verbatim."""
    result = VisionGatewayService.extract_date("2026-09-22")
    assert result == "2026-09-22"


def test_extract_date_embedded_in_text() -> None:
    """ISO date embedded in surrounding text is extracted correctly."""
    result = VisionGatewayService.extract_date("Transaction date: 2026-09-22 approved")
    assert result == "2026-09-22"


def test_extract_date_no_match() -> None:
    """Text with no recognizable date returns None."""
    result = VisionGatewayService.extract_date("No date info here")
    assert result is None


# ---------------------------------------------------------------------------
# 14. extract_upi_id('merchant@oksbi is the UPI id') → 'merchant@oksbi'
# ---------------------------------------------------------------------------

def test_extract_upi_id_standard_vpa() -> None:
    """Standard UPI VPA is matched from surrounding text."""
    result = VisionGatewayService.extract_upi_id("merchant@oksbi is the UPI id")
    assert result == "merchant@oksbi"


def test_extract_upi_id_no_match() -> None:
    """Text with no UPI VPA returns None."""
    result = VisionGatewayService.extract_upi_id("cash payment only")
    assert result is None


# ---------------------------------------------------------------------------
# 15. clean_merchant('Paid to Swiggy Pvt Ltd') → 'Swiggy'
# ---------------------------------------------------------------------------

def test_clean_merchant_strips_prefix_and_suffix() -> None:
    """'Paid to' prefix and 'Pvt Ltd' suffix are stripped; result is title-cased."""
    result = VisionGatewayService.clean_merchant("Paid to Swiggy Pvt Ltd")
    assert result == "Swiggy"


def test_clean_merchant_none_input() -> None:
    """None input returns None without error."""
    result = VisionGatewayService.clean_merchant(None)
    assert result is None


def test_clean_merchant_empty_string() -> None:
    """Empty string input returns None."""
    result = VisionGatewayService.clean_merchant("")
    assert result is None


def test_clean_merchant_strips_dot_com() -> None:
    """'.com' suffix is stripped from merchant name."""
    result = VisionGatewayService.clean_merchant("amazon.com")
    assert result == "Amazon"
