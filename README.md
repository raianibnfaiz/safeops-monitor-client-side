# SafeOps Monitor — Frontend

A modern, production-ready frontend for a **worker safety monitoring system**  
built with React 18, TypeScript, Vite, and Tailwind CSS.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build Tool | Vite 5 |
| Styling | Tailwind CSS v3 (dark mode support) |
| Routing | React Router v6 |
| HTTP Client | Axios |
| Real-time | Socket.IO Client |
| Charts | Recharts |
| Icons | Lucide React |

---

## Features

- **Authentication** — JWT login/logout, protected routes, automatic session restore
- **Dashboard** — Live stat cards, incident charts (bar + pie), safety events feed, system health panel
- **Workers Page** — Searchable, filterable table with status badges, battery level, pagination
- **Worker Details** — Profile card, device info, location visualisation, activity feed, incident history
- **Incidents Page** — Multi-filter list, expandable rows, full lifecycle actions (Acknowledge → Resolve)
- **Real-time** — Socket.IO auto-refreshes all pages; toast alerts for Critical/High severity events
- **Dark / Light mode** — Follows system preference; toggle available in the header
- **Fully responsive** — Works on mobile and desktop

---

## Authentication

The app uses **JWT (JSON Web Token)** based authentication.  
The backend issues a **7-day token** on successful login.

### How it works — step by step

#### 0. Register (first-time setup)
- Open the app — you will land on the `/login` page.
- Click the **Register** tab (next to Sign In).
- Fill in three fields:
  - **Full name** — your display name inside the app
  - **Email address** — used as your login identity
  - **Password** — minimum 6 characters
- Click **Create account & sign in**.
- Frontend sends `POST /api/auth/register` with `{ name, email, password }` to the backend.
- Backend hashes the password with bcrypt, creates the user, signs a 7-day JWT, and returns:
  ```json
  { "success": true, "token": "eyJ...", "user": { "id", "name", "email", "role" } }
  ```
- Frontend stores the token and user profile in `localStorage`, then redirects to `/dashboard` — **no second login step needed**.
- From this point forward, use the **Sign In** tab with your email and password.

> **Note:** The `role` field defaults to `viewer` on new registrations.  
> An admin can update roles directly in the database if needed.

---

#### 1. Login
- User submits email + password on the `/login` page.
- Frontend sends `POST /api/auth/login` to the backend.
- Backend validates credentials (bcrypt password check), signs a JWT with the configured `JWT_SECRET`, and returns:
  ```json
  { "success": true, "token": "eyJ...", "user": { "id", "name", "email", "role" } }
  ```
- Frontend stores the token and user profile in `localStorage`:
  - `safeops_token` — the JWT string
  - `safeops_user`  — the user profile (JSON)
- User is redirected to `/dashboard`.

#### 2. Authenticated API calls
- Every outgoing Axios request automatically includes the JWT in the header:
  ```
  Authorization: Bearer eyJ...
  ```
- The backend validates the JWT on every protected route.
- If the token is missing or invalid, the backend returns `401 Unauthorized`.

#### 3. Session restore on page refresh
- When the app loads, `AuthContext` reads the saved token from `localStorage`.
- The token's **expiry is checked locally** (by decoding the JWT payload) — no extra network call.
- If the token is still valid, the cached user profile is restored and the user lands directly on the last page.
- If the token is expired or missing, the user is redirected to `/login`.

#### 4. Route protection
- Every page except `/login` is wrapped in a `<ProtectedRoute>` component.
- `ProtectedRoute` checks `isAuthenticated` from `AuthContext`.
- Unauthenticated users are redirected to `/login`, with the original URL saved so they are sent back after logging in.

#### 5. Automatic expiry logout
- When a valid session is restored, a timer is set to fire **15 seconds before the token expires**.
- On expiry, `localStorage` is cleared and the user is silently redirected to `/login`.
- This means sessions always end cleanly — no stale token errors.

#### 6. Logout
- User clicks **Logout** in the sidebar.
- Frontend calls `POST /api/auth/logout` (backend can blacklist the token server-side).
- Regardless of the backend response, `localStorage` is always cleared.
- The expiry timer is cancelled.
- User is redirected to `/login`.

### Key files

| File | Role |
|---|---|
| `src/api/client.ts` | Axios instance — attaches `Authorization: Bearer` header on every request; clears session on `401` |
| `src/api/auth.ts` | `register()`, `login()`, `getCurrentUser()`, `logout()` — all auth API calls |
| `src/utils/jwt.ts` | `decodeJwtPayload()`, `isTokenExpired()`, `secondsUntilTokenExpiry()` — local JWT helpers |
| `src/contexts/AuthContext.tsx` | Global auth state, session restore on mount, automatic expiry timer |
| `src/components/layout/ProtectedRoute.tsx` | Route guard — redirects unauthenticated users to `/login` |
| `src/pages/Login.tsx` | Sign In + Register tabs — shows real server error messages from the backend |
| `src/types/auth.ts` | `LoginCredentials`, `RegisterCredentials`, `AuthUser`, `AuthResponse` interfaces |

### Storage keys

| Key | Stored value |
|---|---|
| `safeops_token` | The JWT string (`eyJ...`) |
| `safeops_user`  | User profile JSON `{ id, name, email, role }` |

> **Security note:** `localStorage` is used for simplicity and compatibility.  
> For higher security requirements, consider switching to `httpOnly` cookies (requires backend support).

---

## Project Structure

```
src/
├── api/
│   ├── client.ts         # Axios instance + JWT request/response interceptors
│   ├── auth.ts           # register, login, getCurrentUser, logout
│   ├── workers.ts        # Worker + dashboard API calls
│   └── incidents.ts      # Incident + events API calls
├── socket/
│   └── socketClient.ts   # Typed Socket.IO singleton
├── types/                # TypeScript interfaces
│   ├── auth.ts           # AuthUser, LoginCredentials, AuthResponse
│   ├── worker.ts         # Worker, Device, Location, WorkerFilters
│   ├── incident.ts       # Incident, IncidentStats, IncidentFilters
│   └── event.ts          # SafetyEvent, DashboardStats, SocketEventMap
├── utils/
│   ├── jwt.ts            # JWT decode + expiry helpers
│   ├── formatters.ts     # Date, time, coordinate formatters
│   └── constants.ts      # Severity/status colour config
├── contexts/
│   ├── AuthContext.tsx   # Authentication state + actions
│   ├── SocketContext.tsx # Socket.IO connection lifecycle
│   ├── ThemeContext.tsx  # Dark/light mode
│   └── ToastContext.tsx  # Global toast notifications
├── hooks/
│   ├── useSocket.ts      # Subscribe to typed Socket.IO events
│   ├── useWorkers.ts     # Fetch + cache workers list / single worker
│   ├── useIncidents.ts   # Fetch + cache incidents + stats
│   └── useDashboard.ts  # Fetch dashboard stats + recent events
├── components/
│   ├── common/           # Badge, Card, BatteryIndicator, Toast, EmptyState…
│   ├── layout/           # Sidebar, Header, Layout, ProtectedRoute
│   └── dashboard/        # StatCard, IncidentChart, RecentEvents
└── pages/
    ├── Login.tsx
    ├── Dashboard.tsx
    ├── Workers.tsx
    ├── WorkerDetails.tsx
    └── Incidents.tsx
```

---

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```

Edit `.env`:
```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_MOCK_AUTH=false          # set true to test the UI without a backend
```

### 3. Start the backend
Follow the instructions in [safeops-monitor-server-side](https://github.com/raianibnfaiz/safeops-monitor-server-side) to run the backend on `http://localhost:5000`.

### 4. Start the frontend dev server
```bash
npm run dev
```

### 5. Production build
```bash
npm run build
```

---

## Backend API Contract

All endpoints are prefixed with `/api`.

### Auth

| Method | Path | Auth required | Description |
|---|---|---|---|
| `POST` | `/auth/register` | No | Create a new account |
| `POST` | `/auth/login` | No | Login — returns a 7-day JWT |
| `POST` | `/auth/logout` | Yes | Invalidate token server-side |

### Workers

| Method | Path | Auth required | Description |
|---|---|---|---|
| `GET` | `/workers` | Yes | List workers (`?page&limit&status&search`) |
| `GET` | `/workers/:id` | Yes | Single worker profile |

### Devices

| Method | Path | Auth required | Description |
|---|---|---|---|
| `GET` | `/devices` | Yes | List all devices |
| `GET` | `/devices/:id` | Yes | Single device |

### Incidents

| Method | Path | Auth required | Description |
|---|---|---|---|
| `GET` | `/incidents` | Yes | List incidents (`?page&limit&status&severity`) |
| `POST` | `/incidents/:id/acknowledge` | Yes | Move `OPEN → ACKNOWLEDGED` |
| `POST` | `/incidents/:id/resolve` | Yes | Move `ACKNOWLEDGED → RESOLVED` |

### Events

| Method | Path | Auth required | Description |
|---|---|---|---|
| `GET` | `/events` | Yes | Recent safety events (`?limit&page`) |

### Dashboard

| Method | Path | Auth required | Description |
|---|---|---|---|
| `GET` | `/dashboard` | Yes | Live stats + system health object |

---

## Real-Time Events (Socket.IO)

The backend emits these events to all connected clients:

| Event | Payload | When fired |
|---|---|---|
| `safety:event` | `SafetyEvent` | Any sensor reading, worker state change, or zone alert |
| `safety:incident` | `{ incident }` | Incident created, acknowledged, or resolved |

> The frontend subscribes to both events on the Dashboard, Workers, and Incidents pages to auto-refresh data without polling.
