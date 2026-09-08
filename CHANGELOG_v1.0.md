# Changelog — ContextVault v1.0.0

All notable changes to the ContextVault React Native mobile application for the Hackathon v1.0 Release.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-09-08

### Added
- **Automatic Screenshot Detection Engine (RN-03)**:
  - Background Android `MediaStore.Images.Media` ContentObserver detecting screenshots in real time without manual import or refresh buttons.
  - In-memory circular deduplication and SQLite composite hash checks.
  - Foreground service and boot receiver integration.
  - Synthetic screenshot event simulator for instant testing and demo injection.

- **Google ML Kit OCR Processing Pipeline (RN-04)**:
  - On-device text recognition with zero image upload or binary transmission.
  - Concurrency = 1 sequential queue preventing memory spikes.
  - High-confidence block layout parsing, normalized text caching, and fast retrieval.
  - Interruption recovery (`resumePendingOnStartup`) restoring unfinished queue jobs upon app launch.

- **Dynamic Smart Folder Engine (RN-05)**:
  - Multi-tiered keyword and rule-based heuristic categorization.
  - Auto-generation of dynamic categories: Finance (UPI, Invoices), Development (Code, Errors), Travel (Flights, Hotels), Shopping, Work, Health, Entertainment, and Personal.
  - Subcategory hierarchy with custom color badges, Ionicons, and screenshot counters.

- **Living Folder Context Generation & AI Sync (RN-06)**:
  - Local synthesis of folder knowledge summaries, extracted entity graphs (amounts, dates, merchants, tracking numbers), and suggested tags.
  - Strict privacy guarantee: only anonymized text tokens and dimensions are synced with the backend AI engine.
  - Offline sync queue with atomic locking and exponential backoff retry.

- **Context AI Chat Experience (RN-07)**:
  - Folder-level conversational AI assistant answering natural language questions grounded in screenshot OCR, entity graphs, and timelines.
  - Interactive clickable citation cards jumping directly to source screenshots.
  - Dynamic suggestion chips and full SQLite chat message history.

- **Ask ContextVault — Global AI Search (RN-08)**:
  - Cross-vault search querying OCR text, folder contexts, extracted entities, and metadata.
  - AI Answer Card synthesizing direct answers with interactive entity badges and follow-up exploration chips.
  - Voice Search modal with simulated waveform visualization and prompt helpers.
  - Recent search history and pinned/saved search queries.
  - Keyword match highlighting and multi-criteria filter modal (Folders, Date ranges, Sources, Favorites, Needs Review).

- **Production Polish & Performance Optimization (RN-10)**:
  - In-memory circular diagnostic logger (`loggerService`) with export capabilities.
  - Global `ErrorBoundary` with fatal crash recovery UI, local crash persistence, and stack copying.
  - Android notification channels (`screenshots_channel`, `ocr_channel`, `sync_channel`, `review_channel`).
  - Android 13+ `POST_NOTIFICATIONS` permission integration.
  - Comprehensive Storage & Data manager screen with SQLite database defragmentation (`VACUUM`) and itemized cache purges.
  - QA Debug Panel with live pipeline monitors, ping benchmarks, and log streaming.

- **Release Build, Offline Demo Mode & Backup System (RN-11)**:
  - Standalone Hackathon Demo Mode preloading 12 realistic screenshots across Finance, Travel, Dev, Shopping, and Health with living contexts and chat history—100% offline.
  - Local Backup & Restore service exporting and importing full database JSON payloads.
  - Release Performance Audit measuring cold start, warm start, OCR latency, search response, and battery impact.
  - Release build packaging with ProGuard keep rules, Hermes bytecode optimization, and `com.contextvault.app` application ID.

### Changed
- Refactored `DashboardScreen` to use pull-to-refresh (`RefreshControl`) and virtualized lists.
- Unified branding and accessibility labels (`accessibilityRole`, `accessibilityLabel`) across all interactive components.
- Android application ID set to `com.contextvault.app`.

### Security & Privacy
- Zero image binary upload guarantee verified across all services.
- On-device local OCR processing via Google ML Kit.
