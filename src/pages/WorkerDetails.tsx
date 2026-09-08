import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Smartphone, Clock, Activity, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader } from '@/components/common/Card';
import { WorkerStatusBadge, SeverityBadge, StatusBadge } from '@/components/common/Badge';
import { BatteryIndicator } from '@/components/common/BatteryIndicator';
import { PageLoader } from '@/components/common/LoadingSpinner';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { EmptyState } from '@/components/common/EmptyState';
import { useWorker } from '@/hooks/useWorkers';
import { useSocketEvent } from '@/hooks/useSocket';
import { workersApi, incidentsApi } from '@/api';
import { formatRelativeTime, formatCoordinates } from '@/utils/formatters';
import { INCIDENT_TYPE_LABELS } from '@/utils/constants';
import type { WorkerActivity, Incident } from '@/types';

export default function WorkerDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { worker, isLoading, error, refetch } = useWorker(id!);

  const [activities, setActivities] = useState<WorkerActivity[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoadingExtra(true);
    Promise.all([
      workersApi.getWorkerActivity(id),
      incidentsApi.getIncidents({ workerId: id, limit: 10 }),
    ])
      .then(([acts, incs]) => {
        setActivities(acts);
        setIncidents(incs.incidents);
      })
      .finally(() => setLoadingExtra(false));
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

  const ACTIVITY_ICONS: Record<WorkerActivity['type'], string> = {
    check_in: '✅',
    check_out: '🚪',
    location_update: '📍',
    sos: '🆘',
    fall_detected: '⚠️',
    device_connected: '📱',
    device_disconnected: '📴',
  };

  return (
    <div className="space-y-6 max-w-5xl">
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
          value={worker.device?.deviceId ?? worker.deviceId ?? '—'}
        />
        <InfoTile
          icon={<Activity className="w-4 h-4" />}
          label="Device Status"
          value={
            worker.device ? (
              <span className={clsx('capitalize', worker.device.status === 'online' ? 'text-green-600' : 'text-gray-500')}>
                {worker.device.status.replace('_', ' ')}
              </span>
            ) : (
              <span className="text-gray-400">Unknown</span>
            )
          }
        />
        <InfoTile
          icon={<span />}
          label="Battery"
          value={
            worker.device
              ? <BatteryIndicator level={worker.device.batteryLevel} />
              : <span className="text-gray-400">—</span>
          }
        />
        <InfoTile
          icon={<Clock className="w-4 h-4" />}
          label="Last Active"
          value={formatRelativeTime(worker.lastActivity)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Location */}
        <Card>
          <CardHeader title="Last Known Location" />
          {worker.location ? (
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

              {/* Simple coordinate visualization */}
              <div className="mt-4 h-32 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-100 dark:border-blue-800/30 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, #3b82f6 0px, transparent 1px, transparent 20px), repeating-linear-gradient(90deg, #3b82f6 0px, transparent 1px, transparent 20px)',
                  }}
                />
                <div className="relative flex flex-col items-center gap-1">
                  <div className="w-4 h-4 rounded-full bg-primary-600 border-2 border-white shadow-md" />
                  <p className="text-xs font-mono text-primary-700 dark:text-primary-400 bg-white dark:bg-gray-800 px-2 py-0.5 rounded shadow-sm">
                    {worker.location.latitude.toFixed(4)}, {worker.location.longitude.toFixed(4)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<MapPin className="w-5 h-5" />}
              title="No location data"
              description="This worker's location has not been reported yet."
            />
          )}
        </Card>

        {/* Activity feed */}
        <Card padding="none" className="overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <CardHeader title="Recent Activity" className="mb-0" />
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50 max-h-[360px] overflow-y-auto">
            {loadingExtra ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-6 py-3 flex gap-3">
                  <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/3" />
                  </div>
                </div>
              ))
            ) : activities.length === 0 ? (
              <EmptyState title="No activity" className="py-12" />
            ) : (
              activities.map((act) => (
                <div key={act.id} className="px-6 py-3 flex items-start gap-3">
                  <span className="text-base flex-shrink-0">{ACTIVITY_ICONS[act.type] ?? '•'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-gray-200">{act.description}</p>
                    <p className="text-xs text-gray-400">{formatRelativeTime(act.timestamp)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Incident history */}
      <Card>
        <CardHeader
          title="Incident History"
          subtitle={`${incidents.length} incident(s) for this worker`}
        />
        {incidents.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle className="w-5 h-5" />}
            title="No incidents"
            description="This worker has no recorded incidents."
          />
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {incidents.map((inc) => (
              <div key={inc.id} className="py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {inc.title}
                    </span>
                    <SeverityBadge severity={inc.severity} />
                    <StatusBadge status={inc.status} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {INCIDENT_TYPE_LABELS[inc.type] ?? inc.type} · {formatRelativeTime(inc.createdAt)}
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
