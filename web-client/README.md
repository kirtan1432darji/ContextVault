# ContextVault Standalone Web Client (Production Setup)

A production-ready, standalone **React + Vite + TypeScript** web application consuming the ContextVault FastAPI backend.

This frontend is **100% decoupled** from the backend repository structure and mobile app, allowing independent deployment, scaling, and maintenance.

---

## Tech Stack

- **Framework**: React 18 + Vite 5
- **Language**: TypeScript 5 (Strict Mode)
- **HTTP Client**: Axios 1.7 (with 401 Refresh Mutex & Request/Response Interceptors)
- **Routing**: React Router DOM v6
- **Styling**: Tailwind CSS v3 (Modern Dark Theme)
- **Icons**: Lucide React

---

## Project Structure & File Rationale

```
web-client/
├── .env.example              # Template for environment variables
├── .env                      # Active runtime environment (never hardcodes localhost)
├── vite.config.ts            # Vite bundler configuration + path aliases (@/* -> src/*)
├── tsconfig.json             # Strict TypeScript compiler options
├── tailwind.config.js        # Design system & dark mode configuration
└── src/
    ├── api/                  # Pure API boundary (No React components or hooks here)
    │   ├── axios.ts          # Central Axios instance: Bearer token injection, 30s timeout, 401 refresh queue
    │   ├── authApi.ts        # Pure async API calls for login, register, refresh, logout, profile
    │   ├── vaultApi.ts       # Pure async API calls for screenshots, categories, and AI folder contexts
    │   ├── healthApi.ts      # Pure async API calls for health probes, version info, and latency benchmarks
    │   └── userApi.ts        # User profile and account endpoints
    ├── context/
    │   └── AuthContext.tsx   # Global authentication provider and reactive session state
    ├── hooks/
    │   ├── useAuth.ts        # Hook to consume current user, login, register, and logout actions
    │   ├── useHealth.ts      # Hook for on-demand or periodic Docker health & latency monitoring
    │   ├── useVault.ts       # Hook for fetching screenshots, categories, and query filters
    │   └── useDebounce.ts    # Debounce hook for real-time OCR text search inputs
    ├── components/
    │   ├── common/
    │   │   ├── Navbar.tsx    # Sticky header with Live Health Pill (status + latency in ms)
    │   │   ├── Sidebar.tsx   # Navigation sidebar + Swagger/ReDoc links
    │   │   ├── StatusBadge.tsx # Semantic status pill (Healthy, Degraded, Offline, Pending)
    │   │   ├── ErrorAlert.tsx# Centralized banner displaying normalized errors / Docker offline hints
    │   │   └── LoadingSpinner.tsx # Animated SVG loading indicator
    │   └── layout/
    │       ├── AppLayout.tsx # Main dashboard layout shell
    │       ├── ProtectedRoute.tsx # Route guard redirecting unauthenticated users to /login
    │       └── PublicRoute.tsx    # Route guard redirecting authenticated users to /dashboard
    ├── pages/
    │   ├── LoginPage.tsx     # Sign in form with input validation and session expired banner
    │   ├── RegisterPage.tsx  # User registration form with instant login
    │   ├── HealthCheckPage.tsx # Detailed Docker backend status, latency (ms), database connection, version
    │   ├── DashboardPage.tsx # Overview of screenshots count, match rate, categories, recent ingestions
    │   ├── ScreenshotsPage.tsx # Full screenshot explorer with OCR search, category filter, metadata modal
    │   └── NotFoundPage.tsx  # 404 handler
    ├── routes/
    │   └── AppRoutes.tsx     # Route declarations using React Router DOM v6
    ├── services/
    │   ├── tokenService.ts   # Secure localStorage abstraction for JWT access & refresh tokens
    │   ├── authService.ts    # Orchestrator uniting authApi with token storage
    │   └── errorService.ts   # Normalizes HTTP errors, validation errors, and network down states
    ├── types/                # Strict TypeScript interfaces matching FastAPI schemas
    └── utils/
        ├── constants.ts      # Centralized storage keys, route paths, and default timeouts
        └── formatters.ts     # Formatters for byte sizes, dates, and latency categories
```

---

## Docker & Environment Configuration

The web client is **Docker-aware** and **never hardcodes localhost**. All network requests resolve through `VITE_API_BASE_URL`.

### 1. Connecting to FastAPI inside Docker on an Ubuntu Server
If your FastAPI container is running on an Ubuntu host with IP `192.168.1.100`:
```env
VITE_API_BASE_URL=http://192.168.1.100:8000
```

### 2. Connecting to Local Development Backend
If you are running the backend locally on the same development machine:
```env
VITE_API_BASE_URL=http://localhost:8000
```

### 3. Production Deployment
When deployed to production behind a domain:
```env
VITE_API_BASE_URL=https://api.contextvault.com
```

---

## How to Run Locally

### 1. Install Dependencies
```bash
cd web-client
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` if not already created:
```bash
cp .env.example .env
```
Edit `VITE_API_BASE_URL` with your Ubuntu server IP or local backend address.

### 3. Start Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

---

## Production Build & Standalone Deployment

### Build Production Assets
```bash
npm run build
```
This generates optimized static HTML/CSS/JS in `web-client/dist/`.

### Preview Production Build
```bash
npm run preview
```

### Standalone Deployment (Nginx / Docker / Cloudflare / Vercel)
Because `dist/` is a pure Single Page Application (SPA):
1. **Nginx**: Copy `dist/` to `/var/www/html` and ensure `try_files $uri $uri/ /index.html;` is set.
2. **Vercel / Netlify**: Point root directory to `web-client`, build command `npm run build`, output directory `dist`.
