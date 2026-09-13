import { apiClient } from './client';
import { asObject, toFiniteNumber } from '@/utils/objects';
import type { Worker, Device, WorkersResponse, WorkerFilters, WorkerActivity, DashboardStats } from '@/types';

function countCriticalIncidents(visualization?: Record<string, unknown>): number | undefined {
  const severityRows = visualization?.incidentsBySeverity;
  if (!Array.isArray(severityRows)) return undefined;

  const criticalRow = severityRows.find((row) => {
    const severityEntry = asObject(row);
    const severity = String(severityEntry?.severity ?? severityEntry?._id ?? '').toUpperCase();
    return severity === 'CRITICAL';
  });

  if (!criticalRow) return 0;
  return toFiniteNumber(asObject(criticalRow)?.count);
}

function normaliseWorkerStatus(statusValue: unknown): Worker['status'] {
  const statusKey = String(statusValue ?? '').toUpperCase().trim().replace(/[\s-]+/g, '_');
  if (statusKey === 'ACTIVE' || statusKey === 'ONLINE' || statusKey === 'CONNECTED') return 'ACTIVE';
  return 'INACTIVE';
}

function normaliseDeviceStatus(statusValue: unknown): Device['status'] {
  const statusKey = String(statusValue ?? '').toUpperCase().trim().replace(/[\s-]+/g, '_');
  if (statusKey === 'ACTIVE' || statusKey === 'ONLINE' || statusKey === 'CONNECTED') return 'ACTIVE';
  return 'INACTIVE';
}

function looksLikeObjectId(value: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(value);
}

function mapDeviceFields(
  deviceFields: Record<string, unknown>,
  fallbacks: { deviceId?: unknown; status?: unknown; batteryLevel?: unknown } = {},
): Device {
  const deviceId = String(
    deviceFields.deviceId ??
    deviceFields.device_id ??
    fallbacks.deviceId ??
    deviceFields._id ??
    deviceFields.id ??
    '—',
  );

  return {
    id: String(deviceFields._id ?? deviceFields.id ?? ''),
    deviceId,
    model: deviceFields.model as string | undefined,
    status: normaliseDeviceStatus(deviceFields.status ?? fallbacks.status),
    batteryLevel: toFiniteNumber(
      deviceFields.batteryLevel ?? deviceFields.battery ?? deviceFields.battery_level ?? fallbacks.batteryLevel,
    ),
    lastSeen: String(
      deviceFields.lastSeenAt ??
      deviceFields.lastSeen ??
      deviceFields.last_seen ??
      deviceFields.updatedAt ??
      new Date().toISOString(),
    ),
    firmwareVersion: (deviceFields.firmwareVersion ?? deviceFields.firmware_version) as string | undefined,
  };
}

function extractAssignedDevice(workerDocument: Record<string, unknown>): Device | undefined {
  const assignedDevice =
    workerDocument.assignedDevice ??
    workerDocument.device ??
    workerDocument.assigned_device;

  const topLevelDeviceId = workerDocument.deviceId ?? workerDocument.device_id;
  const topLevelStatus = workerDocument.deviceStatus ?? workerDocument.device_status;
  const topLevelBattery = workerDocument.batteryLevel ?? workerDocument.battery_level ?? workerDocument.battery;

  if (assignedDevice && typeof assignedDevice === 'object' && !Array.isArray(assignedDevice)) {
    return mapDeviceFields(assignedDevice as Record<string, unknown>, {
      deviceId: topLevelDeviceId,
      status: topLevelStatus,
      batteryLevel: topLevelBattery,
    });
  }

  const hasFlatDeviceData =
    (typeof topLevelDeviceId === 'string' && topLevelDeviceId.length > 0) ||
    (typeof topLevelStatus === 'string' && topLevelStatus.length > 0) ||
    (topLevelBattery != null && topLevelBattery !== '');

  if (hasFlatDeviceData) {
    return mapDeviceFields(
      typeof assignedDevice === 'string' ? { _id: assignedDevice } : {},
      {
        deviceId: topLevelDeviceId,
        status: topLevelStatus,
        batteryLevel: topLevelBattery,
      },
    );
  }

  return undefined;
}

function isAssignedDeviceIncomplete(device?: Device): boolean {
  if (!device) return true;
  if (!device.deviceId || device.deviceId === '—') return true;
  return looksLikeObjectId(device.deviceId) && device.batteryLevel === 0;
}

function extractDeviceList(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const responseBody = asObject(payload);
  if (!responseBody) return [];
  if (Array.isArray(responseBody.data)) return responseBody.data as Record<string, unknown>[];
  if (Array.isArray(responseBody.devices)) return responseBody.devices as Record<string, unknown>[];
  if (Array.isArray(responseBody.results)) return responseBody.results as Record<string, unknown>[];
  const nested = asObject(responseBody.data);
  if (nested) return extractDeviceList(nested);
  return [];
}

async function fetchAssignedDeviceForWorker(workerRecordId: string): Promise<Device | undefined> {
  try {
    const { data } = await apiClient.get('/devices', { params: { workerId: workerRecordId } });
    const [deviceDocument] = extractDeviceList(data);
    return deviceDocument ? mapDeviceFields(deviceDocument) : undefined;
  } catch {
    return undefined;
  }
}

function toWorkerQueryParams(filters?: WorkerFilters): Record<string, string> | undefined {
  if (!filters) return undefined;

  const queryParams: Record<string, string> = {};
  if (filters.status === 'ACTIVE' || filters.status === 'INACTIVE') {
    queryParams.status = filters.status;
  }
  if (filters.search) queryParams.search = filters.search;
  if (filters.department) queryParams.department = filters.department;
  return queryParams;
}

function normaliseWorker(workerDocument: Record<string, unknown>): Worker {
  const workerIdFromDocument = String(workerDocument._id ?? workerDocument.id ?? '');
  const device = extractAssignedDevice(workerDocument);

  let location: Worker['location'];
  const locationPayload =
    workerDocument.location ??
    workerDocument.lastKnownLocation ??
    workerDocument.lastLocation ??
    workerDocument.last_location;
  if (locationPayload && typeof locationPayload === 'object' && !Array.isArray(locationPayload)) {
    const locationFields = locationPayload as Record<string, unknown>;
    const latitude = Number(locationFields.latitude ?? locationFields.lat);
    const longitude = Number(locationFields.longitude ?? locationFields.lng ?? locationFields.lon);
    if (!Number.isNaN(latitude) && !Number.isNaN(longitude)) {
      location = {
        latitude,
        longitude,
        address: locationFields.address as string | undefined,
        zone: (locationFields.zone ?? locationFields.area) as string | undefined,
        timestamp: String(locationFields.timestamp ?? locationFields.updatedAt ?? new Date().toISOString()),
      };
    }
  }

  return {
    id: workerIdFromDocument,
    workerId: String(workerDocument.workerId ?? workerDocument.worker_id ?? workerDocument.employeeId ?? workerIdFromDocument),
    name: String(workerDocument.name ?? workerDocument.fullName ?? workerDocument.full_name ?? 'Unknown'),
    email: workerDocument.email as string | undefined,
    phone: (workerDocument.phone ?? workerDocument.phoneNumber) as string | undefined,
    department: workerDocument.department as string | undefined,
    role: workerDocument.role as string | undefined,
    status: normaliseWorkerStatus(workerDocument.status),
    device,
    deviceId: device?.deviceId ?? (workerDocument.deviceId ?? workerDocument.device_id) as string | undefined,
    location,
    lastActivity: String(
      workerDocument.lastActivity ??
      workerDocument.last_activity ??
      device?.lastSeen ??
      workerDocument.updatedAt ??
      workerDocument.lastSeen ??
      new Date().toISOString(),
    ),
    joinedAt: String(workerDocument.joinedAt ?? workerDocument.joined_at ?? workerDocument.createdAt ?? new Date().toISOString()),
    avatar: workerDocument.avatar as string | undefined,
  };
}

function normaliseWorkersResponse(payload: unknown): WorkersResponse {
  if (Array.isArray(payload)) {
    return {
      workers: payload as Worker[],
      total: payload.length,
      page: 1,
      pageSize: payload.length,
    };
  }

  const responseBody = payload as Record<string, unknown>;
  if (responseBody.data && typeof responseBody.data === 'object' && !Array.isArray(responseBody.data)) {
    return normaliseWorkersResponse(responseBody.data);
  }

  const workerDocuments: Record<string, unknown>[] = (
    (responseBody.workers as Record<string, unknown>[] | undefined) ??
    (responseBody.data as Record<string, unknown>[] | undefined) ??
    (responseBody.results as Record<string, unknown>[] | undefined) ??
    []
  );

  const workers = workerDocuments.map(normaliseWorker);
  const total =
    (responseBody.total as number | undefined) ??
    (responseBody.count as number | undefined) ??
    (responseBody.totalCount as number | undefined) ??
    workers.length;

  return {
    workers,
    total,
    page: (responseBody.page as number | undefined) ?? 1,
    pageSize: (responseBody.limit as number | undefined) ?? (responseBody.pageSize as number | undefined) ?? workers.length,
  };
}

export const workersApi = {
  getWorkers: async (filters?: WorkerFilters): Promise<WorkersResponse> => {
    const { data } = await apiClient.get('/workers', { params: toWorkerQueryParams(filters) });
    return normaliseWorkersResponse(data);
  },

  getWorker: async (id: string): Promise<Worker> => {
    const { data } = await apiClient.get(`/workers/${id}`);
    const responseBody = data as Record<string, unknown>;
    const workerDocument = (
      responseBody.data && typeof responseBody.data === 'object' && !Array.isArray(responseBody.data)
        ? responseBody.data
        : responseBody
    ) as Record<string, unknown>;
    const worker = normaliseWorker(workerDocument);
    if (!isAssignedDeviceIncomplete(worker.device)) return worker;

    const assignedDevice = await fetchAssignedDeviceForWorker(worker.id || id);
    if (!assignedDevice) return worker;

    return {
      ...worker,
      device: assignedDevice,
      deviceId: assignedDevice.deviceId,
    };
  },

  getWorkerActivity: async (id: string, limit = 20): Promise<WorkerActivity[]> => {
    try {
      const { data } = await apiClient.get(`/workers/${id}/activity`, { params: { limit } });
      if (Array.isArray(data)) return data as WorkerActivity[];
      const responseBody = data as Record<string, unknown>;
      return (responseBody.data ?? responseBody.activities ?? responseBody.events ?? []) as WorkerActivity[];
    } catch {
      return [];
    }
  },

  getDashboardStats: async (): Promise<DashboardStats> => {
    const { data } = await apiClient.get('/dashboard');
    const responseBody = data as Record<string, unknown>;
    const summary = (responseBody.data ?? responseBody.stats ?? data) as Record<string, unknown>;

    const deviceCounts = asObject(summary.devices);
    const incidentCounts = asObject(summary.incidents);
    const visualization = asObject(summary.visualization);
    const systemHealthPayload = summary.systemHealth;

    let systemHealth: DashboardStats['systemHealth'] = 'healthy';
    if (typeof systemHealthPayload === 'string') {
      systemHealth = (['healthy', 'degraded', 'critical'].includes(systemHealthPayload)
        ? systemHealthPayload
        : 'healthy') as DashboardStats['systemHealth'];
    } else if (systemHealthPayload && typeof systemHealthPayload === 'object') {
      const healthFields = systemHealthPayload as Record<string, unknown>;
      const isDatabaseConnected = String(healthFields.database ?? '').toLowerCase().includes('connect');
      systemHealth = isDatabaseConnected ? 'healthy' : 'critical';
    }

    const totalWorkers = toFiniteNumber(summary.workersTotal ?? summary.totalWorkers);
    const activeWorkers = toFiniteNumber(summary.activeWorkers);

    return {
      totalWorkers,
      activeWorkers,
      inactiveWorkers: toFiniteNumber(
        summary.inactiveWorkers ?? summary.offlineWorkers,
        Math.max(0, totalWorkers - activeWorkers),
      ),
      activeDevices: toFiniteNumber(
        deviceCounts?.online ?? deviceCounts?.active ?? summary.activeDevices ?? summary.onlineDevices,
      ),
      inactiveDevices: toFiniteNumber(
        deviceCounts?.offline ?? deviceCounts?.inactive ?? summary.inactiveDevices ?? summary.offlineDevices,
      ),
      openIncidents: toFiniteNumber(incidentCounts?.open ?? summary.openIncidents),
      criticalIncidents: toFiniteNumber(
        countCriticalIncidents(visualization) ?? summary.criticalIncidents ?? summary.criticalEvents,
      ),
      resolvedToday: toFiniteNumber(summary.resolvedToday ?? incidentCounts?.resolved),
      systemHealth,
      systemHealthDetails: typeof systemHealthPayload === 'object' && systemHealthPayload !== null
        ? systemHealthPayload as import('@/types').SystemHealthDetails
        : undefined,
      lastUpdated: (summary.lastUpdated as string) ?? new Date().toISOString(),
    };
  },
};
