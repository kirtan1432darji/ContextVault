# Sprint P3-B Walkthrough — Context Chat AI (Production Memory Assistant)

## Overview & Architecture

Sprint P3-B delivers **Context Chat AI**, an on-device, conversational memory assistant that answers natural language questions over screenshot memories in ContextVault (`C:\Kirtan_Darji\AI_Projects\ContextVault`). Context Chat AI leverages **Vision AI metadata**, **Memory Timeline events**, **Smart Folders**, **Daily/Weekly Digests**, and **SQLite** without requiring screenshot binary uploads or cloud processing.

```
                    ┌─────────────────────────────────────────┐
                    │       User Natural Language Query       │
                    │  "Show my Google Pay payments this month" │
                    └────────────────────┬────────────────────┘
                                         │
                                         ▼
                    ┌─────────────────────────────────────────┐
                    │      ContextRetrievalService (v2.0)     │
                    │  • Query Intent Parser (category/merchant)│
                    │  • Ranked Screenshots (up to 10)        │
                    │  • Memory Timeline Events (up to 5)     │
                    │  • Daily & Weekly Digests (up to 3)     │
                    │  • Folder Context (up to 2)             │
                    │  • Progressive Session Summary (30s TTL)│
                    └────────────────────┬────────────────────┘
                                         │
                                         ▼
                    ┌─────────────────────────────────────────┐
                    │    ContextPromptBuilderService          │
                    │  • Section 1: User Question             │
                    │  • Section 2: Screenshot Memories       │
                    │  • Section 3: Memory Timeline Events    │
                    │  • Section 4: Daily/Weekly Digests      │
                    │  • Section 5: Folder Context            │
                    │  • Section 6: Grounding Instructions    │
                    │  (Strict token budget, zero UUID leak)  │
                    └────────────────────┬────────────────────┘
                                         │
                   ┌─────────────────────┴────────────────────┐
                   │                                          │
        [Server Online]                            [Server Offline / Guest]
                   ▼                                          ▼
┌──────────────────────────────────────┐   ┌─────────────────────────────────────┐
│ Vision AI Server (vLLM / Qwen2.5-VL) │   │ Grounded Metadata Synthesis Engine  │
│ • Local inference via /api/vision/chat│   │ • Finance & UPI Outlay Calculator   │
│ • Zero screenshot binary upload      │   │ • Food Delivery & Shopping Parser   │
│ • Citations matched to SQLite IDs    │   │ • Travel Routes, PNRs & Documents   │
└──────────────────┬───────────────────┘   └──────────────────┬──────────────────┘
                   │                                          │
                   └─────────────────────┬────────────────────┘
                                         │
                                         ▼
                    ┌─────────────────────────────────────────┐
                    │          ContextChatService             │
                    │  • Progressive Status Callbacks         │
                    │  • Rich Citation Extraction             │
                    │  • 20-Message Session Auto-Summarizer   │
                    │  • SQLite Persistence (Version 9)       │
                    └────────────────────┬────────────────────┘
                                         │
                    ┌────────────────────┴────────────────────┐
                    ▼                                         ▼
┌───────────────────────────────────────┐ ┌───────────────────────────────────────┐
│         ContextChatScreen             │ │           DashboardScreen             │
│ • Dark Glassmorphic Theme (#0B0F19)   │ │ • "Ask ContextVault AI" Card          │
│ • Multi-session Drawer & Switcher     │ │ • 4 Quick-Launch Prompt Chips         │
│ • Markdown Bubbles & Thinking Bar     │ │ • Seamless Jump to Active Chat Session│
│ • Tappable Citations -> Detail Screen │ └───────────────────────────────────────┘
└───────────────────────────────────────┘
```

---

## 1. Database Schema & Persistence (Phase 1)

Database version bumped from `8` to `9` in `frontend/src/database/schema.ts` with non-destructive migrations in `frontend/src/database/database.ts`.

### New SQLite Tables:
1. **`chat_sessions`**:
   - Manages distinct conversation threads.
   - Columns: `id` (TEXT PRIMARY KEY), `title` (TEXT), `summary` (TEXT), `created_at` (TEXT), `updated_at` (TEXT).
   - Indexes: `idx_chat_sessions_updated_at`.
2. **`chat_messages`**:
   - Persists all conversation turns with grounded citations and source metadata.
   - Columns: `id` (TEXT PRIMARY KEY), `session_id` (TEXT NOT NULL), `role` (TEXT NOT NULL: `user` | `assistant`), `content` (TEXT NOT NULL), `citations_json` (TEXT), `status` (TEXT), `created_at` (TEXT).
   - Indexes: `idx_chat_messages_session_id`, `idx_chat_messages_created_at`.

### Repositories:
- **`ChatSessionRepository`**: Full CRUD operations (`createSession`, `getSession`, `listSessions`, `updateSession`, `deleteSession`, `clearAllSessions`) with in-memory test fallback.
- **`ChatMessageRepository`**: Full message persistence (`saveMessage`, `getMessagesBySession`, `getMessageCount`, `deleteMessagesBySession`, `clearAllMessages`) with in-memory fallback.

---

## 2. Hybrid Context Retrieval Engine (Phase 2)

Implemented in `frontend/src/services/contextChat/ContextRetrievalService.ts`:
- **Query Intent Parsing**: Automatically detects categories (`finance`, `food_delivery`, `shopping`, `travel`, `document`, `chat`), specific merchants (e.g. *Google Pay*, *Swiggy*, *Amazon*, *IndiGo*), and time ranges (`today`, `yesterday`, `this_week`, `this_month`).
- **Ranked Hybrid Retrieval**:
  - Fetches up to **10 relevant screenshots** with scoring by OCR text, vision summary, keyword matches, and entity hits.
  - Fetches up to **5 memory timeline events** matching temporal or category boundaries.
  - Fetches up to **3 daily/weekly digests** for high-level aggregated totals.
  - Fetches up to **2 folder contexts** for semantic collection intelligence.
  - Loads previous **session summary** to maintain conversational continuity.
- **Performance Caching**: 30-second TTL in-memory caching (`clearCache()`) to guarantee instantaneous repeat responses.

---

## 3. Grounded Prompt Builder Service (Phase 3)

Implemented in `frontend/src/services/contextChat/ContextPromptBuilderService.ts`:
- Formats structured prompt containing 6 sections:
  1. `[USER QUESTION]`
  2. `[SCREENSHOT MEMORIES]` (fileName, date, merchant, amounts in INR `₹`, vision summary, OCR snippet)
  3. `[MEMORY TIMELINE EVENTS]` (period, event title, summary)
  4. `[DAILY & WEEKLY DIGESTS]` (digest date, screenshot count, spending total, category breakdown)
  5. `[FOLDER CONTEXT]` (folder name, category, summary)
  6. `[INSTRUCTIONS]` (strict grounding, Indian Rupee formatting, no SQL/UUID leaks)
- Enforces strict character and token limits per section to prevent context window overflow.

---

## 4. Context Chat Engine & Offline Synthesis (Phases 4 – 7)

Implemented in `frontend/src/services/contextChat/ContextChatService.ts`:
- **Progressive Status Callbacks**: Emits real-time progression events (`Retrieving memories...` -> `Building context...` -> `Synthesizing answer...`).
- **Dual-Path Generation**:
  - **Online Mode**: Communicates with the local Vision AI server (`/api/vision/chat`) using structured JSON context without uploading raw images.
  - **Offline / Guest Mode Fallback**: Synthesizes structured, fully-grounded answers directly from SQLite metadata for:
    - *Finance & UPI*: Computes accurate spending totals in INR (`₹18,000`), identifies transaction IDs and merchants.
    - *Food Delivery*: Summarizes orders (e.g. Swiggy/Zomato), item details, and total food outlay.
    - *Shopping*: Identifies invoices (e.g. Amazon, Flipkart), product names, and amounts.
    - *Travel*: Extracts flight numbers (e.g. `6E 204`), PNRs (`W9KZ7Q`), departure dates, and routes (`BOM to DEL`).
    - *Documents & Chats*: Identifies IDs, passes, and message summaries with full on-device privacy.
- **Rich Citations**: Populates `ChatMessageCitation` cards with `screenshotId`, `fileName`, `localPath`, `category`, `confidence`, `merchant`, `amount`, and `date`.
- **20-Message Auto-Summarization**: Automatically produces a rolling executive summary every 20 messages to keep long sessions compact and fast.
- **Dynamic Suggestions**: Generates contextually relevant follow-up questions tailored to the retrieved context.

---

## 5. Modern Glassmorphic UI (Phase 8)

Implemented in `frontend/src/screens/ContextChatScreen.tsx`:
- **Theme**: Premium `#0B0F19` dark glassmorphic styling consistent with ContextVault design standards.
- **Session Switcher**: Slide-up modal listing all chat sessions with timestamps, title editing, active indicators, and a 1-tap "New Chat" button.
- **Thinking State**: Clean animated progress bar and status indicator communicating the multi-stage retrieval pipeline.
- **Interactive Citations**: Renders visual citation chips beneath assistant messages showing merchant, category icon, amount, and date. Tapping a citation seamlessly navigates to `ScreenshotDetailScreen`.
- **Direct Query Deep-Linking**: Accepts route params (`initialQuery`, `folderId`, `sessionId`) for instant search from any screen.

---

## 6. Dashboard & Search Integration (Phases 9 & 10)

- **`DashboardScreen.tsx`**:
  - Replaced the locked teaser with an interactive **"Ask ContextVault AI" Card**.
  - Includes 4 quick prompt chips (*"Today's summary"*, *"Spending this week"*, *"Travel memories"*, *"Shopping receipts"*) that deep-link directly into Context Chat with execution on mount.
  - Displays the most recent chat session with a 1-tap "Resume" action.
- **`searchService.ts`**:
  - Wired conversational natural language queries into `ContextRetrievalService` across both SQLite and in-memory paths.

---

## 7. Verification & Quality Gates

| Gate / Suite | Target | Status |
| :--- | :--- | :--- |
| `npm run typecheck` | 0 TypeScript errors | **PASSED (0 errors)** |
| `src/__tests__/chatRepository.test.ts` | Session & message persistence | **PASSED (6/6 tests)** |
| `src/__tests__/contextRetrieval.test.ts` | Hybrid retrieval & ranking | **PASSED (5/5 tests)** |
| `src/__tests__/contextPromptBuilder.test.ts` | Prompt building & token budgets | **PASSED (4/4 tests)** |
| `src/__tests__/contextChat.test.tsx` | Screen rendering & user interactions | **PASSED (19/19 tests)** |
| `src/__tests__/contextChatEngine.test.ts` | End-to-end question answering pipeline | **PASSED (6/6 tests)** |
| **All Test Suites (Jest)** | 37 suites, 375 tests | **PASSED (37/37 suites, 375/375 tests, 100%)** |
| `npm run bundle:local-release` | Metro bundle compilation | **PASSED (Exit code 0)** |
| `gradlew assembleDebug` | Android debug APK compilation | **BUILD SUCCESSFUL** |
