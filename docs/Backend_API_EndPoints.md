# ContextVault — Backend API Endpoints Catalog (v1.0.0)

Base URL (Development): `http://10.193.167.152:8000`  
Base URL (Production): `https://api.contextvault.app`  
API Prefix: `/api`

---

## 1. Authentication Endpoints

### `POST /api/auth/register`
- **Body**:
  ```json
  {
    "username": "kirtan",
    "email": "kirtan@contextvault.app",
    "password": "SecurePassword123!"
  }
  ```
- **Response**: `201 Created` with User info and JWT tokens.

### `POST /api/auth/login`
- **Body**:
  ```json
  {
    "emailOrUsername": "kirtan@contextvault.app",
    "password": "SecurePassword123!"
  }
  ```
- **Response**: `200 OK` with `accessToken`, `refreshToken`, and user object.

### `POST /api/auth/refresh`
- **Body**:
  ```json
  {
    "refreshToken": "eyJhbGciOi..."
  }
  ```
- **Response**: `200 OK` with refreshed `accessToken` and `refreshToken`.

### `GET /api/auth/profile`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200 OK` with user details.

### `POST /api/auth/logout`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200 OK` with token revocation confirmation.

---

## 2. Screenshot Endpoints

### `POST /api/screenshots/scan`
- **Body**:
  ```json
  {
    "deviceAssetId": "12345",
    "fileName": "Screenshot_2026.png",
    "width": 1080,
    "height": 2400,
    "fileSize": 340200,
    "ocrText": "Payment successful Rs. 450 to Swiggy",
    "detectedApp": "Google Pay"
  }
  ```

### `POST /api/screenshots/batch`
- **Body**: Array of scan payloads for bulk indexing.

### `GET /api/screenshots`
- **Query Params**: `categoryId`, `searchTerm`, `isFavorite`, `pageNumber`, `pageSize`.

---

## 3. Classification Endpoints

### `POST /api/classification/classify`
- **Body**: `{ "ocrText": "...", "appName": "Swiggy" }`
- **Response**: `{ "categoryId": "cat_finance", "confidence": 0.94, "subcategory": "Food & Dining" }`

### `POST /api/classification/reclassify`
- **Body**: `{ "screenshotId": "sc_1", "targetCategoryId": "cat_personal", "userHint": "Personal recipe note" }`

---

## 4. Context & Chat Endpoints

### `GET /api/context/{categoryId}`
- **Response**: Summary, timeline array, action tasks, extracted entities.

### `POST /api/context/generate/{categoryId}`
- **Response**: Refreshed executive summary and synthesized knowledge tokens.

### `POST /api/chat/message`
- **Body**:
  ```json
  {
    "folderId": "cat_finance",
    "message": "What did I spend on groceries this week?"
  }
  ```
- **Response**: AI textual answer with citation cards pointing to screenshot IDs.

### `GET /api/chat/history/{folderId}`
- **Response**: Array of multi-turn chat messages.
