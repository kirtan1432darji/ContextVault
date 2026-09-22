# ContextVault 📱🔍🧠

> **Privacy-First Intelligent Organizational Layer for Mobile Screenshots**  
> *Transform your chaotic photo gallery into a structured, searchable, and conversational second brain without ever uploading raw photo binaries.*

[![Mobile APK CI/CD](https://github.com/kirtan1432darji/ContextVault/actions/workflows/mobile-apk.yml/badge.svg)](https://github.com/kirtan1432darji/ContextVault/actions/workflows/mobile-apk.yml)
[![Latest Release](https://img.shields.io/github/v/release/kirtan1432darji/ContextVault?color=blue&label=Release&logo=github)](https://github.com/kirtan1432darji/ContextVault/releases/latest)
[![Platform](https://img.shields.io/badge/Platform-Android-green?logo=android)](https://github.com/kirtan1432darji/ContextVault/releases/latest/download/ContextVault.apk)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

---

## Download Latest APK

You can always download the latest compiled Android build of **ContextVault** directly using our permanent release link:

📦 **[Download Latest ContextVault.apk](https://github.com/kirtan1432darji/ContextVault/releases/latest/download/ContextVault.apk)**

```text
https://github.com/kirtan1432darji/ContextVault/releases/latest/download/ContextVault.apk
```

> [!TIP]
> **Permanent Link Guarantee**: This download URL is fixed and **never changes**. Every push to the `main` branch affecting the mobile frontend automatically triggers our GitHub Actions CI/CD pipeline, which builds a fresh Android debug APK and atomically replaces the `ContextVault.apk` asset in the `latest` rolling release. Anyone who accesses or bookmarks this link will always receive the newest available APK.

### Installation Instructions for Android

Follow these steps to install the APK directly on any Android device (Android 8.0+ recommended):

1. **Download the APK**:
   - Tap the [Permanent Download Link](https://github.com/kirtan1432darji/ContextVault/releases/latest/download/ContextVault.apk) from your mobile browser (Chrome, Firefox, Brave, etc.), or download it on your PC and transfer it to your device.
2. **Allow Installation from Unknown Sources**:
   - When the download completes, tap the notification or open your **Files / Downloads** app and select `ContextVault.apk`.
   - If prompted with *"For your security, your phone is not allowed to install unknown apps from this source"*:
     1. Tap **Settings** in the popup prompt.
     2. Toggle **Allow from this source** to **ON**.
     3. Press the **Back** button to return to the installer.
   - *Manual path: Go to Android Settings > Apps > Special App Access > Install Unknown Apps > Select your browser/file manager > Toggle "Allow from this source".*
3. **Install the Application**:
   - Tap **Install** (or **Update** if a previous build is present).
   - Once installation completes, tap **Open**.
4. **Grant Permissions on First Launch**:
   - **Photos / Media / Storage**: Required for the Android `MediaStore` scanner to detect screenshots non-destructively in the background.
   - **Notifications**: Required to notify you when new screenshots are indexed and classified into smart folders.

---

## Core Product Vision & Guarantees

Smartphones capture countless screenshots daily: UPI payment confirmations, flight tickets, hotel vouchers, code snippets, chat receipts, and research notes. Finding or extracting text from them later is frustrating.

**ContextVault** solves this with an intelligent local-first pipeline:

- **🛡️ Zero Binary Upload**: Full-size user photos and screenshot bitmaps **never** leave your physical device.
- **🔒 Zero File Mutation**: ContextVault **never moves, renames, edits, or deletes** pictures in your device gallery or camera roll.
- **⚡ On-Device OCR**: Optical Character Recognition runs locally on your phone via Google ML Kit.
- **📁 Dynamic Smart Folders**: Automatically indexes screenshots into living categories (Finance, Travel, Code, Shopping, Work, Health, Entertainment).
- **💬 Context AI Chat**: Chat directly with any folder (*"What seat was I assigned for my flight to Bangalore?"* or *"What did I spend on Swiggy this week?"*) with interactive screenshot citations.
- **🔎 Global AI Search**: Full-text and semantic search across your entire visual knowledge repository.

---

## Architecture Overview

```text
ContextVault System Architecture
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MOBILE CLIENT (React Native)                     │
│                                                                             │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────┐  │
│  │   Presentation Layer    │  │     State Management    │  │ Local Cache │  │
│  │   Material Design 3     │  │   Zustand Stores        │  │ SQLite DB   │  │
│  │   React Navigation v6   │  │   Async Storage / MMKV  │  │ In-Memory   │  │
│  └────────────┬────────────┘  └────────────┬────────────┘  └──────┬──────┘  │
│               │                            │                      │         │
│  ┌────────────▼────────────────────────────▼──────────────────────▼──────┐  │
│  │                     Services & Heuristics Engine                      │  │
│  │  - MediaStore Scanner              - On-Device OCR Bridge (ML Kit)    │  │
│  │  - Rule Classifier (Multi-tier)    - Offline Sync Queue Dispatcher    │  │
│  │  - Background Detection Service    - Local Notification Engine        │  │
│  └─────────────────────────────────────────┬─────────────────────────────┘  │
└────────────────────────────────────────────┼────────────────────────────────┘
                                             │ HTTP/REST (JWT Bearer)
                                             │ JSON Text & Metadata Only
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
└───────────────────────────────────────┼─────────────────────────────────────┘
                                        │ SQLAlchemy / pyodbc
┌───────────────────────────────────────▼─────────────────────────────────────┐
│                    DATABASE (Microsoft SQL Server 2022+)                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Repository Structure

```text
ContextVault/
├── .github/
│   └── workflows/
│       └── mobile-apk.yml     # Automated React Native APK CI/CD pipeline
├── backend/                    # FastAPI backend with SQLAlchemy & Alembic
│   ├── app/                    # APIs, models, schemas, and classification services
│   ├── alembic/                # Database migrations
│   └── Dockerfile              # Docker container definition
├── frontend/                   # React Native mobile application
│   ├── android/                # Native Android Gradle project
│   ├── src/                    # Screens, navigation, store, services, components
│   ├── package.json            # NPM dependencies & scripts
│   └── metro.config.js         # Metro bundler configuration
├── database/                   # Database scripts and schemas
├── docs/                       # Migration reports and documentation
└── README.md                   # Project documentation & release download
```

---

## CI/CD Pipeline & GitHub Releases

The mobile deployment pipeline is automated using GitHub Actions in [`.github/workflows/mobile-apk.yml`](.github/workflows/mobile-apk.yml).

### How It Works

1. **Trigger**:
   - Triggers on every `push` to the `main` branch when changes occur in `frontend/**`.
   - Can also be manually triggered on demand via the GitHub Actions **Run workflow** button (`workflow_dispatch`).
2. **Build**:
   - Spawns an `ubuntu-latest` runner.
   - Configures Node.js 20 and Java 17 (Temurin) with automated dependency and Gradle caching.
   - Runs `npm ci` and `./gradlew assembleDebug`.
3. **Artifact Archive**:
   - Renames output APK to `ContextVault.apk`.
   - Uploads `ContextVault.apk` to GitHub Actions Workflow Artifacts under name `ContextVault-APK` with a **30-day retention period**.
4. **Rolling GitHub Release**:
   - Fast-forwards the Git tag `latest` to the current commit SHA.
   - Creates or updates the rolling GitHub Release tagged `latest` named **`Latest APK`**.
   - Replaces the `ContextVault.apk` asset in place (`--clobber`), keeping the permanent download URL active without creating duplicate releases.

### Required Repository Settings

To allow the CI/CD pipeline to push tags and update releases, ensure workflow write permissions are granted:

1. In your GitHub repository, navigate to **Settings** > **Actions** > **General**.
2. Scroll to **Workflow permissions**.
3. Select **Read and write permissions**.
4. Check **Allow GitHub Actions to create and approve pull requests**.
5. Click **Save**.

The workflow explicitly declares:
```yaml
permissions:
  contents: write
```
This grants the runner's `GITHUB_TOKEN` the permissions necessary to manage releases and push the `latest` tag.

---

## Local Development Setup

### Mobile Client (`frontend`)

```bash
cd frontend

# Install dependencies
npm install

# Run Metro bundler
npm start

# Run on Android device or emulator
npm run android

# Manually build debug APK locally
cd android
./gradlew assembleDebug
# Generated APK: frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

### Backend API (`backend`)

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install requirements
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start FastAPI server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## Production Release & Documentation

### Version 1.0.0 Release Commands

```bash
# Frontend production validation & typecheck
cd frontend
npm run typecheck
npm test

# Build signed Android Release APK (minified via R8, resource shrunk)
cd android
./gradlew assembleRelease
# Output: frontend/android/app/build/outputs/apk/release/app-release.apk

# Build signed Android App Bundle (.aab) for Google Play Console
./gradlew bundleRelease
# Output: frontend/android/app/build/outputs/bundle/release/app-release.aab
```

### Technical Documentation Library

- 📘 **[Architecture & Data Flow](docs/Architecture.md)** — Architectural blueprint, Scoped Storage dual-path resolution, on-device ML Kit OCR bridge.
- 🌐 **[REST API Reference](docs/API.md)** — Complete API contracts, JWT authentication lifecycle, uniform envelopes.
- 🗄️ **[SQLite Schema v5](docs/SQLite_Schema.md)** — Offline-first local database schema, tables, foreign keys, indexing strategy.
- 📡 **[Backend API Endpoints](docs/Backend_API_EndPoints.md)** — Complete endpoint catalog with sample request & response bodies.
- ✅ **[Release Checklist](docs/Release_Checklist.md)** — Production deployment criteria, quality gates, signing security.
- 🧠 **[Architectural Blueprint (Brain.md)](Brain.md)** — Central source of truth for ContextVault system design.
