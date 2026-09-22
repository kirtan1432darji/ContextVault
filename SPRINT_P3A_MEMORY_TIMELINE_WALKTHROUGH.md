# Sprint P3-A Walkthrough — AI Memory Timeline, Daily/Weekly Digests & Memory Insights

## Overview & Architecture

Sprint P3-A elevates ContextVault from a smart folder screenshot organizer into a comprehensive **AI Screenshot Memory Assistant**. All timeline events, temporal digests, and cross-domain behavioral insights are dynamically synthesized from **Vision AI metadata already stored in SQLite**, preserving full **offline-first functionality for Guest Mode** without relying on any external cloud or ML Kit OCR dependencies.

```
                  ┌─────────────────────────────────────────┐
                  │    Android Screenshot / MediaStore      │
                  └────────────────────┬────────────────────┘
                                       │
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │  Local Vision AI Server (Qwen2.5-VL)    │
                  │  Text • Category • Confidence • Entities│
                  └────────────────────┬────────────────────┘
                                       │
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │ SQLite Database v8 (contextvault.db)    │
                  │  • screenshots                          │
                  │  • memory_timeline                      │
                  │  • daily_digest                         │
                  │  • weekly_digest                        │
                  │  • monthly_digest                       │
                  └──────┬──────────────────────┬───────────┘
                         │                      │
       ┌─────────────────┴────────┐   ┌─────────┴────────────────┐
       ▼                          ▼   ▼                          ▼
┌──────────────────────┐ ┌────────────────────┐ ┌────────────────────────┐
│MemoryTimelineService │ │DailyDigestService  │ │DigestAggregationService│
│• Adaptive Merging    │ │• Spending Totals   │ │• Weekly/Monthly Rollup │
│• Period Partitioning │ │• Category Breakdown│ │• Capture Streak Engine │
└──────────┬───────────┘ └─────────┬──────────┘ └───────────┬────────────┘
           │                       │                        │
           └───────────────────┬───┴────────────────────────┘
                               ▼
                   ┌───────────────────────┐
                   │ MemoryInsightsService │
                   │ • 6 Domain Cards      │
                   └───────────┬───────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌─────────────────────────┐           ┌────────────────────────┐
│  MemoryTimelineScreen   │           │    DashboardScreen     │
│ • Streak & Counts Hero  │           │ • Timeline Preview     │
│ • Daily Digest Card     │           │ • Weekly Strip         │
│ • Domain Insights Rail  │           │ • Deep Dive Link       │
│ • Grouped Timeline Flow │           └────────────────────────┘
└─────────────────────────┘
```

---

## 1. Database Schema & Persistence (Phase 1)

Database version bumped from `7` to `8` in `frontend/src/database/schema.ts` with non-destructive migrations in `frontend/src/database/database.ts`.

### New SQLite Tables:
1. **`memory_timeline`**:
   - Stores consolidated memory clusters and events without duplicating screenshot blobs.
   - Columns: `id`, `event_date` (`YYYY-MM-DD`), `event_period` (`today` | `yesterday` | `this_week` | `earlier_this_month` | `older`), `event_type`, `summary`, `screenshot_ids_json`, `created_at`.
   - Indexes: `idx_memory_timeline_date`, `idx_memory_timeline_period`.
2. **`daily_digest`**:
   - Caches pre-computed daily executive rollups.
   - Columns: `digest_date` (PRIMARY KEY), `screenshot_count`, `spending_total`, `merchant_summary_json`, `category_summary_json`, `ai_summary`, `created_at`.
3. **`weekly_digest`**:
   - Columns: `week_key` (`YYYY-Www`, PRIMARY KEY), `screenshot_count`, `spending_total`, `ai_summary`, `top_categories_json`, `created_at`.
4. **`monthly_digest`**:
   - Columns: `month_key` (`YYYY-MM`, PRIMARY KEY), `screenshot_count`, `spending_total`, `ai_summary`, `top_merchants_json`, `created_at`.

### Repositories:
- `MemoryTimelineRepository`: Full CRUD including `upsertEvent`, `getEventsByDate`, `getEventsByPeriod`, `getAllEvents`, `deleteEvent`, `deleteByScreenshotId`.
- `DigestRepository`: Handles atomic upsert and querying for daily, weekly, and monthly digests with JSON deserialization.

---

## 2. Adaptive Event Clustering Engine (Phase 2)

Implemented in `frontend/src/services/memory/MemoryTimelineService.ts`:
- **Adaptive Category Merge Windows**:
  - **Payment / UPI**: 5 minutes (`300,000 ms`)
  - **Chats / WhatsApp**: 10 minutes (`600,000 ms`)
  - **Shopping / Orders**: 8 minutes (`480,000 ms`)
  - **Travel / Transit**: 15 minutes (`900,000 ms`)
  - **Default**: 5 minutes (`300,000 ms`)
- **Strict Separation**: Screenshots of different categories are **never** merged, even if captured within seconds of each other.
- **Section Grouping**:
  - Automatically classifies events into `today`, `yesterday`, `this_week`, `earlier_this_month`, and `older` based on local calendar dates.
  - Generates rich, contextual summaries mentioning top merchants, amounts, and participant count.

---

## 3. Daily, Weekly & Monthly Digest Engines (Phases 3 & 4)

- **`DailyDigestService`**:
  - Real-time aggregation of today's screenshot count, total financial outlay (summed from Vision AI amount entities), top merchants, and category distributions.
  - Synthesizes intelligent natural language highlights (e.g. *"Spent ₹1,450 across 3 transactions"* or *"3 chats saved"*).
- **`DigestAggregationService`**:
  - Aggregates daily data into ISO weekly digests (`YYYY-Www`) and calendar monthly digests (`YYYY-MM`).
  - **Yearly Highlights**: Highlights top spending months, most active categories, and total items captured over the year.
  - **Capture Streak Engine**: Computes consecutive active capture days (`calculateScreenshotStreak`).

---

## 4. 6-Domain Memory Insights System (Phase 5)

Implemented in `frontend/src/services/memory/MemoryInsightsService.ts`:
1. **Spending**: Total expense, top merchants, transaction count, average outlay per transaction.
2. **Shopping**: Saved items, wishlisted products, e-commerce orders.
3. **Productivity**: Code snippets, work documents, notes, slide captures.
4. **Travel**: Flight tickets, boarding passes, train bookings, itineraries.
5. **Health**: Prescriptions, lab reports, medical receipts, fitness summaries.
6. **Communication**: Important chat discussions, emails, social posts.

---

## 5. UI Component Library & Screen Redesign (Phases 6, 7, 11)

- **Components (`frontend/src/components/memory/`)**:
  - `MerchantChip`: Displays merchant pill with brand icon/avatar.
  - `ActivityBadge`: Visual indicator for activity type (Payment, Chat, Work, Shopping, etc.).
  - `TimelineCard`: Dark card (`#161B26`) featuring adaptive preview thumbnails, title, timestamp, merchant badges, and expandable drawer.
  - `DigestCard`: Polished summary card showing spending totals, transaction badges, and AI bullet points.
  - `InsightCard`: Horizontal insight cards with progress metrics and icon headers.
  - `TimelineSection`: Sticky section header with relative date tags and item counters.
- **`MemoryTimelineScreen`**:
  - `#0B0F19` dark glassmorphism design.
  - Hero statistics banner showing capture streak 🔥, total memories, and active days.
  - Daily summary card with 1-tap refresh.
  - Category filter pills (`All`, `Payments`, `Shopping`, `Chats`, `Travel`, `Work`, `Health`).
  - Smooth FlatList rendering clustered timeline sections.
- **`DashboardScreen` Integration**:
  - Added **AI Memory Timeline Preview Card** highlighting today's memory count and spending summary.
  - Added **This Week Activity Strip** showing daily memory density.
  - Direct CTA button navigating straight to the Memory Timeline.

---

## 6. Natural Language Search Integration (Phase 8)

Integrated into `frontend/src/services/searchService.ts` and `frontend/src/services/search/SemanticSearchService.ts`:
- `parseNaturalLanguageTimeFilters(query)` understands:
  - **Relative Time Expressions**: `"today"`, `"yesterday"`, `"this week"`, `"last week"`, `"this month"`, `"last month"`.
  - **Calendar Months**: `"January"` through `"December"`.
  - **Intent & Category Phrases**: `"payments"`, `"receipts"`, `"chats"`, `"Amazon orders"`, `"Swiggy food"`, `"flight tickets"`, `"salary"`, etc.
- **Cross-Table Search**:
  - Joins `memory_timeline` and `daily_digest` to find matching event clusters and injects their screenshot IDs into search candidate lists.
  - Fallback filters ensure searches like `"today payments"` cleanly return today's financial screenshots even if the literal string *"today payments"* is not present in the OCR text.

---

## 7. Pipeline Automation (Phases 9 & 10)

- Automatic memory updates are wired into:
  - `frontend/src/services/SmartFolderClassificationService.ts` (instant foreground processing).
  - `frontend/src/services/background/BackgroundAIWorker.ts` (background batch processing).
- Upon classification of every screenshot:
  1. `memoryTimelineService.addScreenshotToTimeline(screenshot)` clusters the screenshot.
  2. `dailyDigestService.updateDailyDigest(date)` recalibrates today's daily digest.
  3. `memoryInsightsService.refreshMemoryInsights()` refreshes domain analytics.

---

## 8. Verification & Quality Assurance (Phase 13)

### Automated Test Suites:
- `frontend/src/__tests__/memoryTimeline.test.tsx` (19/19 passing)
- `frontend/src/__tests__/memoryTimelineEngine.test.ts` (8/8 passing)
- `frontend/src/__tests__/dailyDigestEngine.test.ts` (3/3 passing)
- `frontend/src/__tests__/digestAggregation.test.ts` (4/4 passing)
- `frontend/src/__tests__/memoryInsights.test.ts` (3/3 passing)
- `frontend/src/__tests__/naturalLanguageTimeSearch.test.ts` (5/5 passing)
- **Total Project Test Suite: 33 Test Suites, 354/354 Tests Passing (100% Pass Rate)**.

### TypeScript & Bundling Verification:
- `npm run typecheck`: **0 errors**.
- `npm run bundle:local-release`: **Success (Exit code 0)**.
