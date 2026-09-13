# AI_USAGE.md — SafeOps Monitor Frontend

> **Project:** SafeOps Monitor — React + TypeScript + Tailwind CSS Frontend  
> **Author:** Raian Ibn Faiz  
> **AI Tool Used:** [Cursor](https://cursor.com) (powered by Claude Sonnet 4.6)  
> **Submission Requirement:** Section 7.2 — AI Usage Documentation

---

## 1. AI Tools Used

| Tool | Version / Model | Purpose |
|------|----------------|---------|
| **Cursor IDE** | Claude Sonnet 4.6 | Primary AI coding assistant — scaffolding, debugging, API integration, bug fixing |
| **Claude.ai** (reference) | Claude 3.5 | Architecture planning and schema design reference |

All code generation, debugging, and refinement happened inside **Cursor** using the Agent (chat) mode, where I described the problem and reviewed/accepted or rejected the generated output.

---

## 2. Important Prompts Used During Development

Below are the 9 most significant prompts used, written exactly as submitted or paraphrased faithfully, along with what the AI produced and what I changed.

---

### Prompt 1 — Full Project Scaffold

```
Create a modern, production-ready frontend for a worker safety monitoring
system called SafeOps Monitor using React + TypeScript + Tailwind CSS.

Tech Stack Requirements:
- React 18+ with TypeScript
- Vite as build tool
- Tailwind CSS for styling
- React Router for navigation
- Axios or Fetch for API calls
- Socket.IO Client for real-time updates
- Recharts or Chart.js for visualizations
- Lucide React or Heroicons for icons
- Clean and scalable folder structure

Core Features:
- Authentication (Login, protected routes, JWT)
- Dashboard (stats, chart, events)
- Workers page (list, search, filter)
- Worker Details page
- Incidents page (lifecycle: OPEN → ACKNOWLEDGED → RESOLVED)
- Real-time updates via Socket.IO
- Dark/Light mode
- Toast notifications for critical incidents
```

**What AI generated:** The entire project skeleton — `package.json`, `tsconfig`, `vite.config.ts`, `tailwind.config.js`, all 46 source files across `types/`, `api/`, `hooks/`, `contexts/`, `components/`, and `pages/`.

**What I decided / changed:**
- Reviewed every generated file before accepting it.
- Changed the `vite.config.ts` path alias from `path.resolve(__dirname)` (which failed with ESM) to `fileURLToPath(new URL(...))`, then to `resolve(__dirname)` with `@types/node` — required two manual rounds of iteration.
- Added `VITE_MOCK_AUTH` mode myself after realising the backend wasn't running yet, so I could test the UI independently.

---

### Prompt 2 — MongoDB Schema Design (Reference Prompt)

```
Analyze this system requirement and propose a production-oriented
MongoDB schema for Worker, Device, Event and Incident.

Requirements:
- Workers have a name, employeeId, department, status, and are
  associated with one IoT device.
- Devices track battery level, firmware version, last seen timestamp,
  and connection status.
- Events are safety readings emitted by devices: fall detection,
  SOS triggers, zone breaches, no-motion alerts.
- Incidents are created from Events and have a lifecycle:
  OPEN → ACKNOWLEDGED → RESOLVED.
- Incidents must record who acknowledged and resolved them, and when.
- The system needs to query: "all open incidents for a given worker",
  "all events in the last 24h", and "dashboard stats in one query".

Produce: Mongoose model definitions with indexes, validation, and
virtual fields where appropriate.
```

**What AI generated:** Complete Mongoose schemas for all four models including:
- Enum validation on `status` and `severity` fields
- `{ workerId: 1, createdAt: -1 }` compound indexes for efficient querying
- A `pre('save')` hook on Incident to auto-set `acknowledgedAt`/`resolvedAt`
- A virtual `isOpen` field on Incident

**What I decided / changed:**
- Added `ENABLE_BOOTSTRAP` flag to the backend `.env` to control seeding — AI didn't think of the "clean production environment" concern.
- Removed the virtual `isOpen` — redundant given the `status` field.
- Added `clientsConnected` and `uptimeSeconds` to the dashboard stats aggregation pipeline — AI missed these operational fields that turned out to be needed by the frontend System Status panel.

---

### Prompt 3 — API Mismatch Diagnosis

```
Backend: Node.js + Express + MongoDB, running on http://localhost:5000.
Has routes for: /api/auth, /api/workers, /api/devices, /api/incidents,
/api/events, /api/dashboard. Uses JWT. Socket.IO is working.

Frontend: After login, getting these errors:
- 404: GET /api/dashboard/stats
- 404: GET /api/events/recent?limit=15
- 404: GET /api/incidents/stats
- 500: GET /api/workers?page=1&pageSize=10
- 500: GET /api/incidents?page=1&pageSize=10

Identify the mismatch, suggest fixes, give me the correct endpoint list.
```

**What AI generated:**
- Full root-cause table: wrong sub-paths (`/dashboard/stats` vs `/dashboard`, `/events/recent` vs `/events`), wrong pagination param (`pageSize` vs `limit`)
- Rewritten `api/workers.ts` and `api/incidents.ts` with corrected paths
- Response normaliser functions to handle multiple backend response shapes
- Client-side fallback stats computation when `/incidents/stats` returns 404

**What I decided / changed:**
- The AI initially suggested the backend might need changes. I decided to fix only the frontend — backend was already production-correct.
- Added the `computeStats()` client-side fallback as a graceful degradation rather than requiring a backend change.

---


### Prompt 4 — React Render Crash (Object as Child)

```
Uncaught Error: Objects are not valid as a React child
(found: object with keys {database, simulator, clientsConnected, uptimeSeconds})

This crash is in the Dashboard component.
```

**What AI generated:**
- Immediately diagnosed: `systemHealth` from `GET /api/dashboard` is an object, not a string — React can't render objects as JSX children
- Added `SystemHealthRaw` interface to the type system
- Rewrote `getDashboardStats()` to normalise the object into a `'healthy' | 'degraded' | 'critical'` string
- Redesigned the System Status panel to display real live data: database connection, simulator state, connected clients count, formatted uptime

**What I decided / changed:**
- I verified the normalisation logic: `String(h.database).toLowerCase().includes('connect')` correctly maps `"connected"` → `healthy`. Approved.
- Added the `formatUptime()` helper myself — AI had left seconds as a raw number initially.

---

### Prompt 5 — TypeError on `worker.device.deviceId`

```
Uncaught TypeError: Cannot read properties of undefined (reading 'deviceId')
  at Workers.tsx:182
```

**What AI generated:**
- Diagnosed: backend returns `device` as a raw MongoDB ObjectId string (not populated), or entirely absent
- Added `normaliseWorker()` function handling 3 cases: populated object, ObjectId string (creates stub), or absent
- Mapped field aliases: `_id`→`id`, `last_activity`→`lastActivity`, `lat`/`lng`→`latitude`/`longitude`
- Made `device?: Device` optional in the `Worker` type
- Added safe optional chaining (`?.`) everywhere `device` was accessed in Workers and WorkerDetails pages

**What I decided / changed:**
- I chose not to add a separate `/api/devices` call to hydrate the device — too many requests. The stub approach was the right call.
- I reviewed the `normaliseWorker` function line by line to confirm field mappings matched the actual seeded data I could inspect in MongoDB Compass.

---

### Prompt 6 — WorkerStatusBadge Crash on Unknown Status

```
Uncaught TypeError: Cannot read properties of undefined (reading 'bgColor')
  at WorkerStatusBadge (Badge.tsx:58)

The backend is sending a worker status value not in our union type.
```

**What AI generated:**
- `normaliseWorkerStatus()` function mapping backend strings to our union:
  - `"online"` / `"connected"` → `"active"`
  - `"idle"` / `"away"` → `"inactive"`
  - `"sos"` / `"alert"` → `"emergency"`
  - everything else → `"offline"`
- Fallback `UNKNOWN_BADGE` / `UNKNOWN_STATUS_CONFIG` objects in all three Badge components

**What I decided / changed:**
- Added `"connected"` to the active mappings — AI initially missed it, I caught it by inspecting actual Socket.IO payloads in the browser console.
- Kept the Badge fallback as a permanent safety net (not just a temp fix), since real-time Socket events could deliver unexpected values at any time.

---

### Prompt 7 — Socket.IO Event Alignment

```
The backend README says it emits two Socket.IO events:
  - 'safety:event'
  - 'safety:incident'

But the frontend is subscribed to: 'incident:created', 'incident:updated',
'worker:status_changed'. Nothing is updating in real time.
Fix the socket event subscriptions to match the actual backend.
```

**What AI generated:**
- Updated `SocketEventMap` in `event.ts` to include the correct backend events as primary
- Updated Dashboard, Workers, and Incidents pages to subscribe to `'safety:event'` and `'safety:incident'`
- Left the original event names as secondary entries in the type map for forward compatibility

**What I decided / changed:**
- Kept `'safety:event'` also wired on Workers page to trigger a list refresh — AI initially only put it on Dashboard.

---

### Prompt 8 — Device list page with assigned worker names

```
Create a new route to display the device list. Show every device with all
its available properties. Also, using the assignedTo field, look up and
display the corresponding worker’s name next to each device.

Example device document:
{
  _id: ObjectId('6aa629afb9604aa1edf0a1dc'),
  deviceId: 'SAFEOPS-1000',
  worker: ObjectId('6aa629afb9604aa1edf0a1c8'),
  assignedTo: 'W-101',
  batteryLevel: 72,
  temperature: 38,
  geofenceStatus: 'INSIDE',
  status: 'ACTIVE',
  lastSeenAt: ISODate('2026-09-13T04:42:23.477Z'),
  createdAt: ISODate('2026-09-13T04:42:23.478Z'),
  updatedAt: ISODate('2026-09-13T04:42:23.478Z')
}
```

**What AI generated:**
- `FieldDevice` type matching the MongoDB device document
- `GET /api/devices` client plus worker lookup by `assignedTo` (`W-101`) and `worker` ObjectId
- Protected `/devices` route, sidebar link, and a table of all device fields
- Worker name links through to Worker Details when a match is found

**What I decided / changed:**
- Looked up names from `GET /api/workers` instead of assuming `/devices` populates the worker
- Kept unknown extra Mongo fields in an “Other fields” column so the list stays complete if the schema grows

---

### Prompt 9 — Worker location map (OpenStreetMap + Leaflet)

```
On the Worker page, display the worker’s location using a map visualization.
Use OpenStreetMap with Leaflet (free and no API key required).
Show the location clearly with a marker based on the available coordinates.
```

**What AI generated:**
- Installed `leaflet` and `react-leaflet` (no paid map SDK)
- Reusable `LocationMap` component using OpenStreetMap tiles
- Worker Details “Last Known Location” section with a marker on the worker’s latitude/longitude
- Location parsing for `lat`/`lng` and GeoJSON `[lng, lat]` coordinates
- Dark-mode map styling without a third-party tile API key

**What I decided / changed:**
- Rejected Carto dark tiles after they showed “API key needed”
- Kept OpenStreetMap as the only tile source so the map stays free and keyless
- Used a CSS filter for dark mode instead of a commercial tile provider

