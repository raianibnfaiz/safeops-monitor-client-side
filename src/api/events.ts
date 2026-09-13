import { apiClient } from './client';
import { asObject, toFiniteNumber } from '@/utils/objects';
import { fetchAllPages, matchesSearch } from '@/utils/search';
import { MONITOR_EVENT_TYPES } from '@/types';
import type { EventFilters, EventsResponse, SafetyEvent, SafetyEventType } from '@/types';

const EVENT_TYPE_ALIASES: Record<string, SafetyEventType> = {
  HIGH_TEMPERATURE: 'HIGH_TEMPERATURE',
  LOW_BATTERY: 'LOW_BATTERY',
  FALL_DETECTED: 'FALL_DETECTED',
  NO_MOVEMENT: 'NO_MOVEMENT',
  GEOFENCE_BREACH: 'GEOFENCE_BREACH',
  SOS: 'SOS',
  worker_online: 'worker_online',
  online: 'worker_online',
  connected: 'worker_online',
  worker_offline: 'worker_offline',
  offline: 'worker_offline',
  disconnected: 'worker_offline',
  incident_created: 'incident_created',
  incident: 'incident_created',
  incident_updated: 'incident_updated',
  updated: 'incident_updated',
  incident_resolved: 'incident_resolved',
  resolved: 'incident_resolved',
  sos_alert: 'sos_alert',
  sos: 'SOS',
  fall_detected: 'FALL_DETECTED',
  fall: 'FALL_DETECTED',
  low_battery: 'LOW_BATTERY',
  battery: 'LOW_BATTERY',
  location_update: 'location_update',
  location: 'location_update',
  zone_breach: 'GEOFENCE_BREACH',
  zone: 'GEOFENCE_BREACH',
};

function normaliseEventType(eventDocument: Record<string, unknown>): SafetyEventType {
  const rawType = String(eventDocument.eventType ?? eventDocument.type ?? '').trim();
  const upperType = rawType.toUpperCase().replace(/[\s-]+/g, '_');
  const lowerType = rawType.toLowerCase().replace(/[\s-]+/g, '_');

  return EVENT_TYPE_ALIASES[upperType] ?? EVENT_TYPE_ALIASES[lowerType] ?? 'incident_updated';
}

function isValidCoordinatePair(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

// Handles both `{ latitude, longitude }` / `{ lat, lng }` shaped objects and
// GeoJSON-style `[longitude, latitude]` coordinate arrays.
function extractCoordinates(source: unknown): { latitude: number; longitude: number } | undefined {
  if (!source) return undefined;

  if (Array.isArray(source)) {
    if (source.length < 2) return undefined;
    const longitude = Number(source[0]);
    const latitude = Number(source[1]);
    return isValidCoordinatePair(latitude, longitude) ? { latitude, longitude } : undefined;
  }

  if (typeof source !== 'object') return undefined;
  const fields = source as Record<string, unknown>;
  const latitude = Number(fields.latitude ?? fields.lat);
  const longitude = Number(fields.longitude ?? fields.lng ?? fields.lon);

  if (isValidCoordinatePair(latitude, longitude)) return { latitude, longitude };
  if (fields.coordinates) return extractCoordinates(fields.coordinates);
  return undefined;
}

// Backends vary in where they place event coordinates: a nested `location`
// object (like workers/incidents), a nested `lastKnownLocation`, directly on
// the event document, or inside `metadata`/`data`. Check them all.
function extractEventLocation(
  eventDocument: Record<string, unknown>,
  metadata: Record<string, unknown> | undefined,
): SafetyEvent['location'] {
  const candidateSources: unknown[] = [
    eventDocument.location,
    eventDocument.lastKnownLocation,
    eventDocument.last_location,
    metadata?.location,
    eventDocument,
    metadata,
  ];

  for (const source of candidateSources) {
    const coordinates = extractCoordinates(source);
    if (!coordinates) continue;

    const fields =
      source && typeof source === 'object' && !Array.isArray(source)
        ? (source as Record<string, unknown>)
        : {};

    return {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      address: fields.address as string | undefined,
      zone: (fields.zone ?? fields.area) as string | undefined,
    };
  }

  return undefined;
}

function unwrapEventDocument(payload: unknown): Record<string, unknown> {
  const document = asObject(payload) ?? {};
  const nestedDocument = asObject(document.data);
  return nestedDocument ?? document;
}

function isRouteNotFound(error: unknown): boolean {
  const axiosError = error as { response?: { status?: number } };
  return axiosError?.response?.status === 404;
}

function extractEventList(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const responseBody = asObject(payload);
  if (!responseBody) return [];
  if (Array.isArray(responseBody.data)) return responseBody.data as Record<string, unknown>[];
  if (Array.isArray(responseBody.events)) return responseBody.events as Record<string, unknown>[];
  if (Array.isArray(responseBody.results)) return responseBody.results as Record<string, unknown>[];
  const nested = asObject(responseBody.data);
  if (nested) return extractEventList(nested);
  return [];
}

export function normaliseEvent(eventDocument: Record<string, unknown>): SafetyEvent {
  const populatedWorker = asObject(eventDocument.worker);
  const populatedDevice = asObject(eventDocument.device);
  const eventType = normaliseEventType(eventDocument);
  const message = String(eventDocument.message ?? eventDocument.title ?? eventDocument.description ?? eventType);
  const metadata = (eventDocument.metadata ?? eventDocument.data) as Record<string, unknown> | undefined;

  return {
    id: String(eventDocument._id ?? eventDocument.id ?? `evt-${Math.random().toString(36).slice(2)}`),
    type: eventType,
    title: String(eventDocument.title ?? eventDocument.message ?? eventType),
    description: String(eventDocument.description ?? eventDocument.message ?? eventDocument.details ?? message),
    workerId: String(
      eventDocument.workerId ??
      eventDocument.worker_id ??
      populatedWorker?._id ??
      populatedWorker?.id ??
      '',
    ) || undefined,
    workerName: (
      eventDocument.workerName ??
      eventDocument.worker_name ??
      populatedWorker?.name
    ) as string | undefined,
    deviceId: String(
      eventDocument.deviceId ??
      eventDocument.device_id ??
      populatedDevice?.deviceId ??
      populatedDevice?.device_id ??
      '',
    ) || undefined,
    incidentId: (eventDocument.incidentId ?? eventDocument.incident_id) as string | undefined,
    severity: (eventDocument.severity as SafetyEvent['severity']) ?? undefined,
    timestamp: String(
      eventDocument.timestamp ??
      eventDocument.createdAt ??
      eventDocument.created_at ??
      new Date().toISOString(),
    ),
    location: extractEventLocation(eventDocument, metadata),
    metadata,
  };
}

export function normaliseEventsResponse(payload: unknown): EventsResponse {
  const responseBody = asObject(payload) ?? {};
  const events = extractEventList(payload).map(normaliseEvent);
  const page = Math.max(1, toFiniteNumber(responseBody.page, 1) || 1);
  const pageSize = Math.max(
    1,
    toFiniteNumber(responseBody.limit ?? responseBody.pageSize, events.length || 20) || 20,
  );
  const total = toFiniteNumber(responseBody.total ?? responseBody.totalCount, events.length);
  const totalPages = Math.max(
    1,
    toFiniteNumber(responseBody.totalPages, Math.ceil(total / pageSize) || 1) || 1,
  );

  return {
    events,
    total,
    page,
    pageSize,
    totalPages,
  };
}

function toEventQueryParams(filters?: EventFilters): Record<string, string | number> {
  const queryParams: Record<string, string | number> = {
    page: toFiniteNumber(filters?.page, 1) || 1,
    limit: toFiniteNumber(filters?.limit, 20) || 20,
  };

  if (filters?.severity === 'WARNING' || filters?.severity === 'HIGH' || filters?.severity === 'CRITICAL') {
    queryParams.severity = filters.severity;
  }
  if (filters?.eventType && (MONITOR_EVENT_TYPES as string[]).includes(filters.eventType)) {
    queryParams.eventType = filters.eventType;
  }

  return queryParams;
}

export const eventsApi = {
  getEvents: async (
    filters?: EventFilters,
    signal?: AbortSignal,
  ): Promise<EventsResponse> => {
    const { data } = await apiClient.get('/events', {
      params: toEventQueryParams(filters),
      signal,
    });
    return normaliseEventsResponse(data);
  },

  searchEvents: async (
    filters?: EventFilters,
    signal?: AbortSignal,
  ): Promise<EventsResponse> => {
    const searchTerm = filters?.search?.trim() ?? '';
    const page = toFiniteNumber(filters?.page, 1) || 1;
    const pageSize = toFiniteNumber(filters?.limit, 20) || 20;

    const allEvents = await fetchAllPages(
      async (requestPage, requestLimit, requestSignal) => {
        const result = await eventsApi.getEvents(
          {
            severity: filters?.severity,
            eventType: filters?.eventType,
            page: requestPage,
            limit: requestLimit,
          },
          requestSignal,
        );
        return { items: result.events, totalPages: result.totalPages };
      },
      { pageSize: 100, signal },
    );

    const matchingEvents = allEvents.filter((event) =>
      matchesSearch(
        [
          event.title,
          event.description,
          event.workerName,
          event.workerId,
          event.deviceId,
          event.type,
          event.id,
          event.incidentId,
        ],
        searchTerm,
      ),
    );

    const total = matchingEvents.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

    return {
      events: matchingEvents,
      total,
      page,
      pageSize,
      totalPages,
    };
  },

  // GET /events/:id exists on the backend, but fall back to scanning the
  // paginated list (same trick used for incidents) in case it's ever
  // unavailable, so the details page never hard-fails on a 404.
  getEvent: async (id: string, signal?: AbortSignal): Promise<SafetyEvent> => {
    try {
      const { data } = await apiClient.get(`/events/${id}`, { signal });
      return normaliseEvent(unwrapEventDocument(data));
    } catch (err) {
      if (!isRouteNotFound(err)) throw err;

      const allEvents = await fetchAllPages(
        async (requestPage, requestLimit, requestSignal) => {
          const result = await eventsApi.getEvents(
            { page: requestPage, limit: requestLimit },
            requestSignal,
          );
          return { items: result.events, totalPages: result.totalPages };
        },
        { pageSize: 100, signal },
      );

      const match = allEvents.find((event) => event.id === id);
      if (!match) throw new Error('Event not found');
      return match;
    }
  },

  getRecentEvents: async (limit = 15): Promise<SafetyEvent[]> => {
    try {
      const { data } = await apiClient.get('/events', { params: { page: 1, limit } });
      return normaliseEventsResponse(data).events;
    } catch {
      return [];
    }
  },
};
