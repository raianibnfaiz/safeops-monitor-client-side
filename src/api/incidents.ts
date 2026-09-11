import { apiClient } from './client';
import type {
  Incident,
  IncidentType,
  IncidentsResponse,
  IncidentFilters,
  IncidentStats,
  IncidentNote,
  SafetyEvent,
  IncidentSeverity,
} from '@/types';
import { INCIDENT_TYPES } from '@/types';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function unwrapIncidentDocument(raw: unknown): Record<string, unknown> {
  const record = asRecord(raw) ?? {};
  const nested = asRecord(record.data);
  return nested ?? record;
}

function normaliseIncidentNote(raw: unknown, fallbackId: string): IncidentNote {
  const note = asRecord(raw) ?? {};
  return {
    id: String(note._id ?? note.id ?? fallbackId),
    author: String(note.author ?? note.createdBy ?? 'Unknown'),
    content: String(note.content ?? note.text ?? note.message ?? ''),
    createdAt: String(note.createdAt ?? note.created_at ?? new Date().toISOString()),
  };
}

function normaliseIncidentType(raw: unknown): IncidentType {
  const normalised = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

  const aliases: Record<string, IncidentType> = {
    FALL_DETECTED: 'FALL_DETECTED',
    FALL: 'FALL_DETECTED',
    SOS: 'SOS',
    SOS_TRIGGERED: 'SOS',
    NO_MOVEMENT: 'NO_MOVEMENT',
    NO_MOTION: 'NO_MOVEMENT',
    GEOFENCE_BREACH: 'GEOFENCE_BREACH',
    RESTRICTED_AREA: 'GEOFENCE_BREACH',
    ZONE_BREACH: 'GEOFENCE_BREACH',
    HIGH_TEMPERATURE: 'HIGH_TEMPERATURE',
    FIRE_ALERT: 'HIGH_TEMPERATURE',
    LOW_BATTERY: 'LOW_BATTERY',
    BATTERY: 'LOW_BATTERY',
  };

  if (aliases[normalised]) return aliases[normalised];
  if ((INCIDENT_TYPES as string[]).includes(normalised)) {
    return normalised as IncidentType;
  }
  return 'SOS';
}

function toIncidentQueryParams(filters?: IncidentFilters): Record<string, string | number> | undefined {
  if (!filters) return undefined;

  const params: Record<string, string | number> = {};

  if (filters.status) params.status = filters.status;
  if (filters.severity === 'HIGH' || filters.severity === 'CRITICAL') {
    params.severity = filters.severity;
  }
  if (filters.type && (INCIDENT_TYPES as string[]).includes(filters.type)) {
    params.type = filters.type;
  }
  if (filters.workerId) params.workerId = filters.workerId;
  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;

  return params;
}

/**
 * Map a raw Mongo/Express incident document onto our Incident type.
 * Backend typically sends `_id` instead of `id`, which made React keys undefined.
 */
function normaliseIncident(raw: unknown): Incident {
  const document = unwrapIncidentDocument(raw);
  const location = asRecord(document.location);
  const rawNotes = Array.isArray(document.notes) ? document.notes : [];
  const id = String(document._id ?? document.id ?? document.incidentId ?? '');

  return {
    id,
    incidentId: String(document.incidentId ?? document.incident_id ?? id),
    title: String(document.title ?? document.message ?? 'Untitled incident'),
    description: (document.description ?? document.details) as string | undefined,
    type: normaliseIncidentType(document.type),
    severity: (document.severity as Incident['severity']) ?? 'LOW',
    status: (document.status as Incident['status']) ?? 'OPEN',
    workerId: (document.workerId ?? document.worker_id) as string | undefined,
    workerName: (document.workerName ?? document.worker_name ??
      asRecord(document.worker)?.name) as string | undefined,
    deviceId: (document.deviceId ?? document.device_id) as string | undefined,
    location: location
      ? {
          latitude: Number(location.latitude ?? location.lat) || undefined,
          longitude: Number(location.longitude ?? location.lng ?? location.lon) || undefined,
          address: location.address as string | undefined,
          zone: (location.zone ?? location.area) as string | undefined,
        }
      : undefined,
    notes: rawNotes.map((note, noteIndex) =>
      normaliseIncidentNote(note, `${id}-note-${noteIndex}`),
    ),
    acknowledgedBy: (document.acknowledgedBy ?? document.acknowledged_by) as string | undefined,
    acknowledgedAt: (document.acknowledgedAt ?? document.acknowledged_at) as string | undefined,
    resolvedBy: (document.resolvedBy ?? document.resolved_by) as string | undefined,
    resolvedAt: (document.resolvedAt ?? document.resolved_at) as string | undefined,
    createdAt: String(document.createdAt ?? document.created_at ?? new Date().toISOString()),
    updatedAt: String(document.updatedAt ?? document.updated_at ?? document.createdAt ?? new Date().toISOString()),
  };
}

function extractIncidentList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;

  const record = asRecord(raw);
  if (!record) return [];

  const nestedData = asRecord(record.data);
  if (nestedData) return extractIncidentList(nestedData);

  if (Array.isArray(record.incidents)) return record.incidents;
  if (Array.isArray(record.data)) return record.data;
  if (Array.isArray(record.results)) return record.results;
  return [];
}

function normaliseIncidentsResponse(raw: unknown): IncidentsResponse {
  const record = asRecord(raw) ?? {};
  const incidents = extractIncidentList(raw).map(normaliseIncident);

  return {
    incidents,
    total:
      (record.total as number | undefined) ??
      (record.count as number | undefined) ??
      (record.totalCount as number | undefined) ??
      incidents.length,
    page: (record.page as number | undefined) ?? 1,
    pageSize:
      (record.limit as number | undefined) ??
      (record.pageSize as number | undefined) ??
      incidents.length,
  };
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
    const { data } = await apiClient.get('/incidents', {
      params: toIncidentQueryParams(filters),
    });
    const result = normaliseIncidentsResponse(data);

    const searchTerm = filters?.search?.trim().toLowerCase();
    if (!searchTerm) return result;

    const matchingIncidents = result.incidents.filter((incident) => {
      const haystack = [
        incident.title,
        incident.description,
        incident.workerName,
        incident.type,
        incident.incidentId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(searchTerm);
    });

    return {
      ...result,
      incidents: matchingIncidents,
      total: matchingIncidents.length,
    };
  },

  getIncident: async (id: string): Promise<Incident> => {
    const { data } = await apiClient.get(`/incidents/${id}`);
    return normaliseIncident(data);
  },

  acknowledgeIncident: async (id: string, note?: string): Promise<Incident> => {
    const { data } = await apiClient.post(
      `/incidents/${id}/acknowledge`,
      note ? { note } : {},
    );
    return normaliseIncident(data);
  },

  resolveIncident: async (id: string, note?: string): Promise<Incident> => {
    const { data } = await apiClient.post(
      `/incidents/${id}/resolve`,
      note ? { note } : {},
    );
    return normaliseIncident(data);
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
