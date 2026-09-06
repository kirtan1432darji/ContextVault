# ContextVault — Master Architectural Blueprint (Brain.md)
*Version: 1.0.0 | Status: Active Specification | Source of Truth*

---

## 1. Executive Summary & Product Vision

**ContextVault** is a privacy-first, intelligent organizational layer built over screenshots stored on a user's mobile device. 

### Core Product Guarantee: Non-Destructive Intelligence
- **Zero Binary Upload**: Full-size user photos and screenshot bitmaps **never** leave the local device storage.
- **Zero File Mutation**: The app **never moves, edits, duplicates, or deletes** the original images in the device camera roll / MediaStore.
- **Metadata Layer**: ContextVault performs on-device OCR (Optical Character Recognition) and transmits only anonymized text tokens and image dimension metadata to provide instant categorization, smart hierarchical folders, multi-turn AI context assistance, and full-text search.

---

## 2. System Architecture & Tech Stack

```
ContextVault System Architecture
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MOBILE CLIENT (React Native)                      │
│                                                                             │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────┐  │
│  │   Presentation Layer    │  │     State Management    │  │ Local Cache │  │
│  │   Material Design 3     │  │   Zustand Stores        │  │ SQLite DB   │  │
│  │   React Navigation v6   │  │   Async Storage / MMKV  │  │ In-Memory   │  │
│  └────────────┬────────────┘  └────────────┬────────────┘  └──────┬──────┘  │
│               │                            │                      │         │
│  ┌────────────▼────────────────────────────▼──────────────────────▼──────┐  │
│  │                     Services & Heuristics Engine                      │  │
│  │  - MediaStore / PhotoKit Scanner   - On-Device OCR Bridge (ML Kit)    │  │
│  │  - Rule Classifier (Multi-tier)    - Offline Sync Queue Dispatcher    │  │
│  │  - Background Detection Service    - Local Notification Engine        │  │
│  └─────────────────────────────────────────┬─────────────────────────────┘  │
└────────────────────────────────────────────┼────────────────────────────────┘
                                             │ HTTP/REST (JWT Bearer)
                                             │ JSON Metadata & Text Only
┌────────────────────────────────────────────▼────────────────────────────────┐
│                       BACKEND API (Python FastAPI)                          │
│                                                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌───────────────────┐  │
│  │  Auth & Token API    │  │  Screenshots Sync    │  │ AI Classification │  │
│  │  JWT + Refresh Flow  │  │  Batch Scan Pipeline │  │ & Taxonomy Engine │  │
│  └──────────┬───────────┘  └──────────┬───────────┘  └─────────┬─────────┘  │
│             │                         │                        │            │
│  ┌──────────▼───────────┐  ┌──────────▼───────────┐  ┌─────────▼─────────┐  │
│  │  Smart Folder API    │  │  Folder Context AI   │  │ Context AI Chat   │  │
│  │  Hierarchical Sync   │  │  Entity Extraction   │  │ Multi-Turn Chat   │  │
│  └──────────┬───────────┘  └──────────┬───────────┘  └─────────┬─────────┘  │
│             │                         │                        │            │
│             └─────────────────────────┼────────────────────────┘            │
│                                       │ Async SQLAlchemy / pyodbc           │
└───────────────────────────────────────┼─────────────────────────────────────┘
                                        │
┌───────────────────────────────────────▼─────────────────────────────────────┐
│                    DATABASE (Microsoft SQL Server 2022+)                    │
│                                                                             │
│  - Users & RefreshTokens               - Categories & Multi-Tier Hierarchy  │
│  - Screenshots (Metadata & OCR)        - Tags & ScreenshotTags (M2M)        │
│  - FolderContexts (Executive Summaries)- ChatHistories (Multi-turn AI)      │
│  - TaskItems & Extracted Entities      - DeviceInfos & NotificationHistories│
│  - Stored Procedures & Full-Text Search Catalog (FTS)                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Standard API Contracts

All endpoints return a uniform envelope:
```json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": { ... },
  "errors": null
}
```

### 3.1 Authentication
- `POST /api/auth/register`: Register user `{ username, email, password }`
- `POST /api/auth/login`: Authenticate `{ emailOrUsername, password }` -> returns `{ accessToken, refreshToken, user }`
- `POST /api/auth/refresh`: Refresh expired token `{ accessToken, refreshToken }`
- `POST /api/auth/logout`: Revoke token `{ refreshToken }`

### 3.2 Screenshot Metadata & Ingestion
- `POST /api/screenshots/scan`: Scan/upsert single screenshot metadata
- `POST /api/screenshots/batch`: Batch upsert screenshots (idempotent duplicate prevention)
- `GET /api/screenshots`: Paged screenshot query with filters (`categoryId`, `subCategoryId`, `tag`, `isFavorite`, `isReviewed`, `needsReview`, `searchTerm`, `pageNumber`, `pageSize`)
- `GET /api/screenshots/{id}`: Single screenshot metadata
- `PUT /api/screenshots/{id}`: Update metadata (category, subcategory, tags)
- `PATCH /api/screenshots/{id}/favorite`: Toggle bookmark status
- `PATCH /api/screenshots/{id}/review`: Mark reviewed status
- `DELETE /api/screenshots/{id}`: Delete metadata record

### 3.3 AI Classification Engine
- `POST /api/classification/classify`: Classify screenshot OCR text and metadata into multi-tier folder hierarchy
- `POST /api/classification/reclassify`: Re-run classification with updated user hint
- `GET /api/classification/history/{screenshotId}`: Audit trail of classification results

### 3.4 Categories & Smart Folders
- `GET /api/categories`: Retrieve canonical taxonomy categories and subcategories
- `POST /api/categories`: Create custom user category
- `PUT /api/categories/{id}`: Update category
- `DELETE /api/categories/{id}`: Soft-delete category

### 3.5 Folder Context & AI Chat (Sprint 1.4)
- `GET /api/context/{categoryId}`: Fetch existing AI folder executive summary, extracted entities, timeline, action tasks
- `POST /api/context/generate/{categoryId}`: Force generate / refresh AI folder context
- `POST /api/chat/message`: Send question to Context AI for a specific folder or screenshot

### 3.6 Search & Offline Synchronization
- `GET /api/search?q={query}`: Multi-facet full-text search
- `POST /api/sync`: Dispatches queued offline mutation actions
- `GET /api/sync/changes?since={timestamp}`: Delta changes since timestamp

---

## 4. Local SQLite Database Schema

The mobile client embeds SQLite (`ai_screenshot_organizer.db`) for offline-first capability:

```sql
-- 1. Categories
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  icon_name TEXT NOT NULL,
  color_hex TEXT NOT NULL,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 1,
  order_index INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);

-- 2. Folders
CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- 3. Tags
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color_hex TEXT NOT NULL
);

-- 4. Screenshots
CREATE TABLE screenshots (
  id TEXT PRIMARY KEY,
  device_asset_id TEXT,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  width INTEGER NOT NULL DEFAULT 1080,
  height INTEGER NOT NULL DEFAULT 2400,
  file_size INTEGER NOT NULL DEFAULT 0,
  category_id TEXT NOT NULL,
  category_name TEXT NOT NULL,
  subcategory TEXT,
  confidence REAL NOT NULL DEFAULT 0.0,
  source_app TEXT,
  detected_app TEXT,
  keywords_json TEXT,
  is_auto_categorized INTEGER NOT NULL DEFAULT 0,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  is_reviewed INTEGER NOT NULL DEFAULT 0,
  is_synced INTEGER NOT NULL DEFAULT 0,
  ocr_status TEXT NOT NULL DEFAULT 'none',
  ocr_text TEXT,
  last_scanned_at TEXT,
  is_mock INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET DEFAULT
);

-- 5. Screenshot Tags (M2M)
CREATE TABLE screenshot_tags (
  screenshot_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (screenshot_id, tag_id),
  FOREIGN KEY (screenshot_id) REFERENCES screenshots (id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
);

-- 6. OCR Cache
CREATE TABLE ocr_cache (
  screenshot_id TEXT PRIMARY KEY,
  raw_text TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  confidence REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (screenshot_id) REFERENCES screenshots (id) ON DELETE CASCADE
);

-- 7. Sync Queue
CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  http_method TEXT NOT NULL DEFAULT 'POST',
  payload TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  last_error TEXT
);

-- 8. Classification History
CREATE TABLE classification_history (
  id TEXT PRIMARY KEY,
  screenshot_id TEXT NOT NULL,
  category TEXT NOT NULL,
  sub_category TEXT,
  tags_json TEXT,
  confidence REAL NOT NULL DEFAULT 0.0,
  model_name TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (screenshot_id) REFERENCES screenshots (id) ON DELETE CASCADE
);

-- 9. Chat History
CREATE TABLE chat_history (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  folder_id TEXT,
  screenshot_id TEXT,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  citations_json TEXT,
  created_at TEXT NOT NULL
);
```

---

## 5. Canonical Taxonomy & Multi-Tier Hierarchy

ContextVault utilizes a dynamic taxonomy structure:
1. **Receipts & Invoices** (`#10B981`): Bills, orders, invoices, payment confirmations.
2. **Finance & Banking** (`#3B82F6`): Bank statements, UPI, crypto, tax, portfolios.
3. **Projects / Work** (`#8B5CF6`): Multi-tier organization (`Projects` -> `{Client/Entity}` -> `{Payroll | Tasks | Specs}`).
4. **Shopping & Wishlist** (`#F97316`): E-commerce products (`Shopping` -> `{Shoes | Electronics | Fashion | Home}`).
5. **Code & Tech** (`#F59E0B`): GitHub snippets, stack traces, terminal logs, API configs.
6. **Social & Chat** (`#EC4899`): WhatsApp, Telegram, Discord, Instagram, Twitter/X.
7. **Documents & IDs** (`#06B6D4`): Passports, Driver Licenses, Aadhaar, Contracts.
8. **Travel & Tickets** (`#14B8A6`): Flight boarding passes, train bookings, hotel vouchers.
9. **Notes & Knowledge** (`#6366F1`): Articles, recipes, learning materials, study notes.
10. **Memes & Humor** (`#EAB308`): Jokes, snapshots, comedy cards.
11. **Unsorted** (`#94A3B8`): Awaiting OCR processing or low-confidence review.

---

## 6. Background Detection & Ingestion Flow

1. **Native MediaStore ContentObserver (Android)** / **PhotoKit Observer (iOS)** observes URI changes.
2. **Deduplication Check**: In-memory LRU set + SQLite lookup by `device_asset_id` and SHA-256 composite file hash (`${path}_${size}_${modifiedTime}`).
3. **Local Ingestion**: Metadata is inserted into `screenshots` table with status `pending`.
4. **On-Device OCR**: Google ML Kit Text Recognition extracts text blocks asynchronously.
5. **Classification Engine**:
   - Executes deterministic regex rules (extracting clients, merchants, amounts, tracking numbers).
   - If online, posts to backend classification endpoint.
   - If offline, executes local media classifier and enqueues payload to `sync_queue`.
6. **Smart Folder Assignment**: Creates missing parent/child folders dynamically and updates screenshot category foreign key.
7. **Push Notification**: Fires local system notification: `"ContextVault: Screenshot filed into {Category} / {Subcategory}"`.
8. **Reactive UI Update**: Zustand stores update reactively without requiring manual pull-to-refresh.
