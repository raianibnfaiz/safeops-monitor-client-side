export type SafetyEventType =
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
  incidentId?: string;
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// Raw systemHealth object shape returned by the backend
export interface SystemHealthRaw {
  database: string;          // e.g. "connected" | "disconnected"
  simulator: boolean;
  clientsConnected: number;
  uptimeSeconds: number;
}

export interface DashboardStats {
  totalWorkers: number;
  activeWorkers: number;
  offlineWorkers: number;
  onlineDevices: number;
  offlineDevices: number;
  openIncidents: number;
  criticalIncidents: number;
  resolvedToday: number;
  // Normalised to a string after API response processing
  systemHealth: 'healthy' | 'degraded' | 'critical';
  // Raw object from backend — preserved for the Status panel
  systemHealthRaw?: SystemHealthRaw;
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
