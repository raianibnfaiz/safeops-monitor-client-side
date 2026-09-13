import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Smartphone, Clock, Activity, AlertTriangle, Battery } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader } from '@/components/common/Card';
import { WorkerStatusBadge, SeverityBadge, StatusBadge } from '@/components/common/Badge';
import { BatteryIndicator } from '@/components/common/BatteryIndicator';
import { PageLoader } from '@/components/common/LoadingSpinner';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { EmptyState } from '@/components/common/EmptyState';
import { LocationMap, hasValidCoordinates } from '@/components/common/LocationMap';
import { RecordId } from '@/components/common/RecordId';
import { useWorker } from '@/hooks/useWorkers';
import { useSocketEvent } from '@/hooks/useSocket';
import { incidentsApi } from '@/api';
import { formatRelativeTime, formatCoordinates } from '@/utils/formatters';
import { INCIDENT_TYPE_LABELS } from '@/utils/constants';
import type { DeviceStatus, Incident } from '@/types';

const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
};

function deviceStatusClassName(status: DeviceStatus): string {
  return status === 'ACTIVE'
    ? 'text-green-600 dark:text-green-400'
    : 'text-gray-500 dark:text-gray-400';
}

export default function WorkerDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { worker, isLoading, error, refetch } = useWorker(id!);

  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    if (!id) return;
    incidentsApi
      .getIncidents({ workerId: id, limit: 10 })
      .then((incidentsResponse) => {
        setIncidents(incidentsResponse.incidents.slice(0, 10));
      })
      .catch(() => {
        setIncidents([]);
      });
  }, [id]);

  // Real-time updates for this worker
  useSocketEvent('worker:status_changed', useCallback((data: { workerId: string }) => {
    if (data.workerId === id) refetch();
  }, [id, refetch]));

  useSocketEvent('worker:location_updated', useCallback((data: { workerId: string }) => {
    if (data.workerId === id) refetch();
  }, [id, refetch]));

  if (isLoading) return <PageLoader />;
  if (error || !worker) return <ErrorAlert message={error ?? 'Worker not found'} onRetry={refetch} />;

  const assignedDevice = worker.device;
  const isDeviceAssigned = Boolean(
    assignedDevice &&
    assignedDevice.deviceId &&
    assignedDevice.deviceId !== '—',
  );

  return (
    <div className="mx-auto w-full max-w-none space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/workers')}
        className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Workers
      </button>

      {/* Profile header */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-primary-700 dark:text-primary-400">
              {worker.name.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{worker.name}</h2>
              <WorkerStatusBadge status={worker.status} />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              <span>ID: <span className="font-mono">{worker.workerId}</span></span>
              {worker.department && <span>Dept: {worker.department}</span>}
              {worker.role && <span>Role: {worker.role}</span>}
              {worker.email && <span>{worker.email}</span>}
              {worker.phone && <span>{worker.phone}</span>}
            </div>
          </div>
        </div>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <InfoTile
          icon={<Smartphone className="w-4 h-4" />}
          label="Device ID"
          value={isDeviceAssigned ? assignedDevice?.deviceId : 'Unassigned'}
        />
        <InfoTile
          icon={<Activity className="w-4 h-4" />}
          label="Device Status"
          value={
            assignedDevice ? (
              <span className={deviceStatusClassName(assignedDevice.status)}>
                {DEVICE_STATUS_LABELS[assignedDevice.status]}
              </span>
            ) : (
              <span className="text-gray-400">—</span>
            )
          }
        />
        <InfoTile
          icon={<Battery className="w-4 h-4" />}
          label="Battery"
          value={
            isDeviceAssigned && assignedDevice
              ? <BatteryIndicator level={assignedDevice.batteryLevel} />
              : <span className="text-gray-400">—</span>
          }
        />
        <InfoTile
          icon={<Clock className="w-4 h-4" />}
          label="Last Active"
          value={formatRelativeTime(worker.lastActivity)}
        />
      </div>

      <Card>
        <CardHeader title="Last Known Location" />
        {worker.location && hasValidCoordinates(worker.location.latitude, worker.location.longitude) ? (
          <div className="space-y-3">
            {worker.location.zone && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="font-medium text-gray-900 dark:text-white">{worker.location.zone}</span>
              </div>
            )}
            {worker.location.address && (
              <p className="text-sm text-gray-500 dark:text-gray-400 pl-6">{worker.location.address}</p>
            )}
            <div className="font-mono text-xs text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-2">
              {formatCoordinates(worker.location.latitude, worker.location.longitude)}
            </div>
            <p className="text-xs text-gray-400">
              Updated {formatRelativeTime(worker.location.timestamp)}
            </p>
            <LocationMap
              latitude={worker.location.latitude}
              longitude={worker.location.longitude}
              label={[worker.name, worker.location.zone].filter(Boolean).join(' · ')}
            />
          </div>
        ) : (
          <EmptyState
            icon={<MapPin className="w-5 h-5" />}
            title="No location data"
            description="This worker's location has not been reported yet."
          />
        )}
      </Card>

      <Card>
        <div className="mb-6 flex flex-col items-center text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-primary-600 dark:text-primary-400">
            Safety record
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
            Recent Incidents
          </h3>
          <div className="mt-3 h-px w-20 bg-gradient-to-r from-transparent via-primary-400/80 to-transparent" />
        </div>
        {incidents.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle className="w-5 h-5" />}
            title="No incidents"
            description="This worker has no recorded incidents."
          />
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {incidents.map((incident) => (
              <div key={incident.id || incident.incidentId} className="py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {incident.title}
                    </span>
                    <SeverityBadge severity={incident.severity} />
                    <StatusBadge status={incident.status} />
                    <RecordId value={incident.id} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {INCIDENT_TYPE_LABELS[incident.type] ?? incident.type} · {formatRelativeTime(incident.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 mb-1.5">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-sm font-semibold text-gray-900 dark:text-white">{value}</div>
    </div>
  );
}
