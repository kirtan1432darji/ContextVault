import uuid
from fastapi.testclient import TestClient


def test_get_categories_tree_and_flat(client: TestClient, auth_headers: dict):
    # Tree mode
    resp = client.get("/api/categories?tree=true", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) >= 11  # 11 Canonical categories
    root_names = [c["name"] for c in data]
    assert "Receipts & Invoices" in root_names
    assert "Finance & Banking" in root_names
    assert "Projects / Work" in root_names
    assert "Unsorted" in root_names

    # Flat mode
    resp_flat = client.get("/api/categories?tree=false", headers=auth_headers)
    assert resp_flat.status_code == 200
    flat_data = resp_flat.json()["data"]
    assert len(flat_data) >= 11


def test_create_and_manage_custom_category(client: TestClient, auth_headers: dict):
    # 1. Create top-level custom category
    resp = client.post(
        "/api/categories",
        headers=auth_headers,
        json={
            "name": "Custom Projects",
            "icon": "folder-star",
            "color": "#4F46E5",
            "description": "My custom projects folder",
            "displayOrder": 100,
        },
    )
    assert resp.status_code == 201
    created = resp.json()["data"]
    cat_id = created["id"]
    assert created["name"] == "Custom Projects"
    assert created["isSystem"] is False

    # 2. Create nested subcategory under custom category
    resp_sub = client.post(
        "/api/categories",
        headers=auth_headers,
        json={
            "name": "Project Alpha",
            "parentId": cat_id,
            "icon": "file-document",
            "color": "#10B981",
            "description": "Sub project",
            "displayOrder": 1,
        },
    )
    assert resp_sub.status_code == 201
    sub_data = resp_sub.json()["data"]
    assert sub_data["parentId"] == cat_id
    assert sub_data["path"] == "Custom Projects/Project Alpha"

    # 3. Update custom category
    resp_update = client.put(
        f"/api/categories/{cat_id}",
        headers=auth_headers,
        json={"name": "Renamed Projects", "color": "#000000"},
    )
    assert resp_update.status_code == 200
    assert resp_update.json()["data"]["name"] == "Renamed Projects"

    # 4. Soft-delete custom category
    resp_del = client.delete(f"/api/categories/{cat_id}", headers=auth_headers)
    assert resp_del.status_code == 200
    assert resp_del.json()["data"]["deleted"] is True


def test_cannot_delete_system_category(client: TestClient, auth_headers: dict):
    # Fetch categories
    resp = client.get("/api/categories?tree=false", headers=auth_headers)
    system_cat = next(c for c in resp.json()["data"] if c["isSystem"] is True)

    # Attempt to delete system category
    resp_del = client.delete(f"/api/categories/{system_cat['id']}", headers=auth_headers)
    assert resp_del.status_code == 403
