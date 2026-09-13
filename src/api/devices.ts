import { apiClient } from './client';
import { workersApi } from './workers';
import { asObject } from '@/utils/objects';
import type { FieldDevice, DevicesResponse, Worker } from '@/types';

function extractId(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const record = asObject(value);
  if (!record) return String(value);
  return String(record._id ?? record.id ?? '');
}

const KNOWN_DEVICE_KEYS = new Set([
  '_id',
  'id',
  'deviceId',
  'device_id',
  'worker',
  'assignedTo',
  'assigned_to',
  'batteryLevel',
  'battery_level',
  'temperature',
  'geofenceStatus',
  'geofence_status',
  'status',
  'lastSeenAt',
  'last_seen_at',
  'lastSeen',
  'createdAt',
  'updatedAt',
  '__v',
]);

function extractDeviceList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const responseBody = asObject(payload);
  if (!responseBody) return [];
  const nestedPayload = asObject(responseBody.data);
  if (nestedPayload) return extractDeviceList(nestedPayload);
  if (Array.isArray(responseBody.devices)) return responseBody.devices;
  if (Array.isArray(responseBody.data)) return responseBody.data;
  if (Array.isArray(responseBody.results)) return responseBody.results;
  return [];
}

function normaliseDevice(payload: unknown): FieldDevice {
  const document = asObject(payload) ?? {};
  const extraFields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(document)) {
    if (!KNOWN_DEVICE_KEYS.has(key)) extraFields[key] = value;
  }

  const populatedWorker = asObject(document.worker);
  const populatedName = populatedWorker
    ? String(populatedWorker.name ?? populatedWorker.fullName ?? '')
    : '';

  return {
    id: String(document._id ?? document.id ?? ''),
    deviceId: String(document.deviceId ?? document.device_id ?? '—'),
    worker: extractId(document.worker),
    assignedTo: String(document.assignedTo ?? document.assigned_to ?? ''),
    assignedWorkerName: populatedName,
    assignedWorkerRecordId: extractId(document.worker) || undefined,
    batteryLevel: Number(document.batteryLevel ?? document.battery_level ?? 0),
    temperature: Number(document.temperature ?? 0),
    geofenceStatus: String(document.geofenceStatus ?? document.geofence_status ?? '—'),
    status: String(document.status ?? 'UNKNOWN'),
    lastSeenAt: String(document.lastSeenAt ?? document.last_seen_at ?? document.lastSeen ?? ''),
    createdAt: String(document.createdAt ?? ''),
    updatedAt: String(document.updatedAt ?? ''),
    version: typeof document.__v === 'number' ? document.__v : undefined,
    extraFields,
  };
}

function buildWorkerLookup(workers: Worker[]): {
  byWorkerId: Map<string, Worker>;
  byRecordId: Map<string, Worker>;
} {
  const byWorkerId = new Map<string, Worker>();
  const byRecordId = new Map<string, Worker>();

  for (const worker of workers) {
    if (worker.workerId) byWorkerId.set(worker.workerId, worker);
    if (worker.id) byRecordId.set(worker.id, worker);
  }

  return { byWorkerId, byRecordId };
}

function attachWorkerNames(devices: FieldDevice[], workers: Worker[]): FieldDevice[] {
  const { byWorkerId, byRecordId } = buildWorkerLookup(workers);

  return devices.map((device) => {
    const matchedWorker =
      (device.assignedTo && byWorkerId.get(device.assignedTo)) ||
      (device.worker && byRecordId.get(device.worker));

    if (!matchedWorker) return device;

    return {
      ...device,
      assignedWorkerName: matchedWorker.name,
      assignedWorkerRecordId: matchedWorker.id,
    };
  });
}

export const devicesApi = {
  getDevices: async (): Promise<DevicesResponse> => {
    const [{ data }, workersResult] = await Promise.all([
      apiClient.get('/devices'),
      workersApi.getWorkers({ limit: 500, page: 1 }).catch(() => ({
        workers: [] as Worker[],
        total: 0,
        page: 1,
        pageSize: 0,
      })),
    ]);

    const devices = extractDeviceList(data).map(normaliseDevice);
    const devicesWithWorkerNames = attachWorkerNames(devices, workersResult.workers);

    return { devices: devicesWithWorkerNames, total: devicesWithWorkerNames.length };
  },
};
