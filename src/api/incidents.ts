import { apiClient } from './client';
import { asObject, toFiniteNumber } from '@/utils/objects';
import { fetchAllPages, matchesSearch } from '@/utils/search';
import type {
  Incident,
  IncidentType,
  IncidentsResponse,
  IncidentFilters,
  IncidentStats,
  IncidentNote,
  IncidentSeverity,
} from '@/types';
import { INCIDENT_TYPES } from '@/types';
import { eventsApi } from './events';

function extractRelatedId(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  const relatedDocument = asObject(value);
  if (!relatedDocument) return undefined;
  const relatedId = relatedDocument._id ?? relatedDocument.id;
  return relatedId ? String(relatedId) : undefined;
}

function unwrapIncidentDocument(payload: unknown): Record<string, unknown> {
  const document = asObject(payload) ?? {};
  const nestedDocument = asObject(document.data);
  return nestedDocument ?? document;
}

function normaliseIncidentNote(payload: unknown, fallbackId: string): IncidentNote {
  const note = asObject(payload) ?? {};
  return {
    id: String(note._id ?? note.id ?? fallbackId),
    author: String(note.author ?? note.createdBy ?? 'Unknown'),
    content: String(note.content ?? note.text ?? note.message ?? ''),
    createdAt: String(note.createdAt ?? note.created_at ?? new Date().toISOString()),
  };
}

function normaliseIncidentType(typeValue: unknown): IncidentType {
  const normalised = String(typeValue ?? '')
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

function toIncidentQueryParams(filters?: IncidentFilters): Record<string, string | number> {
  const queryParams: Record<string, string | number> = {
    page: toFiniteNumber(filters?.page, 1) || 1,
    limit: toFiniteNumber(filters?.limit, 20) || 20,
  };

  if (filters?.status) queryParams.status = filters.status;
  if (filters?.severity === 'HIGH' || filters?.severity === 'CRITICAL') {
    queryParams.severity = filters.severity;
  }
  if (filters?.type && (INCIDENT_TYPES as string[]).includes(filters.type)) {
    queryParams.type = filters.type;
  }
  if (filters?.workerId) queryParams.workerId = filters.workerId;

  return queryParams;
}

/**
 * Map a raw Mongo/Express incident document onto our Incident type.
 * Backend typically sends `_id` instead of `id`, which made React keys undefined.
 */
function normaliseIncident(payload: unknown): Incident {
  const document = unwrapIncidentDocument(payload);
  const location = asObject(document.location);
  const noteDocuments = Array.isArray(document.notes) ? document.notes : [];
  const id = String(document._id ?? document.id ?? document.incidentId ?? '');

  return {
    id,
    incidentId: String(document.incidentId ?? document.incident_id ?? id),
    title: String(document.title ?? document.message ?? 'Untitled incident'),
    description: (document.description ?? document.details) as string | undefined,
    type: normaliseIncidentType(document.type),
    severity: (document.severity as Incident['severity']) ?? 'LOW',
    status: (document.status as Incident['status']) ?? 'OPEN',
    workerId: extractRelatedId(document.workerId ?? document.worker_id ?? document.worker),
    workerName: (document.workerName ?? document.worker_name ??
      asObject(document.worker)?.name) as string | undefined,
    deviceId: (document.deviceId ?? document.device_id) as string | undefined,
    location: location
      ? {
          latitude: Number(location.latitude ?? location.lat) || undefined,
          longitude: Number(location.longitude ?? location.lng ?? location.lon) || undefined,
          address: location.address as string | undefined,
          zone: (location.zone ?? location.area) as string | undefined,
        }
      : undefined,
    notes: noteDocuments.map((note, noteIndex) =>
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

function extractIncidentList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  const responseBody = asObject(payload);
  if (!responseBody) return [];

  const nestedPayload = asObject(responseBody.data);
  if (nestedPayload) return extractIncidentList(nestedPayload);

  if (Array.isArray(responseBody.incidents)) return responseBody.incidents;
  if (Array.isArray(responseBody.data)) return responseBody.data;
  if (Array.isArray(responseBody.results)) return responseBody.results;
  return [];
}

function normaliseIncidentsResponse(payload: unknown): IncidentsResponse {
  const responseBody = asObject(payload) ?? {};
  const incidents = extractIncidentList(payload).map(normaliseIncident);
  const page = Math.max(1, toFiniteNumber(responseBody.page, 1) || 1);
  const pageSize = Math.max(1, toFiniteNumber(responseBody.limit ?? responseBody.pageSize, incidents.length || 20) || 20);
  const total = toFiniteNumber(responseBody.total ?? responseBody.totalCount, incidents.length);
  const totalPages = Math.max(
    1,
    toFiniteNumber(responseBody.totalPages, Math.ceil(total / pageSize) || 1) || 1,
  );

  return {
    incidents,
    total,
    page,
    pageSize,
    totalPages,
  };
}

// ---------------------------------------------------------------------------
// Compute IncidentStats client-side from a fetched incidents array.
// Used as fallback when /incidents/stats doesn't exist on the backend.
// ---------------------------------------------------------------------------
function latestIncidentByTimestamp(
  incidents: Incident[],
  getTimestamp: (incident: Incident) => string | undefined,
): { timestamp?: string; incidentId?: string } {
  const rankedIncidents = incidents
    .map((incident) => {
      const timestamp = getTimestamp(incident);
      return {
        incident,
        timestamp,
        time: timestamp ? Date.parse(timestamp) : Number.NaN,
      };
    })
    .filter((entry) => Boolean(entry.timestamp) && Number.isFinite(entry.time));

  rankedIncidents.sort((left, right) => right.time - left.time);
  const latest = rankedIncidents[0];
  if (!latest) return {};

  return {
    timestamp: latest.timestamp,
    incidentId: latest.incident.id || latest.incident.incidentId,
  };
}

function computeStats(incidents: Incident[]): IncidentStats {
  const lastSevenDays: { date: string; count: number }[] = Array.from({ length: 7 }, (_, dayOffset) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - dayOffset));
    return { date: date.toISOString().slice(0, 10), count: 0 };
  });

  const severityCounts: Record<IncidentSeverity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

  for (const incident of incidents) {
    const createdOn = incident.createdAt?.slice(0, 10);
    const daySlot = lastSevenDays.find((slot) => slot.date === createdOn);
    if (daySlot) daySlot.count++;
    if (incident.severity in severityCounts) severityCounts[incident.severity as IncidentSeverity]++;
  }

  return {
    total: incidents.length,
    open: incidents.filter((incident) => incident.status === 'OPEN').length,
    acknowledged: incidents.filter((incident) => incident.status === 'ACKNOWLEDGED').length,
    resolved: incidents.filter((incident) => incident.status === 'RESOLVED').length,
    critical: incidents.filter((incident) => incident.severity === 'CRITICAL').length,
    byDay: lastSevenDays,
    bySeverity: (Object.entries(severityCounts) as [IncidentSeverity, number][]).map(
      ([severity, count]) => ({ severity, count }),
    ),
  };
}

export const incidentsApi = {
  getIncidents: async (
    filters?: IncidentFilters,
    signal?: AbortSignal,
  ): Promise<IncidentsResponse> => {
    const { data } = await apiClient.get('/incidents', {
      params: toIncidentQueryParams(filters),
      signal,
    });
    return normaliseIncidentsResponse(data);
  },

  searchIncidents: async (
    filters?: IncidentFilters,
    signal?: AbortSignal,
  ): Promise<IncidentsResponse> => {
    const searchTerm = filters?.search?.trim() ?? '';
    const page = toFiniteNumber(filters?.page, 1) || 1;
    const pageSize = toFiniteNumber(filters?.limit, 20) || 20;

    const allIncidents = await fetchAllPages(
      async (requestPage, requestLimit, requestSignal) => {
        const result = await incidentsApi.getIncidents(
          {
            status: filters?.status,
            severity: filters?.severity,
            type: filters?.type,
            workerId: filters?.workerId,
            page: requestPage,
            limit: requestLimit,
          },
          requestSignal,
        );
        return { items: result.incidents, totalPages: result.totalPages };
      },
      { pageSize: 100, signal },
    );

    const matchingIncidents = allIncidents.filter((incident) =>
      matchesSearch(
        [
          incident.title,
          incident.description,
          incident.workerName,
          incident.workerId,
          incident.deviceId,
          incident.type,
          incident.incidentId,
          incident.id,
        ],
        searchTerm,
      ),
    );

    const total = matchingIncidents.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

    return {
      incidents: matchingIncidents,
      total,
      page,
      pageSize,
      totalPages,
    };
  },

  // The backend has no GET /incidents/:id route (only /:id/acknowledge and
  // /:id/resolve exist), so we locate the incident by scanning the paginated
  // list instead of hitting a route that would always 404.
  getIncident: async (id: string, signal?: AbortSignal): Promise<Incident> => {
    const allIncidents = await fetchAllPages(
      async (requestPage, requestLimit, requestSignal) => {
        const result = await incidentsApi.getIncidents(
          { page: requestPage, limit: requestLimit },
          requestSignal,
        );
        return { items: result.incidents, totalPages: result.totalPages };
      },
      { pageSize: 100, signal },
    );

    const match = allIncidents.find(
      (incident) => incident.id === id || incident.incidentId === id,
    );

    if (!match) {
      throw new Error('Incident not found');
    }

    return match;
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

  getStats: async (): Promise<IncidentStats> => {
    const loadIncidents = (pageSize: number) =>
      fetchAllPages(
        async (requestPage, requestLimit, requestSignal) => {
          const result = await incidentsApi.getIncidents(
            { page: requestPage, limit: requestLimit },
            requestSignal,
          );
          return { items: result.incidents, totalPages: result.totalPages };
        },
        { pageSize },
      );

    try {
      return computeStats(await loadIncidents(100));
    } catch {
      return computeStats(await loadIncidents(20));
    }
  },

  getAcknowledgedSummary: async (): Promise<{
    count: number;
    lastAcknowledgedAt?: string;
    lastAcknowledgedIncidentId?: string;
  }> => {
    try {
      const { incidents, total } = await incidentsApi.getIncidents({
        status: 'ACKNOWLEDGED',
        page: 1,
        limit: 50,
      });
      const latest = latestIncidentByTimestamp(
        incidents,
        (incident) => incident.acknowledgedAt || incident.updatedAt,
      );

      return {
        count: total,
        lastAcknowledgedAt: latest.timestamp,
        lastAcknowledgedIncidentId: latest.incidentId,
      };
    } catch {
      return { count: 0 };
    }
  },

  getResolvedSummary: async (): Promise<{
    lastResolvedAt?: string;
    lastResolvedIncidentId?: string;
  }> => {
    try {
      const { incidents } = await incidentsApi.getIncidents({
        status: 'RESOLVED',
        page: 1,
        limit: 50,
      });
      const latest = latestIncidentByTimestamp(
        incidents,
        (incident) => incident.resolvedAt || incident.updatedAt,
      );

      return {
        lastResolvedAt: latest.timestamp,
        lastResolvedIncidentId: latest.incidentId,
      };
    } catch {
      return {};
    }
  },

  getRecentEvents: eventsApi.getRecentEvents,
};
