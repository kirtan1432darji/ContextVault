# ContextVault — Comprehensive API Reference (v1.0.0)

ContextVault client applications communicate with the Python FastAPI backend using standardized REST endpoints over HTTP/JSON with JWT Bearer token authentication.

---

## 1. Uniform Response Envelope

All API endpoints strictly wrap data in a uniform envelope structure:

```json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": { ... },
  "errors": null
}
```

### Error Response Envelope
```json
{
  "success": false,
  "message": "Validation failed / Unauthorized",
  "data": null,
  "errors": [
    {
      "field": "email",
      "message": "Invalid email address format"
    }
  ]
}
```

---

## 2. Authentication APIs (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register a new user account | No |
| `POST` | `/api/auth/login` | Authenticate with email/username & password | No |
| `POST` | `/api/auth/refresh` | Refresh access token using refresh token | No |
| `GET` | `/api/auth/profile` | Retrieve authenticated user profile | Yes (Bearer) |
| `POST` | `/api/auth/logout` | Revoke session and invalidate tokens | Yes (Bearer) |
| `POST` | `/api/auth/forgot-password` | Request password reset verification link | No |

---

## 3. Screenshot APIs (`/api/screenshots`)

*Note: Zero binary photo data is uploaded. All endpoints transmit only extracted OCR tokens, dimensions, and taxonomy metadata.*

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/screenshots/scan` | Ingest single screenshot OCR metadata | Yes |
| `POST` | `/api/screenshots/batch` | Ingest batch screenshot records idempotently | Yes |
| `GET` | `/api/screenshots` | Paged query with filters (`categoryId`, `tag`, `searchTerm`) | Yes |
| `GET` | `/api/screenshots/{id}` | Fetch screenshot metadata & OCR text | Yes |
| `PUT` | `/api/screenshots/{id}` | Update category, subcategory, or tags | Yes |
| `PATCH` | `/api/screenshots/{id}/favorite` | Toggle bookmark status | Yes |
| `PATCH` | `/api/screenshots/{id}/review` | Mark screenshot reviewed status | Yes |
| `DELETE` | `/api/screenshots/{id}` | Soft-delete screenshot record | Yes |

---

## 4. AI Classification APIs (`/api/classification`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/classification/classify` | Classify OCR text and assign multi-tier category | Yes |
| `POST` | `/api/classification/reclassify` | User override reclassification with custom hint | Yes |
| `GET` | `/api/classification/history/{id}` | Audit trail of classification results | Yes |

---

## 5. Smart Folders & Taxonomy APIs (`/api/categories`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/categories` | Retrieve hierarchical canonical taxonomy | Yes |
| `POST` | `/api/categories` | Create custom user folder | Yes |
| `PUT` | `/api/categories/{id}` | Update folder metadata | Yes |
| `DELETE` | `/api/categories/{id}` | Soft-delete folder | Yes |

---

## 6. Folder Context & AI Assistant APIs (`/api/context`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/context/{categoryId}` | Fetch existing AI folder executive summary & entities | Yes |
| `POST` | `/api/context/generate/{categoryId}` | Generate or refresh executive summary, timeline & tasks | Yes |
| `GET` | `/api/context/entities/{categoryId}` | Retrieve structured key-value entities (amounts, dates) | Yes |
| `GET` | `/api/context/timeline/{categoryId}` | Retrieve chronological event timeline | Yes |

---

## 7. Context AI Chat APIs (`/api/chat`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/chat/message` | Send question to Context AI for a specific folder/shot | Yes |
| `GET` | `/api/chat/history/{folderId}` | Retrieve multi-turn chat history | Yes |
| `GET` | `/api/chat/suggestions/{folderId}`| Retrieve context-aware recommended prompts | Yes |

---

## 8. Health & System APIs

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status, database ping, uptime | No |
| `GET` | `/api/version` | API server version, build stamp, commit hash | No |
| `GET` | `/` | Root greeting and system state | No |
