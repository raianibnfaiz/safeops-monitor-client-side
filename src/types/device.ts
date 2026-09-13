export type FieldDeviceStatus = 'ACTIVE' | 'INACTIVE' | 'OFFLINE' | string;
export type GeofenceStatus = 'INSIDE' | 'OUTSIDE' | string;

/**
 * Device document from GET /api/devices.
 * Matches the MongoDB shape used by the SafeOps backend.
 */
export interface FieldDevice {
  id: string;
  deviceId: string;
  worker: string;
  assignedTo: string;
  assignedWorkerName: string;
  assignedWorkerRecordId?: string;
  batteryLevel: number;
  temperature: number;
  geofenceStatus: GeofenceStatus;
  status: FieldDeviceStatus;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
  version?: number;
  extraFields: Record<string, unknown>;
}

export interface DevicesResponse {
  devices: FieldDevice[];
  total: number;
}
