# ContextVault v1.0.0 — Release Notes (Hackathon Edition)

**ContextVault**: Automatic Screenshot Intelligence for Android  
*Turn your messy photo gallery into a searchable, conversational second brain.*

---

## Executive Summary

Smartphones capture countless screenshots daily: UPI payment receipts, flight boarding passes, coding errors, chat receipts, and study notes. Finding or recalling this information is frustrating and time-consuming.

**ContextVault** solves this by automatically detecting every screenshot as you take it, performing local on-device OCR using Google ML Kit, filing it into dynamic Smart Folders, generating living knowledge contexts, and empowering you to **chat with your screenshots** and perform **Global AI Search** across your entire visual knowledge base.

---

## Key Highlights & Innovations

### 1. Zero Manual Friction (Background MediaStore Detection)
- No manual imports or sync buttons.
- Android `MediaStore` ContentObserver detects newly captured screenshots instantly in the background.
- Built-in deduplication prevents redundant processing.

### 2. Strict Privacy & Non-Destructive Intelligence Guarantee
- **Zero Binary Upload**: Original screenshot photos remain strictly in your device's camera roll/gallery.
- Images are processed locally on-device using Google ML Kit OCR.
- Only anonymized text tokens, dimensions, and layout blocks are synced with AI classification models.

### 3. Dynamic Smart Folders & Living Contexts
- Automatically creates and files into categories:
  - **Finance**: UPI transactions (GPay, PhonePe, Paytm), tax invoices (Amazon, Flipkart), bank alerts.
  - **Travel**: Flight boarding passes (IndiGo, Air India), hotel reservations (MakeMyTrip, Booking.com).
  - **Development**: Code snippets, terminal logs, stack traces.
  - **Shopping, Work, Health, Entertainment, and Personal**.
- Summarizes folders into "Living Contexts" with extracted entity graphs (amounts, dates, merchants, booking IDs).

### 4. Context AI Chat ("Chat with your Folders")
- Ask questions directly inside any folder:
  - *"How much did I spend at Starbucks this week?"*
  - *"What is my flight seat to Bangalore?"*
- AI assistant responds with exact figures and interactive, clickable screenshot citations.

### 5. Ask ContextVault — Global AI Search
- Search across your entire screenshot knowledge base.
- Synthesizes an **AI Answer Card** with key extracted entities and suggested follow-ups.
- Voice search modal with animated audio waveforms.
- Multi-criteria filter bar (Folders, Dates, App Sources, Favorites, Needs Review).

### 6. Demo Mode (100% Offline Hackathon Demo Ready)
- Built-in hidden demo toggle in Settings and QA Debug Panel.
- Preloads 12 realistic sample screenshots across Finance, Travel, Dev, Shopping, and Health.
- Populates living folder contexts, chat histories, and search examples completely offline without backend dependencies.

### 7. Local Backup & Restore
- 1-tap full JSON export of SQLite database, OCR cache, living contexts, chat messages, and settings.
- Restore backup on any device.

---

## Technical Specifications

| Parameter | Specification |
| :--- | :--- |
| **Framework** | React Native 0.73.6 (TypeScript) |
| **JS Engine** | Hermes Bytecode Engine |
| **Local Database** | SQLite (`react-native-sqlite-storage`) |
| **Local Storage** | MMKV + AsyncStorage |
| **State Management**| Zustand |
| **OCR Engine** | Google ML Kit On-Device Text Recognition |
| **Min Android SDK** | API 24 (Android 7.0) |
| **Target Android SDK** | API 34 (Android 14) |
| **Application ID** | `com.contextvault.app` |
| **Version** | 1.0.0 (Build 1) |

---

## Getting Started

1. Clone repository and switch to `frontend-dev` branch:
   ```bash
   git checkout frontend-dev
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run on Android emulator or connected physical device:
   ```bash
   npm run android
   ```
4. To test Demo Mode offline:
   - Navigate to **Settings** → toggle **Hackathon Demo Mode** ON.
   - Or open **QA Debug Panel** (tap Version 5 times in Settings) → click **Load Offline Demo Dataset**.
