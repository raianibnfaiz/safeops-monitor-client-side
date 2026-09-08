import { apiClient } from './client';
import type { Worker, Device, WorkersResponse, WorkerFilters, WorkerActivity, DashboardStats } from '@/types';

// ---------------------------------------------------------------------------
// Map any backend status string → our WorkerStatus union.
// Backend may use "online" / "connected" / "active" / "idle" / "disconnected" etc.
// ---------------------------------------------------------------------------
function normaliseWorkerStatus(raw: unknown): Worker['status'] {
  const s = String(raw ?? '').toLowerCase().trim();
  if (s === 'active' || s === 'online' || s === 'connected') return 'active';
  if (s === 'inactive' || s === 'idle' || s === 'away') return 'inactive';
  if (s === 'emergency' || s === 'sos' || s === 'alert') return 'emergency';
  return 'offline'; // default for 'offline', 'disconnected', '', unknown
}

// ---------------------------------------------------------------------------
// Normalise a single worker — handle backend field-name variations and ensure
// `device` is always a well-formed Device object (never undefined/string).
// ---------------------------------------------------------------------------
function normaliseWorker(raw: Record<string, unknown>): Worker {
  // Resolve id: _id (Mongoose) or id
  const id = String(raw._id ?? raw.id ?? '');

  // Device: may be a populated object, a raw ObjectId string, or absent
  let device: Device | undefined;
  const rawDevice = raw.device;

  if (rawDevice && typeof rawDevice === 'object' && !Array.isArray(rawDevice)) {
    const d = rawDevice as Record<string, unknown>;
    device = {
      id:           String(d._id ?? d.id ?? ''),
      deviceId:     String(d.deviceId ?? d.device_id ?? d._id ?? d.id ?? '—'),
      model:        (d.model as string | undefined),
      status:       (d.status as Device['status']) ?? 'offline',
      batteryLevel: Number(d.batteryLevel ?? d.battery ?? d.battery_level ?? 0),
      lastSeen:     String(d.lastSeen ?? d.last_seen ?? d.updatedAt ?? new Date().toISOString()),
      firmwareVersion: (d.firmwareVersion ?? d.firmware_version) as string | undefined,
    };
  } else if (typeof rawDevice === 'string' && rawDevice.length > 0) {
    // Just an ObjectId string — create a stub so the UI doesn't crash
    device = {
      id:           rawDevice,
      deviceId:     rawDevice,
      status:       'offline',
      batteryLevel: 0,
      lastSeen:     new Date().toISOString(),
    };
  }

  // Location: may be a nested object or lat/lng at top level
  let location: Worker['location'];
  const rawLoc = raw.location ?? raw.lastLocation ?? raw.last_location;
  if (rawLoc && typeof rawLoc === 'object' && !Array.isArray(rawLoc)) {
    const l = rawLoc as Record<string, unknown>;
    const lat = Number(l.latitude ?? l.lat);
    const lng = Number(l.longitude ?? l.lng ?? l.lon);
    if (!isNaN(lat) && !isNaN(lng)) {
      location = {
        latitude:  lat,
        longitude: lng,
        address:   (l.address as string | undefined),
        zone:      (l.zone ?? l.area) as string | undefined,
        timestamp: String(l.timestamp ?? l.updatedAt ?? new Date().toISOString()),
      };
    }
  }

  return {
    id,
    workerId:     String(raw.workerId ?? raw.worker_id ?? raw.employeeId ?? id),
    name:         String(raw.name ?? raw.fullName ?? raw.full_name ?? 'Unknown'),
    email:        (raw.email as string | undefined),
    phone:        (raw.phone ?? raw.phoneNumber) as string | undefined,
    department:   (raw.department as string | undefined),
    role:         (raw.role as string | undefined),
    status:       normaliseWorkerStatus(raw.status),
    device,
    deviceId:     (raw.deviceId ?? raw.device_id) as string | undefined,
    location,
    lastActivity: String(raw.lastActivity ?? raw.last_activity ?? raw.updatedAt ?? raw.lastSeen ?? new Date().toISOString()),
    joinedAt:     String(raw.joinedAt ?? raw.joined_at ?? raw.createdAt ?? new Date().toISOString()),
    avatar:       (raw.avatar as string | undefined),
  };
}

// ---------------------------------------------------------------------------
// Response normaliser — handles multiple common Express/Mongoose shapes:
//   { workers: [...], total, page }
//   { data: [...], total, page }
//   { data: { workers: [...], total } }
//   [...array directly...]
// ---------------------------------------------------------------------------
function normaliseWorkersResponse(raw: unknown): WorkersResponse {
  if (Array.isArray(raw)) {
    return { workers: raw as Worker[], total: (raw as Worker[]).length, page: 1, pageSize: (raw as Worker[]).length };
  }
  const r = raw as Record<string, unknown>;

  // Nested under a "data" key that itself is an object
  if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
    return normaliseWorkersResponse(r.data);
  }

  const rawWorkers: Record<string, unknown>[] = (
    (r.workers as Record<string, unknown>[] | undefined) ??
    (r.data as Record<string, unknown>[] | undefined) ??
    (r.results as Record<string, unknown>[] | undefined) ??
    []
  );

  const workers = rawWorkers.map(normaliseWorker);

  const total =
    (r.total as number | undefined) ??
    (r.count as number | undefined) ??
    (r.totalCount as number | undefined) ??
    workers.length;

  const page = (r.page as number | undefined) ?? 1;
  const pageSize = (r.limit as number | undefined) ?? (r.pageSize as number | undefined) ?? workers.length;

  return { workers, total, page, pageSize };
}

export const workersApi = {
  getWorkers: async (filters?: WorkerFilters): Promise<WorkersResponse> => {
    const { data } = await apiClient.get('/workers', { params: filters });
    return normaliseWorkersResponse(data);
  },

  getWorker: async (id: string): Promise<Worker> => {
    const { data } = await apiClient.get(`/workers/${id}`);
    const r = data as Record<string, unknown>;
    // Unwrap { data: {...} } wrapper if present
    const raw = (r.data && typeof r.data === 'object' && !Array.isArray(r.data))
      ? r.data as Record<string, unknown>
      : r;
    return normaliseWorker(raw);
  },

  getWorkerActivity: async (id: string, limit = 20): Promise<WorkerActivity[]> => {
    try {
      const { data } = await apiClient.get(`/workers/${id}/activity`, { params: { limit } });
      if (Array.isArray(data)) return data as WorkerActivity[];
      const r = data as Record<string, unknown>;
      return (r.data ?? r.activities ?? r.events ?? []) as WorkerActivity[];
    } catch {
      // Endpoint may not exist on all backend versions — return empty gracefully
      return [];
    }
  },

  // -------------------------------------------------------------------
  // Dashboard stats: backend exposes GET /api/dashboard
  // The backend returns systemHealth as an object:
  //   { database: "connected", simulator: true, clientsConnected: 1, uptimeSeconds: 3600 }
  // We normalise it to a string union for the UI.
  // -------------------------------------------------------------------
  getDashboardStats: async (): Promise<DashboardStats> => {
    const { data } = await apiClient.get('/dashboard');
    // Unwrap { data: {...} } or { stats: {...} } if present
    const raw = (
      (data as Record<string, unknown>).data ??
      (data as Record<string, unknown>).stats ??
      data
    ) as Record<string, unknown>;

    // Normalise systemHealth: object → string
    const healthRaw = raw.systemHealth;
    let systemHealth: DashboardStats['systemHealth'] = 'healthy';

    if (typeof healthRaw === 'string') {
      // Already a string — cast to our union (default to 'healthy' if unknown)
      systemHealth = (['healthy', 'degraded', 'critical'].includes(healthRaw)
        ? healthRaw
        : 'healthy') as DashboardStats['systemHealth'];
    } else if (healthRaw && typeof healthRaw === 'object') {
      const h = healthRaw as Record<string, unknown>;
      const dbOk = String(h.database ?? '').toLowerCase().includes('connect');
      systemHealth = dbOk ? 'healthy' : 'critical';
    }

    return {
      totalWorkers:      (raw.totalWorkers      as number) ?? 0,
      activeWorkers:     (raw.activeWorkers      as number) ?? 0,
      offlineWorkers:    (raw.offlineWorkers     as number) ?? 0,
      onlineDevices:     (raw.onlineDevices      as number) ?? 0,
      offlineDevices:    (raw.offlineDevices     as number) ?? 0,
      openIncidents:     (raw.openIncidents      as number) ?? 0,
      criticalIncidents: (raw.criticalIncidents  as number) ?? 0,
      resolvedToday:     (raw.resolvedToday      as number) ?? 0,
      systemHealth,
      systemHealthRaw:   typeof healthRaw === 'object' && healthRaw !== null
        ? healthRaw as import('@/types').SystemHealthRaw
        : undefined,
      lastUpdated:       (raw.lastUpdated as string) ?? new Date().toISOString(),
    };
  },
};
