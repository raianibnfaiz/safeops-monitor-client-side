export type MonitorEventType =
  | 'HIGH_TEMPERATURE'
  | 'LOW_BATTERY'
  | 'FALL_DETECTED'
  | 'NO_MOVEMENT'
  | 'GEOFENCE_BREACH'
  | 'SOS';

export const MONITOR_EVENT_TYPES: MonitorEventType[] = [
  'HIGH_TEMPERATURE',
  'LOW_BATTERY',
  'FALL_DETECTED',
  'NO_MOVEMENT',
  'GEOFENCE_BREACH',
  'SOS',
];

export type EventSeverity = 'WARNING' | 'HIGH' | 'CRITICAL';

export const EVENT_SEVERITIES: EventSeverity[] = ['CRITICAL', 'HIGH', 'WARNING'];

export type SafetyEventType =
  | MonitorEventType
  | 'worker_online'
  | 'worker_offline'
  | 'incident_created'
  | 'incident_updated'
  | 'incident_resolved'
  | 'sos_alert'
  | 'fall_detected'
  | 'low_battery'
  | 'location_update'
  | 'zone_breach';

export interface SafetyEvent {
  id: string;
  type: SafetyEventType;
  title: string;
  description: string;
  workerId?: string;
  workerName?: string;
  deviceId?: string;
  incidentId?: string;
  severity?: EventSeverity | 'MEDIUM' | 'LOW' | 'INFO';
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface EventFilters {
  search?: string;
  severity?: EventSeverity;
  eventType?: MonitorEventType;
  page?: number;
  limit?: number;
}

export interface EventsResponse {
  events: SafetyEvent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SystemHealthDetails {
  database: string;
  simulator: boolean;
  clientsConnected: number;
  uptimeSeconds: number;
}

export interface DashboardStats {
  totalWorkers: number;
  activeWorkers: number;
  inactiveWorkers: number;
  activeDevices: number;
  inactiveDevices: number;
  openIncidents: number;
  criticalIncidents: number;
  resolvedToday: number;
  systemHealth: 'healthy' | 'degraded' | 'critical';
  systemHealthDetails?: SystemHealthDetails;
  lastUpdated: string;
}

// Socket.IO event payloads
// These match the actual backend events emitted by the SafeOps server:
//   'safety:event'    — general safety / sensor events
//   'safety:incident' — incident lifecycle events (created / updated / resolved)
export interface SocketEventMap {
  // Core backend events (confirmed from server source)
  'safety:event': SafetyEvent;
  'safety:incident': { incident: import('./incident').Incident };

  // Extended events (emitted by some backend versions)
  'incident:created': { incident: import('./incident').Incident };
  'incident:updated': { incident: import('./incident').Incident };
  'worker:status_changed': { workerId: string; status: import('./worker').WorkerStatus };
  'worker:location_updated': { workerId: string; location: import('./worker').Location };
  'device:status_changed': { deviceId: string; status: import('./worker').DeviceStatus; batteryLevel?: number };
  'stats:updated': DashboardStats;
}
