import { apiClient } from './client';
import type {
  Incident,
  IncidentsResponse,
  IncidentFilters,
  IncidentStats,
  IncidentNote,
  SafetyEvent,
  IncidentSeverity,
} from '@/types';

// ---------------------------------------------------------------------------
// Response normaliser — handles multiple common Express/Mongoose shapes
// ---------------------------------------------------------------------------
function normaliseIncidentsResponse(raw: unknown): IncidentsResponse {
  if (Array.isArray(raw)) {
    return { incidents: raw as Incident[], total: (raw as Incident[]).length, page: 1, pageSize: (raw as Incident[]).length };
  }
  const r = raw as Record<string, unknown>;

  if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
    return normaliseIncidentsResponse(r.data);
  }

  const incidents =
    (r.incidents as Incident[] | undefined) ??
    (r.data as Incident[] | undefined) ??
    (r.results as Incident[] | undefined) ??
    [];

  const total =
    (r.total as number | undefined) ??
    (r.count as number | undefined) ??
    (r.totalCount as number | undefined) ??
    incidents.length;

  const page = (r.page as number | undefined) ?? 1;
  const pageSize = (r.limit as number | undefined) ?? (r.pageSize as number | undefined) ?? incidents.length;

  return { incidents, total, page, pageSize };
}

// ---------------------------------------------------------------------------
// Normalise a raw event document from the backend.
// Handles _id → id, field aliases, and unknown type strings.
// ---------------------------------------------------------------------------
function normaliseEvent(raw: Record<string, unknown>): SafetyEvent {
  // Map backend type strings → our SafetyEventType union
  const rawType = String(raw.type ?? raw.eventType ?? '').toLowerCase();
  const typeMap: Record<string, SafetyEvent['type']> = {
    worker_online: 'worker_online', online: 'worker_online', connected: 'worker_online',
    worker_offline: 'worker_offline', offline: 'worker_offline', disconnected: 'worker_offline',
    incident_created: 'incident_created', incident: 'incident_created',
    incident_updated: 'incident_updated', updated: 'incident_updated',
    incident_resolved: 'incident_resolved', resolved: 'incident_resolved',
    sos_alert: 'sos_alert', sos: 'sos_alert',
    fall_detected: 'fall_detected', fall: 'fall_detected',
    low_battery: 'low_battery', battery: 'low_battery',
    location_update: 'location_update', location: 'location_update',
    zone_breach: 'zone_breach', zone: 'zone_breach',
  };

  return {
    id:          String(raw._id ?? raw.id ?? `evt-${Math.random().toString(36).slice(2)}`),
    type:        typeMap[rawType] ?? 'incident_updated',
    title:       String(raw.title ?? raw.message ?? raw.type ?? 'Safety Event'),
    description: String(raw.description ?? raw.message ?? raw.details ?? ''),
    workerId:    (raw.workerId ?? raw.worker_id) as string | undefined,
    workerName:  (raw.workerName ?? raw.worker_name ??
                  (raw.worker as Record<string, unknown> | undefined)?.name) as string | undefined,
    incidentId:  (raw.incidentId ?? raw.incident_id) as string | undefined,
    severity:    (raw.severity as SafetyEvent['severity']) ?? undefined,
    timestamp:   String(raw.timestamp ?? raw.createdAt ?? raw.created_at ?? new Date().toISOString()),
    metadata:    (raw.metadata ?? raw.data) as Record<string, unknown> | undefined,
  };
}

function normaliseEventsResponse(raw: unknown): SafetyEvent[] {
  const arr: unknown[] = Array.isArray(raw)
    ? raw
    : (
        (raw as Record<string, unknown>).events ??
        (raw as Record<string, unknown>).data ??
        (raw as Record<string, unknown>).results ??
        []
      ) as unknown[];

  return (arr as Record<string, unknown>[]).map(normaliseEvent);
}

// ---------------------------------------------------------------------------
// Compute IncidentStats client-side from a fetched incidents array.
// Used as fallback when /incidents/stats doesn't exist on the backend.
// ---------------------------------------------------------------------------
function computeStats(incidents: Incident[]): IncidentStats {
  const last7: { date: string; count: number }[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { date: d.toISOString().slice(0, 10), count: 0 };
  });

  const severityMap: Record<IncidentSeverity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

  for (const inc of incidents) {
    const day = inc.createdAt?.slice(0, 10);
    const slot = last7.find((s) => s.date === day);
    if (slot) slot.count++;
    if (inc.severity in severityMap) severityMap[inc.severity as IncidentSeverity]++;
  }

  return {
    total: incidents.length,
    open: incidents.filter((i) => i.status === 'OPEN').length,
    acknowledged: incidents.filter((i) => i.status === 'ACKNOWLEDGED').length,
    resolved: incidents.filter((i) => i.status === 'RESOLVED').length,
    critical: incidents.filter((i) => i.severity === 'CRITICAL').length,
    byDay: last7,
    bySeverity: (Object.entries(severityMap) as [IncidentSeverity, number][]).map(
      ([severity, count]) => ({ severity, count }),
    ),
  };
}

export const incidentsApi = {
  getIncidents: async (filters?: IncidentFilters): Promise<IncidentsResponse> => {
    const { data } = await apiClient.get('/incidents', { params: filters });
    return normaliseIncidentsResponse(data);
  },

  getIncident: async (id: string): Promise<Incident> => {
    const { data } = await apiClient.get<{ data?: Incident } | Incident>(`/incidents/${id}`);
    if (data && typeof data === 'object' && 'data' in data && data.data) return data.data;
    return data as Incident;
  },

  acknowledgeIncident: async (id: string, note?: string): Promise<Incident> => {
    // Backend uses POST /incidents/:id/acknowledge
    const { data } = await apiClient.post<{ data?: Incident } | Incident>(
      `/incidents/${id}/acknowledge`,
      note ? { note } : {},
    );
    if (data && typeof data === 'object' && 'data' in data && data.data) return data.data;
    return data as Incident;
  },

  resolveIncident: async (id: string, note?: string): Promise<Incident> => {
    // Backend uses POST /incidents/:id/resolve
    const { data } = await apiClient.post<{ data?: Incident } | Incident>(
      `/incidents/${id}/resolve`,
      note ? { note } : {},
    );
    if (data && typeof data === 'object' && 'data' in data && data.data) return data.data;
    return data as Incident;
  },

  addNote: async (id: string, content: string): Promise<IncidentNote> => {
    const { data } = await apiClient.post<IncidentNote>(`/incidents/${id}/notes`, { content });
    return data;
  },

  // -------------------------------------------------------------------
  // Stats: computed client-side from GET /incidents (backend has no
  // /incidents/stats route — avoids a guaranteed 404 network error).
  // -------------------------------------------------------------------
  getStats: async (): Promise<IncidentStats> => {
    const { data } = await apiClient.get('/incidents', { params: { limit: 500, page: 1 } });
    const { incidents } = normaliseIncidentsResponse(data);
    return computeStats(incidents);
  },

  // -------------------------------------------------------------------
  // Events: backend exposes GET /api/events (not /events/recent)
  // -------------------------------------------------------------------
  getRecentEvents: async (limit = 10): Promise<SafetyEvent[]> => {
    try {
      const { data } = await apiClient.get('/events', { params: { limit, page: 1 } });
      return normaliseEventsResponse(data);
    } catch {
      // Events endpoint optional — silently return empty
      return [];
    }
  },
};
