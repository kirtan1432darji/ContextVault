import uuid
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.services.prompt_builder_service import PromptBuilderService
from app.services.citation_service import CitationService
from app.repositories.chat_repository import ChatRepository
from app.models.screenshot import Screenshot
from app.models.chat import ChatMessage, ChatSession


def _setup_test_data(client: TestClient, auth_headers: dict):
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
            "fileName": "amazon_payment_tx.png",
            "sha256Hash": "f1f2f3f4e5f60102030405060708090a1b2c3d4e5f60102030405060708090a1",
            "extractedText": (
                "Amazon Payment Successful. Paid $149.99 for Order #987654. "
                "HDFC Bank Account: XXXX5678. Transaction Reference: TXN-883311. "
                "Date: Jan 15, 2026."
            ),
            "detectedApp": "Amazon",
            "width": 1080,
            "height": 2400,
            "mimeType": "image/png",
        },
    )
    assert ss1_resp.status_code == 201
    ss1_id = ss1_resp.json()["data"]["id"]

    client.put(
        f"/api/screenshots/{ss1_id}",
        headers=auth_headers,
        json={"categoryId": category_id, "subCategory": "E-Commerce Payments"},
    )

    # 3. Upload second screenshot with tasks and deadlines
    ss2_resp = client.post(
        "/api/screenshots/upload-metadata",
        headers=auth_headers,
        json={
            "fileName": "tax_audit_notes.png",
            "sha256Hash": "f2f3f4e5f6a10102030405060708090a1b2c3d4e5f60102030405060708090a2",
            "extractedText": (
                "Quarterly Tax Filing Notes. Sent by Dr. Robert Smith. "
                "Todo: submit tax documents before Jan 31, 2026. "
                "Action item: review monthly budget by Friday. "
                "Account Balance: $4,520.00."
            ),
            "detectedApp": "Notes",
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
        json={"categoryId": category_id, "subCategory": "Taxes"},
    )

    # 4. Generate folder context
    gen_resp = client.post(
        f"/api/context/generate/{category_id}",
        headers=auth_headers,
    )
    assert gen_resp.status_code == 200

    return category_id, ss1_id, ss2_id


def test_send_chat_message_finance_intent(client: TestClient, auth_headers: dict):
    category_id, ss1_id, ss2_id = _setup_test_data(client, auth_headers)

    response = client.post(
        "/api/chat/message",
        headers=auth_headers,
        json={
            "folderId": category_id,
            "content": "What was my total spending or payment amount?",
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]

    assert data["role"] == "assistant"
    assert data["sessionId"] is not None
    assert "$149.99" in data["content"] or "$4,520.00" in data["content"]
    assert len(data["citations"]) > 0
    assert any(c["fileName"] in ["amazon_payment_tx.png", "tax_audit_notes.png"] for c in data["citations"])


def test_send_chat_message_task_intent(client: TestClient, auth_headers: dict):
    category_id, _, _ = _setup_test_data(client, auth_headers)

    response = client.post(
        "/api/chat/message",
        headers=auth_headers,
        json={
            "folderId": category_id,
            "content": "What tasks or deadlines do I need to follow up on?",
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]

    assert data["role"] == "assistant"
    assert "tax documents" in data["content"].lower() or "action items" in data["content"].lower()
    assert len(data["citations"]) > 0


def test_send_chat_message_specific_screenshot(client: TestClient, auth_headers: dict):
    _, ss1_id, _ = _setup_test_data(client, auth_headers)

    response = client.post(
        "/api/chat/message",
        headers=auth_headers,
        json={
            "screenshotId": ss1_id,
            "content": "Tell me about this specific screenshot.",
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]

    assert data["role"] == "assistant"
    assert len(data["citations"]) == 1
    assert data["citations"][0]["screenshotId"] == ss1_id
    assert "amazon_payment_tx.png" in data["citations"][0]["fileName"]


def test_multi_turn_chat_and_history(client: TestClient, auth_headers: dict):
    category_id, _, _ = _setup_test_data(client, auth_headers)
    session_id = str(uuid.uuid4())

    # Turn 1
    resp1 = client.post(
        "/api/chat/message",
        headers=auth_headers,
        json={
            "sessionId": session_id,
            "folderId": category_id,
            "content": "Can you summarize this folder?",
        },
    )
    assert resp1.status_code == 200
    data1 = resp1.json()["data"]
    assert data1["sessionId"] == session_id

    # Turn 2
    resp2 = client.post(
        "/api/chat/message",
        headers=auth_headers,
        json={
            "sessionId": session_id,
            "folderId": category_id,
            "content": "Who are the people or doctors mentioned?",
        },
    )
    assert resp2.status_code == 200
    data2 = resp2.json()["data"]
    assert data2["sessionId"] == session_id

    # Fetch History
    hist_resp = client.get(
        f"/api/chat/history/{category_id}?sessionId={session_id}",
        headers=auth_headers,
    )
    assert hist_resp.status_code == 200
    hist_data = hist_resp.json()["data"]
    assert hist_data["totalCount"] == 4  # 2 user questions + 2 assistant answers
    assert len(hist_data["messages"]) == 4


def test_chat_suggestions(client: TestClient, auth_headers: dict):
    category_id, _, _ = _setup_test_data(client, auth_headers)

    resp = client.get(
        f"/api/chat/suggestions/{category_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["folderId"] == category_id
    assert len(data["suggestions"]) >= 2
    assert any("statement" in s.lower() or "balance" in s.lower() or "spending" in s.lower() or "task" in s.lower() for s in data["suggestions"])


def test_chat_sessions_query_endpoint(client: TestClient, auth_headers: dict):
    category_id, _, _ = _setup_test_data(client, auth_headers)
    session_id = str(uuid.uuid4())

    # Create message
    client.post(
        "/api/chat/message",
        headers=auth_headers,
        json={
            "sessionId": session_id,
            "folderId": category_id,
            "content": "Testing sessions query endpoint.",
        },
    )

    # 1. Query /api/chat/sessions without folderId
    resp_all = client.get("/api/chat/sessions", headers=auth_headers)
    assert resp_all.status_code == 200
    data_all = resp_all.json()["data"]
    assert len(data_all) >= 1
    assert any(s["sessionId"] == session_id for s in data_all)

    # 2. Query /api/chat/sessions with folderId query param
    resp_filtered = client.get(f"/api/chat/sessions?folderId={category_id}", headers=auth_headers)
    assert resp_filtered.status_code == 200
    data_filtered = resp_filtered.json()["data"]
    assert len(data_filtered) >= 1
    assert any(s["sessionId"] == session_id for s in data_filtered)


def test_delete_chat_history_for_folder(client: TestClient, auth_headers: dict):
    category_id, _, _ = _setup_test_data(client, auth_headers)

    # Post message
    client.post(
        "/api/chat/message",
        headers=auth_headers,
        json={
            "folderId": category_id,
            "content": "Message to be cleared with entire folder history.",
        },
    )

    # Verify history exists
    hist_before = client.get(f"/api/chat/history/{category_id}", headers=auth_headers)
    assert hist_before.status_code == 200
    assert hist_before.json()["data"]["totalCount"] >= 2

    # Delete history for folder
    del_resp = client.delete(f"/api/chat/history/{category_id}", headers=auth_headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["data"] >= 2

    # Verify history is now empty
    hist_after = client.get(f"/api/chat/history/{category_id}", headers=auth_headers)
    assert hist_after.status_code == 200
    assert hist_after.json()["data"]["totalCount"] == 0


def test_chat_sessions_and_delete(client: TestClient, auth_headers: dict):
    category_id, _, _ = _setup_test_data(client, auth_headers)
    session_id = str(uuid.uuid4())

    # Post message in session
    client.post(
        "/api/chat/message",
        headers=auth_headers,
        json={
            "sessionId": session_id,
            "folderId": category_id,
            "content": "Testing session management.",
        },
    )

    # Get sessions via path param
    sess_resp = client.get(
        f"/api/chat/sessions/{category_id}",
        headers=auth_headers,
    )
    assert sess_resp.status_code == 200
    sessions = sess_resp.json()["data"]
    assert len(sessions) >= 1
    assert any(s["sessionId"] == session_id for s in sessions)

    # Delete session
    del_resp = client.delete(
        f"/api/chat/session/{session_id}",
        headers=auth_headers,
    )
    assert del_resp.status_code == 200
    assert del_resp.json()["data"] is True

    # Check history after delete
    hist_after = client.get(
        f"/api/chat/history/{category_id}?sessionId={session_id}",
        headers=auth_headers,
    )
    assert hist_after.status_code == 200
    assert hist_after.json()["data"]["totalCount"] == 0


def test_chat_message_global_no_folder(client: TestClient, auth_headers: dict):
    # Chat message without folder context
    resp = client.post(
        "/api/chat/message",
        headers=auth_headers,
        json={
            "content": "Hello ContextVault, what can you do?",
        },
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["role"] == "assistant"
    assert "ContextVault" in data["content"]


def test_prompt_builder_service_unit():
    service = PromptBuilderService()
    assert service.detect_intent("What is my total spending?") == PromptBuilderService.INTENT_FINANCE
    assert service.detect_intent("What are my pending tasks?") == PromptBuilderService.INTENT_TASKS
    assert service.detect_intent("Who is Dr. Smith?") == PromptBuilderService.INTENT_CONTACTS
    assert service.detect_intent("Summarize this folder") == PromptBuilderService.INTENT_SUMMARY
    assert service.detect_intent("Show me the timeline") == PromptBuilderService.INTENT_TIMELINE
    assert service.detect_intent("Random text without keywords") == PromptBuilderService.INTENT_GENERAL


def test_citation_service_unit():
    service = CitationService()
    fake_screenshot = Screenshot(
        Id=uuid.uuid4(),
        UserId=uuid.uuid4(),
        FileName="invoice_sample.png",
        OCRText="Invoice for $99.99 paid with credit card at Target",
        DetectedApp="Target",
        DeviceFolder="/DCIM/Screenshots",
    )
    citation = service.build_citation(fake_screenshot)
    assert citation.fileName == "invoice_sample.png"
    assert "Target" in citation.snippet or "$99.99" in citation.snippet

    citations = service.find_citations_for_query("credit card target", [fake_screenshot])
    assert len(citations) == 1
    assert citations[0].screenshotId == fake_screenshot.Id

    serialized = service.serialize_citations(citations)
    deserialized = service.deserialize_citations(serialized)
    assert len(deserialized) == 1
    assert deserialized[0].screenshotId == fake_screenshot.Id


def test_chat_repository_crud(db_session: Session):
    repo = ChatRepository(db_session)
    user_id = uuid.uuid4()
    folder_id = uuid.uuid4()

    # 1. create_session
    session = repo.create_session(user_id=user_id, folder_id=folder_id, title="Test Session")
    assert session.Id is not None
    assert session.UserId == user_id
    assert session.FolderId == folder_id

    # 2. get_session
    fetched_session = repo.get_session(session.Id, user_id)
    assert fetched_session is not None
    assert fetched_session.Id == session.Id

    # 3. save_message
    msg = repo.save_message(
        user_id=user_id,
        session_id=session.Id,
        role="user",
        message="Hello World",
        folder_id=folder_id,
    )
    assert msg.Id is not None
    assert msg.Message == "Hello World"

    # 4. get_chat_history
    history = repo.get_chat_history(user_id=user_id, folder_id=folder_id)
    assert len(history) == 1
    assert history[0].Id == msg.Id

    # 5. get_recent_sessions
    sessions = repo.get_recent_sessions(user_id=user_id, folder_id=folder_id)
    assert len(sessions) == 1
    assert sessions[0]["sessionId"] == session.Id

    # 6. delete_session
    deleted = repo.delete_session(user_id=user_id, session_id=session.Id)
    assert deleted is True

    # Check history after delete
    history_after = repo.get_chat_history(user_id=user_id, session_id=session.Id)
    assert len(history_after) == 0
