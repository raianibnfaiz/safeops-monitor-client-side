export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
export type IncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

// Matches backend EVENT_TYPES in safeops-monitor-server-side
export type IncidentType =
  | 'HIGH_TEMPERATURE'
  | 'LOW_BATTERY'
  | 'FALL_DETECTED'
  | 'NO_MOVEMENT'
  | 'GEOFENCE_BREACH'
  | 'SOS';

export const INCIDENT_TYPES: IncidentType[] = [
  'HIGH_TEMPERATURE',
  'LOW_BATTERY',
  'FALL_DETECTED',
  'NO_MOVEMENT',
  'GEOFENCE_BREACH',
  'SOS',
];

export const INCIDENT_FILTER_SEVERITIES: IncidentSeverity[] = ['CRITICAL', 'HIGH'];

export interface IncidentLocation {
  latitude?: number;
  longitude?: number;
  address?: string;
  zone?: string;
}

export interface IncidentNote {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface Incident {
  id: string;
  incidentId: string;
  title: string;
  description?: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  workerId?: string;
  workerName?: string;
  deviceId?: string;
  location?: IncidentLocation;
  notes?: IncidentNote[];
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentsResponse {
  incidents: Incident[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface IncidentFilters {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  type?: IncidentType;
  workerId?: string;
  search?: string;
  page?: number;
  limit?: number;        // standard Express/Mongoose param name
}

export interface IncidentStats {
  total: number;
  open: number;
  acknowledged: number;
  resolved: number;
  critical: number;
  byDay: { date: string; count: number }[];
  bySeverity: { severity: IncidentSeverity; count: number }[];
}
