export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
export type IncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type IncidentType =
  | 'fall_detected'
  | 'sos_triggered'
  | 'no_motion'
  | 'restricted_area'
  | 'equipment_fault'
  | 'gas_leak'
  | 'fire_alert'
  | 'medical'
  | 'other';

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
