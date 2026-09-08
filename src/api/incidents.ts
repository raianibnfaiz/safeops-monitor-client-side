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

function normaliseEventsResponse(raw: unknown): SafetyEvent[] {
  if (Array.isArray(raw)) return raw as SafetyEvent[];
  const r = raw as Record<string, unknown>;
  return (
    (r.events as SafetyEvent[] | undefined) ??
    (r.data as SafetyEvent[] | undefined) ??
    (r.results as SafetyEvent[] | undefined) ??
    []
  );
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
  // Stats: try GET /incidents/stats first (if backend has it).
  // If 404 → fall back to fetching all incidents and computing locally.
  // -------------------------------------------------------------------
  getStats: async (): Promise<IncidentStats> => {
    try {
      const { data } = await apiClient.get('/incidents/stats');
      const stats =
        (data as Record<string, unknown>).data ??
        (data as Record<string, unknown>).stats ??
        data;
      return stats as IncidentStats;
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 500) {
        // Endpoint doesn't exist — compute from a broad incidents fetch
        const { data } = await apiClient.get('/incidents', { params: { limit: 500, page: 1 } });
        const { incidents } = normaliseIncidentsResponse(data);
        return computeStats(incidents);
      }
      throw err;
    }
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
