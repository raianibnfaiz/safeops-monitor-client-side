import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Filter, RefreshCw, Search, Smartphone } from 'lucide-react';
import { clsx } from 'clsx';
import { Card } from '@/components/common/Card';
import { BatteryIndicator } from '@/components/common/BatteryIndicator';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { FilterSelect } from '@/components/common/FilterSelect';
import { useDevices } from '@/hooks/useDevices';
import { formatRelativeTime } from '@/utils/formatters';
import { PAGE_SIZE } from '@/utils/constants';
import type { FieldDevice } from '@/types';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

function matchesDeviceStatus(deviceStatus: string, statusFilter: string): boolean {
  if (!statusFilter) return true;
  const normalisedStatus = deviceStatus.toUpperCase();
  if (statusFilter === 'ACTIVE') {
    return normalisedStatus === 'ACTIVE' || normalisedStatus === 'ONLINE';
  }
  return normalisedStatus !== 'ACTIVE' && normalisedStatus !== 'ONLINE';
}

function StatusPill({ status }: { status: string }) {
  const normalised = status.toUpperCase();
  const styles =
    normalised === 'ACTIVE'
      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
      : normalised === 'OFFLINE' || normalised === 'INACTIVE'
        ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';

  return (
    <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-xs font-semibold', styles)}>
      {status || '—'}
    </span>
  );
}

function GeofencePill({ status }: { status: string }) {
  const isInside = status.toUpperCase() === 'INSIDE';
  return (
    <span
      className={clsx(
        'inline-flex px-2 py-0.5 rounded-full text-xs font-semibold',
        isInside
          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
          : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
      )}
    >
      {status || '—'}
    </span>
  );
}

function AssignedWorker({ device }: { device: FieldDevice }) {
  const workerLabel = device.assignedWorkerName || 'Unassigned';

  if (device.assignedWorkerRecordId) {
    return (
      <Link
        to={`/workers/${device.assignedWorkerRecordId}`}
        className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
      >
        {workerLabel}
      </Link>
    );
  }

  return <span className="text-gray-500 dark:text-gray-400">{workerLabel}</span>;
}

export default function Devices() {
  const { devices, total, isLoading, error, refetch } = useDevices();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const filteredDevices = useMemo(() => {
    const term = search.trim().toLowerCase();
    return devices.filter((device) => {
      if (!matchesDeviceStatus(device.status, statusFilter)) return false;
      if (!term) return true;
      const searchableText = [
        device.deviceId,
        device.assignedTo,
        device.assignedWorkerName,
        device.status,
        device.geofenceStatus,
      ]
        .join(' ')
        .toLowerCase();
      return searchableText.includes(term);
    });
  }, [devices, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredDevices.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedDevices = filteredDevices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search devices or workers…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={clsx(
              'w-full pl-9 pr-4 py-2.5 rounded-lg border text-sm',
              'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
              'text-gray-900 dark:text-white placeholder-gray-400',
              'focus:outline-none focus:ring-2 focus:ring-primary-500',
            )}
          />
        </div>
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS}
          icon={<Filter className="w-4 h-4 text-gray-400" />}
        />
        <button
          onClick={refetch}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Showing {paginatedDevices.length} of {filteredDevices.length} devices
        {(search || statusFilter) && filteredDevices.length !== total ? ` (filtered from ${total})` : ''}
      </p>

      {error && <ErrorAlert message={error} onRetry={refetch} />}

      {isLoading && devices.length === 0 ? (
        <Card className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" className="text-primary-600" />
        </Card>
      ) : filteredDevices.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Smartphone className="w-6 h-6" />}
            title="No devices found"
            description={search ? 'Try a different search term.' : 'No devices were returned by the API.'}
          />
        </Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {paginatedDevices.map((device) => (
              <Card key={device.id || device.deviceId} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{device.deviceId}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      ID: {device.assignedTo || '—'}
                    </p>
                  </div>
                  <StatusPill status={device.status} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Assigned worker</p>
                    <AssignedWorker device={device} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Battery</p>
                    <BatteryIndicator level={device.batteryLevel} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Temperature</p>
                    <p className="text-gray-800 dark:text-gray-200">
                      {Number.isFinite(device.temperature) ? `${device.temperature}°C` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Geofence</p>
                    <GeofencePill status={device.geofenceStatus} />
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  Last seen {device.lastSeenAt ? formatRelativeTime(device.lastSeenAt) : '—'}
                </p>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <Card padding="none" className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    {['Device ID', 'Assigned worker', 'Worker ID', 'Status', 'Battery', 'Temperature', 'Geofence', 'Last seen'].map((heading) => (
                      <th
                        key={heading}
                        className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {paginatedDevices.map((device) => (
                    <tr key={device.id || device.deviceId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        {device.deviceId}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <AssignedWorker device={device} />
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-gray-600 dark:text-gray-300">
                        {device.assignedTo || '—'}
                      </td>
                      <td className="px-4 py-4">
                        <StatusPill status={device.status} />
                      </td>
                      <td className="px-4 py-4">
                        <BatteryIndicator level={device.batteryLevel} />
                      </td>
                      <td className="px-4 py-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {Number.isFinite(device.temperature) ? `${device.temperature}°C` : '—'}
                      </td>
                      <td className="px-4 py-4">
                        <GeofencePill status={device.geofenceStatus} />
                      </td>
                      <td className="px-4 py-4 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {device.lastSeenAt ? formatRelativeTime(device.lastSeenAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {filteredDevices.length > PAGE_SIZE && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page === totalPages}
              className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
