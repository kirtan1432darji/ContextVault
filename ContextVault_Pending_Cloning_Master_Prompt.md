# ContextVault Pending Cloning Master Prompt (v1.0)

## Purpose

This document is the **master cloning and continuation prompt** for
ContextVault. Any new AI chat should read this document first and
continue development **without breaking existing code or architecture**.

------------------------------------------------------------------------

# Project Identity

-   **Project Name:** ContextVault
-   **Repository:** `kirtan1432darji/ContextVault`
-   **Frontend:** React Native (TypeScript)
-   **Backend:** Python FastAPI
-   **Database:** Microsoft SQL Server 2022 + SQLite (offline cache)
-   **Architecture Source of Truth:** `Brain.md`

## Core Rule (Never Break This)

-   Never modify or delete working Flutter project (`Image_organizer`).
-   Work only inside `ContextVault`.
-   Frontend and Backend are developed in separate chats and separate
    Git branches.
-   Every completed sprint must be committed and pushed to GitHub.

------------------------------------------------------------------------

# Git Workflow

## Branches

-   `main` → Stable production branch.
-   `frontend-dev` → React Native development.
-   `backend-dev` → FastAPI development.

## Git Rules

For every feature:

``` bash
git add .
git commit -m "feat(frontend): <feature name>"
git push origin frontend-dev
```

or

``` bash
git add .
git commit -m "feat(backend): <feature name>"
git push origin backend-dev
```

Never commit cache files, `.env`, logs, build artifacts, or secrets.

------------------------------------------------------------------------

# Current Project Status

## Completed Frontend Sprints

-   RN-01 --- React Native Foundation.
-   RN-02 --- Authentication.
-   RN-03 --- Screenshot Detection Engine.
-   RN-04 --- Google ML Kit OCR Engine.
-   RN-05 --- Smart Folder Engine.
-   RN-06 --- Folder Context Generation & AI Sync.

## Completed Backend Sprints

-   BE-01 --- FastAPI Foundation.
-   BE-03 --- Screenshot Classification Engine.
-   BE-04 --- Folder Context Generation Engine.

**Current completion:** \~72%

------------------------------------------------------------------------

# Existing Working Features

-   JWT Authentication.
-   Automatic Screenshot Detection.
-   Background MediaStore Observer.
-   Google ML Kit OCR.
-   SQLite Offline Cache.
-   SQL Server Backend.
-   Dynamic Smart Folders.
-   Folder Context Generation.
-   Entity Extraction.
-   Timeline Generation.
-   Semantic Search.
-   Dashboard Metrics.
-   Screenshot Detail with OCR and AI metadata.

------------------------------------------------------------------------

# Pending Development Roadmap

## Phase 1 --- Context AI Chat

### RN-07 (Frontend)

Build Context AI Chat screen.

Features:

-   Chat inside every folder.
-   Suggested prompts.
-   Conversation history.
-   Typing animation.
-   Citation cards linking screenshots.
-   Offline cached chat history.

### BE-05 (Backend)

Create AI Chat APIs.

Endpoints:

-   POST `/api/chat/message`
-   GET `/api/chat/history/{folderId}`
-   GET `/api/chat/suggestions/{folderId}`

Use Folder Context, Search Index, OCR text, Tags and Entities.

No image upload.

------------------------------------------------------------------------

## Phase 2 --- Global AI Search

Allow user to search the entire screenshot knowledge base.

Examples:

-   Find invoices.
-   Find UPI payments.
-   Find meeting notes.
-   Find Flutter screenshots.
-   Find shopping items.

Backend returns ranked results.

------------------------------------------------------------------------

## Phase 3 --- Offline Sync Engine

-   Sync Queue.
-   Retry when internet returns.
-   Conflict Resolution.
-   Last Write Wins.
-   Incremental Sync.

------------------------------------------------------------------------

## Phase 4 --- User Folder Management

-   Create custom folders.
-   Rename.
-   Merge.
-   Drag & Drop screenshots.
-   Favorite folders.

------------------------------------------------------------------------

## Phase 5 --- Production Release

-   Android Release APK.
-   Android App Bundle.
-   iOS Support.
-   Performance Optimization.
-   Crash Reporting.
-   Testing.
-   CI/CD.

------------------------------------------------------------------------

# Project Architecture Rules

## Privacy

-   Zero screenshot binaries leave device.
-   Only OCR metadata syncs.
-   SHA256 fingerprint used for deduplication.

## Offline First

-   SQLite is the local source.
-   SQL Server is cloud source.
-   Sync Queue handles network failures.

## Folder Rules

-   Unlimited nested folders.
-   Dynamic hierarchy.
-   AI folders + User folders coexist.

------------------------------------------------------------------------

# API Contracts (Frozen)

Authentication:

-   `/api/auth/register`
-   `/api/auth/login`
-   `/api/auth/profile`
-   `/api/auth/refresh`
-   `/api/auth/logout`

Screenshots:

-   `/api/screenshots/upload-metadata`
-   `/api/screenshots/sync`
-   `/api/screenshots/{id}`

Classification:

-   `/api/classification/classify`
-   `/api/classification/reclassify`

Context:

-   `/api/context/folder/{folderId}`
-   `/api/context/generate/{folderId}`
-   `/api/context/regenerate/{folderId}`
-   `/api/context/search`
-   `/api/context/entities/{folderId}`
-   `/api/context/timeline/{folderId}`

Chat (Pending):

-   `/api/chat/message`
-   `/api/chat/history/{folderId}`
-   `/api/chat/suggestions/{folderId}`

------------------------------------------------------------------------

# Coding Rules

## Frontend Chat

-   Never modify backend.
-   Work only on `frontend-dev`.
-   Use existing services and stores.
-   Material 3 dark theme only.
-   TypeScript strict mode.

## Backend Chat

-   Never modify frontend.
-   Work only on `backend-dev`.
-   FastAPI Clean Architecture.
-   SQLAlchemy 2.x.
-   Alembic migrations.
-   SQL Server compatibility.

------------------------------------------------------------------------

# Acceptance Rule

Before marking any sprint complete, output:

-   Files Created.
-   Files Modified.
-   Database Changes.
-   APIs Added/Consumed.
-   Tests Passed.
-   Git Commit.
-   Git Push.

Never skip Git commit.

------------------------------------------------------------------------

# Final Instruction for Any AI

Treat this document and `Brain.md` as the **single source of truth**.

Do not redesign architecture.

Continue only the next pending sprint while preserving all completed
functionality and Git history.
