import uuid
from fastapi.testclient import TestClient


def test_screenshot_upload_metadata_and_deduplication(client: TestClient, auth_headers: dict):
    payload = {
        "screenshotId": "local_asset_101",
        "fileName": "starbucks_receipt.jpg",
        "sha256Hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "timestamp": "2026-09-06T10:00:00Z",
        "extractedText": "Starbucks Coffee Tax Invoice Grand Total $5.75 Date: 2026-09-06 Cashier: John",
        "normalizedText": "starbucks coffee tax invoice grand total $5.75",
        "width": 1080,
        "height": 2400,
        "mimeType": "image/jpeg",
        "deviceFolder": "Screenshots",
        "detectedApp": "com.starbucks.mobile",
    }

    # 1. First upload -> New screenshot
    resp1 = client.post("/api/screenshots/upload-metadata", headers=auth_headers, json=payload)
    assert resp1.status_code == 201
    body1 = resp1.json()
    assert body1["success"] is True
    data1 = body1["data"]
    sc_id = data1["id"]
    assert data1["isDuplicate"] is False
    assert data1["categoryName"] == "Receipts & Invoices"
    assert data1["confidence"] > 0.5
    assert len(data1["tags"]) > 0

    # 2. Second upload identical SHA256 -> Deduplication triggered
    resp2 = client.post("/api/screenshots/upload-metadata", headers=auth_headers, json=payload)
    assert resp2.status_code == 201
    body2 = resp2.json()
    assert body2["success"] is True
    data2 = body2["data"]
    assert data2["isDuplicate"] is True
    assert data2["id"] == sc_id  # Same record returned without creating duplicate


def test_screenshot_sync_batch(client: TestClient, auth_headers: dict):
    batch_payload = {
        "screenshots": [
            {
                "fileName": "screen1.png",
                "sha256Hash": "hash_11111111111111111111111111111111",
                "extractedText": "GitHub repo commit push branch main pull request",
                "detectedApp": "GitHub",
            },
            {
                "fileName": "screen2.png",
                "sha256Hash": "hash_22222222222222222222222222222222",
                "extractedText": "WhatsApp message Hey are you online? typing...",
                "detectedApp": "WhatsApp",
            },
            {
                "fileName": "screen1_dup.png",
                "sha256Hash": "hash_11111111111111111111111111111111",
                "extractedText": "Duplicate hash test",
            },
        ]
    }

    resp = client.post("/api/screenshots/sync", headers=auth_headers, json=batch_payload)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["processedCount"] == 3
    assert data["insertedCount"] == 2
    assert data["duplicateCount"] == 1


def test_screenshot_lifecycle_and_reclassification(client: TestClient, auth_headers: dict):
    # 1. Ingest initial screenshot
    upload_resp = client.post(
        "/api/screenshots/upload-metadata",
        headers=auth_headers,
        json={
            "fileName": "work_memo.png",
            "sha256Hash": "work_memo_hash_99999999999999999999",
            "extractedText": "Internal team sync for Sprint 3 deliverables and milestone deadline.",
            "detectedApp": "Slack",
        },
    )
    sc_id = upload_resp.json()["data"]["id"]

    # 2. Get screenshot details
    detail_resp = client.get(f"/api/screenshots/{sc_id}", headers=auth_headers)
    assert detail_resp.status_code == 200
    assert detail_resp.json()["data"]["categoryName"] == "Projects / Work"

    # 3. Toggle favorite
    fav_resp = client.patch(f"/api/screenshots/{sc_id}/favorite", headers=auth_headers)
    assert fav_resp.status_code == 200
    assert fav_resp.json()["data"]["isFavorite"] is True

    # 4. Toggle review
    rev_resp = client.patch(f"/api/screenshots/{sc_id}/review", headers=auth_headers)
    assert rev_resp.status_code == 200
    assert rev_resp.json()["data"]["isReviewed"] is True

    # 5. Reclassify with user hint
    reclass_resp = client.post(
        "/api/classification/reclassify",
        headers=auth_headers,
        json={
            "screenshotId": sc_id,
            "userHint": "Actually this is a project invoice for client Acme Corp with amount $500",
            "forceCategory": "Receipts & Invoices",
        },
    )
    assert reclass_resp.status_code == 200
    reclass_data = reclass_resp.json()["data"]
    assert reclass_data["category"] == "Receipts & Invoices"

    # 6. Check classification history audit trail
    hist_resp = client.get(f"/api/classification/history/{sc_id}", headers=auth_headers)
    assert hist_resp.status_code == 200
    history = hist_resp.json()["data"]
    assert len(history) >= 2  # Initial upload + reclassify

    # 7. List screenshots with pagination & search
    list_resp = client.get("/api/screenshots?page=1&pageSize=10", headers=auth_headers)
    assert list_resp.status_code == 200
    paged = list_resp.json()["data"]
    assert paged["totalCount"] >= 1

    # 8. Delete screenshot
    del_resp = client.delete(f"/api/screenshots/{sc_id}", headers=auth_headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["data"]["deleted"] is True
