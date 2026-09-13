export type WorkerStatus = 'ACTIVE' | 'INACTIVE';
export type DeviceStatus = 'ACTIVE' | 'INACTIVE';

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
  zone?: string;
  timestamp: string;
}

export interface Device {
  id: string;
  deviceId: string;
  model?: string;
  status: DeviceStatus;
  batteryLevel: number;
  lastSeen: string;
  firmwareVersion?: string;
}

export interface Worker {
  id: string;
  workerId: string;
  name: string;
  email?: string;
  phone?: string;
  department?: string;
  role?: string;
  status: WorkerStatus;
  device?: Device;           // optional — backend may not populate this
  deviceId?: string;         // raw deviceId field some backends return
  location?: Location;
  lastActivity: string;
  joinedAt: string;
  avatar?: string;
}

export interface WorkerActivity {
  id: string;
  workerId: string;
  type: 'check_in' | 'check_out' | 'location_update' | 'sos' | 'fall_detected' | 'device_connected' | 'device_disconnected';
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface WorkersResponse {
  workers: Worker[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WorkerFilters {
  status?: WorkerStatus;
  search?: string;
  department?: string;
  page?: number;
  limit?: number;        // standard Express/Mongoose param name
}
