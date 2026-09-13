import { apiClient } from './client';
import { asObject, toFiniteNumber } from '@/utils/objects';
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
    metadata: (eventDocument.metadata ?? eventDocument.data) as Record<string, unknown> | undefined,
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

  getRecentEvents: async (limit = 15): Promise<SafetyEvent[]> => {
    try {
      const { data } = await apiClient.get('/events', { params: { page: 1, limit } });
      return normaliseEventsResponse(data).events;
    } catch {
      return [];
    }
  },
};
