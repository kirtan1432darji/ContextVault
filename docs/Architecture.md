# ContextVault — System Architecture & Data Flow (v1.0.0)

## 1. High-Level Architecture

ContextVault decouples physical device storage from intelligent metadata processing through a non-destructive, privacy-first pipeline.

```
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
│  │  - MediaStore Scanner (ContentObserver) - On-Device ML Kit OCR Bridge  │  │
│  │  - Multi-tier Rule Classifier          - Offline Sync Queue Manager   │  │
│  │  - Background Headless Task Dispatcher  - Local Notification Center    │  │
│  │  - Firebase Crashlytics Handler        - Local File Resolution Layer  │  │
│  └─────────────────────────────────────────┬─────────────────────────────┘  │
└────────────────────────────────────────────┼────────────────────────────────┘
                                             │ HTTP/REST (JWT Bearer)
                                             │ JSON Metadata & Text Tokens Only
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
│  - FolderContexts (Summaries & Tasks)  - ChatHistories (Multi-turn AI)      │
│  - Extracted Entities & Timelines      - Full-Text Search (FTS Catalog)     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architectural Guarantees

### 1. Non-Destructive Intelligence
- **Zero Binary Upload**: Full-size user photos and screenshot bitmaps **never** leave the physical mobile device.
- **Zero File Mutation**: ContextVault **never moves, renames, edits, compresses, or deletes** pictures in the device camera roll or Android MediaStore.

### 2. Dual-Path Image Resolution
To comply with Android 10+ (API 29+) Scoped Storage while maintaining high performance:
1. MediaStore Content URI (`content://media/external/images/media/{deviceAssetId}`) is queried as Candidate 0.
2. Raw File URI (`file://{filePath}`) is queried as fallback Candidate 1.
3. React Native Fresco sequentially attempts both candidates before displaying a retry banner.

### 3. Offline-First Resilience
- Embedded SQLite (`ai_screenshot_organizer.db`) caches all categories, screenshots, OCR text, and chat sessions.
- In offline or network-failure states, the app operates with 100% functionality from local storage without crash loops.
- `sync_queue` records outbound mutations and replays them with exponential backoff upon network restoration.
