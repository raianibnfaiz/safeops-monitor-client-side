# SafeOps Monitor — Frontend

A modern, production-ready frontend for a **worker safety monitoring system** built with React 18, TypeScript, Vite, and Tailwind CSS.

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

- **Authentication** — JWT login/logout, protected routes, token auto-refresh
- **Dashboard** — Live stats, incident charts (bar + pie), recent safety events feed, system health
- **Workers Page** — Searchable, filterable table with status, battery, location, pagination
- **Worker Details** — Profile, device status, location visualization, activity feed, incident history
- **Incidents Page** — Filterable list by severity/status/type, expandable details, Acknowledge & Resolve lifecycle
- **Real-time** — Socket.IO auto-updates on all pages + toast notifications for critical alerts
- **Dark / Light mode** — System preference detection + manual toggle
- **Responsive** — Works on mobile and desktop

---

## Project Structure

```
src/
├── api/                  # Axios API service layer
│   ├── client.ts         # Axios instance + interceptors
│   ├── auth.ts           # Authentication endpoints
│   ├── workers.ts        # Worker endpoints
│   └── incidents.ts      # Incident endpoints
├── socket/
│   └── socketClient.ts   # Typed Socket.IO service singleton
├── types/                # TypeScript interfaces
│   ├── auth.ts
│   ├── worker.ts
│   ├── incident.ts
│   └── event.ts
├── contexts/             # React contexts
│   ├── AuthContext.tsx
│   ├── SocketContext.tsx
│   ├── ThemeContext.tsx
│   └── ToastContext.tsx
├── hooks/                # Custom hooks
│   ├── useSocket.ts      # Socket.IO event subscription
│   ├── useWorkers.ts
│   ├── useIncidents.ts
│   └── useDashboard.ts
├── components/
│   ├── common/           # Reusable UI components
│   ├── layout/           # Sidebar, Header, Layout, ProtectedRoute
│   └── dashboard/        # Dashboard-specific components
├── pages/
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── Workers.tsx
│   ├── WorkerDetails.tsx
│   └── Incidents.tsx
└── utils/
    ├── formatters.ts     # Date/number formatters
    └── constants.ts      # Severity/status config, colors
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

Edit `.env` to point to your backend:

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

### 3. Start development server

```bash
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000)

### 4. Production build

```bash
npm run build
```

---

## Backend API Contract

The app expects these REST endpoints:

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/workers` | List workers (paginated, filtered) |
| GET | `/api/workers/:id` | Single worker |
| GET | `/api/workers/:id/activity` | Worker activity feed |
| GET | `/api/dashboard/stats` | Dashboard stats |
| GET | `/api/incidents` | List incidents (paginated, filtered) |
| GET | `/api/incidents/stats` | Incident statistics |
| PATCH | `/api/incidents/:id/acknowledge` | Acknowledge |
| PATCH | `/api/incidents/:id/resolve` | Resolve |
| GET | `/api/events/recent` | Recent safety events |

## Socket.IO Events

| Event | Direction | Payload |
|---|---|---|
| `incident:created` | server → client | `{ incident }` |
| `incident:updated` | server → client | `{ incident }` |
| `worker:status_changed` | server → client | `{ workerId, status }` |
| `worker:location_updated` | server → client | `{ workerId, location }` |
| `safety:event` | server → client | `SafetyEvent` |
| `stats:updated` | server → client | `DashboardStats` |
| `device:status_changed` | server → client | `{ deviceId, status, batteryLevel }` |
