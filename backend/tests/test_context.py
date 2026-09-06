import uuid
from fastapi.testclient import TestClient


def _create_category_and_screenshots(client: TestClient, auth_headers: dict):
    # 1. Create a category
    cat_resp = client.post(
        "/api/categories",
        headers=auth_headers,
        json={
            "name": "Finance & Banking",
            "icon": "bank",
            "color": "#3B82F6",
            "description": "Financial statements and transactions",
        },
    )
    assert cat_resp.status_code == 201
    category_id = cat_resp.json()["data"]["id"]

    # 2. Upload first screenshot with payment details
    ss1_resp = client.post(
        "/api/screenshots/upload-metadata",
        headers=auth_headers,
        json={
            "fileName": "gpay_hdfc_tx.png",
            "sha256Hash": "a1b2c3d4e5f60102030405060708090a1b2c3d4e5f60102030405060708090a1",
            "extractedText": (
                "Google Pay Transaction Successful. Paid $149.99 to Amazon.com Inc. "
                "UPI ID: payments@okhdfcbank. Ref No: INV-987654. Date: Jan 15, 2026. "
                "A/C: XXXX5678. Need to review monthly budget by Friday."
            ),
            "detectedApp": "Google Pay",
            "width": 1080,
            "height": 2400,
            "mimeType": "image/png",
        },
    )
    assert ss1_resp.status_code == 201
    ss1_id = ss1_resp.json()["data"]["id"]

    # Move ss1 explicitly to the created category
    client.put(
        f"/api/screenshots/{ss1_id}",
        headers=auth_headers,
        json={"categoryId": category_id, "subCategory": "UPI Transfers"},
    )

    # 3. Upload second screenshot with invoice & task
    ss2_resp = client.post(
        "/api/screenshots/upload-metadata",
        headers=auth_headers,
        json={
            "fileName": "hdfc_bank_statement.png",
            "sha256Hash": "b2c3d4e5f6a10102030405060708090a1b2c3d4e5f60102030405060708090a2",
            "extractedText": (
                "HDFC Bank Statement. Account Balance: $4,520.00. "
                "Bill to John Doe. Sent by Dr. Robert Smith. "
                "Todo: submit tax documents before Jan 31, 2026. "
                "Meeting with accountant on Monday."
            ),
            "detectedApp": "HDFC Bank",
            "width": 1080,
            "height": 2400,
            "mimeType": "image/png",
        },
    )
    assert ss2_resp.status_code == 201
    ss2_id = ss2_resp.json()["data"]["id"]

    client.put(
        f"/api/screenshots/{ss2_id}",
        headers=auth_headers,
        json={"categoryId": category_id, "subCategory": "Bank Statements"},
    )

    return category_id, [ss1_id, ss2_id]


def test_generate_folder_context(client: TestClient, auth_headers: dict):
    category_id, screenshot_ids = _create_category_and_screenshots(client, auth_headers)

    # Generate context
    resp = client.post(
        f"/api/context/generate/{category_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    data = body["data"]

    assert data["folderId"] == category_id
    assert data["folderName"] == "Finance & Banking"
    assert data["version"] == 1
    assert data["screenshotsAnalyzed"] == 2
    assert data["confidence"] > 0.4

    # Verify summary
    assert "Finance & Banking" in data["summary"]
    assert "2 screenshots" in data["summary"]

    # Verify entities
    entities = data["entities"]
    assert len(entities["amounts"]) >= 1
    assert any("Amazon" in org for org in entities["organizations"])
    assert any("okhdfcbank" in upi for upi in entities["upiIds"])
    assert len(entities["dates"]) >= 1

    # Verify tasks
    assert len(data["tasks"]) >= 1
    task_titles = [t["title"].lower() for t in data["tasks"]]
    assert any("tax" in t or "budget" in t or "accountant" in t for t in task_titles)

    # Verify timeline
    assert len(data["timeline"]) == 2

    # Fetch via GET
    get_resp = client.get(
        f"/api/context/folder/{category_id}",
        headers=auth_headers,
    )
    assert get_resp.status_code == 200
    assert get_resp.json()["data"]["id"] == data["id"]


def test_timeline_ordering(client: TestClient, auth_headers: dict):
    category_id, screenshot_ids = _create_category_and_screenshots(client, auth_headers)

    timeline_resp = client.get(
        f"/api/context/timeline/{category_id}",
        headers=auth_headers,
    )
    assert timeline_resp.status_code == 200
    events = timeline_resp.json()["data"]
    assert len(events) == 2

    # Verify chronological order: oldest to newest
    ts0 = events[0]["timestamp"]
    ts1 = events[1]["timestamp"]
    assert ts0 <= ts1


def test_entity_aggregation(client: TestClient, auth_headers: dict):
    category_id, _ = _create_category_and_screenshots(client, auth_headers)

    # First generate context to record entity occurrences
    client.post(f"/api/context/generate/{category_id}", headers=auth_headers)

    # Get aggregated entities
    resp = client.get(
        f"/api/context/entities/{category_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    data = body["data"]

    assert data["folderId"] == category_id
    assert data["totalCount"] > 0
    grouped = data["entities"]
    assert "amounts" in grouped or "organizations" in grouped or "upiIds" in grouped


def test_regenerate_folder_context(client: TestClient, auth_headers: dict):
    category_id, _ = _create_category_and_screenshots(client, auth_headers)

    # Initial generation
    gen_resp = client.post(f"/api/context/generate/{category_id}", headers=auth_headers)
    assert gen_resp.status_code == 200
    assert gen_resp.json()["data"]["version"] == 1

    # Force regeneration
    regen_resp = client.post(f"/api/context/regenerate/{category_id}", headers=auth_headers)
    assert regen_resp.status_code == 200
    assert regen_resp.json()["data"]["version"] == 2
    assert "Version 2" in regen_resp.json()["message"]


def test_recent_contexts(client: TestClient, auth_headers: dict):
    category_id, _ = _create_category_and_screenshots(client, auth_headers)
    client.post(f"/api/context/generate/{category_id}", headers=auth_headers)

    resp = client.get("/api/context/recent", headers=auth_headers)
    assert resp.status_code == 200
    recents = resp.json()["data"]
    assert len(recents) >= 1
    assert any(r["folderId"] == category_id for r in recents)


def test_search_folder_knowledge(client: TestClient, auth_headers: dict):
    category_id, _ = _create_category_and_screenshots(client, auth_headers)
    client.post(f"/api/context/generate/{category_id}", headers=auth_headers)

    # Search for "Amazon"
    search_resp = client.get("/api/context/search?q=Amazon", headers=auth_headers)
    assert search_resp.status_code == 200
    matches = search_resp.json()["data"]
    assert len(matches) >= 1
    assert matches[0]["folderId"] == category_id

    # Search for "tax"
    search_tax = client.get("/api/context/search?q=tax", headers=auth_headers)
    assert search_tax.status_code == 200
    assert len(search_tax.json()["data"]) >= 1


def test_empty_folder_context(client: TestClient, auth_headers: dict):
    cat_resp = client.post(
        "/api/categories",
        headers=auth_headers,
        json={"name": "Empty Travel Folder", "icon": "airplane", "color": "#14B8A6"},
    )
    cat_id = cat_resp.json()["data"]["id"]

    resp = client.post(f"/api/context/generate/{cat_id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["screenshotsAnalyzed"] == 0
    assert "currently contains no screenshots" in data["summary"]
    assert data["confidence"] == 0.0


def test_get_folder_context_not_found(client: TestClient, auth_headers: dict):
    random_id = uuid.uuid4()
    resp = client.get(f"/api/context/folder/{random_id}", headers=auth_headers)
    assert resp.status_code == 404
