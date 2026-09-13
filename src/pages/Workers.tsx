import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Filter, ChevronRight, MapPin, RefreshCw, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { Card } from '@/components/common/Card';
import { WorkerStatusBadge } from '@/components/common/Badge';
import { BatteryIndicator } from '@/components/common/BatteryIndicator';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { FilterSelect } from '@/components/common/FilterSelect';
import { SearchBar } from '@/components/common/SearchBar';
import { useSearchField } from '@/hooks/useSearchField';
import { useWorkers } from '@/hooks/useWorkers';
import { useSocketEvent } from '@/hooks/useSocket';
import { formatRelativeTime } from '@/utils/formatters';
import { PAGE_SIZE } from '@/utils/constants';
import type { WorkerStatus, WorkerFilters } from '@/types';

const STATUS_OPTIONS: { value: WorkerStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

export default function Workers() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [statusFilter, setStatusFilter] = useState<WorkerStatus | ''>('');
  const [page, setPage] = useState(1);
  const { appliedTerm, field: searchField } = useSearchField({
    initialValue: searchParams.get('search') ?? '',
    onTermChange: (term) => {
      setPage(1);
      setSearchParams(term ? { search: term } : {});
    },
  });

  const filters: WorkerFilters = {
    search: appliedTerm || undefined,
    status: statusFilter || undefined,
    page,
    limit: PAGE_SIZE,
  };

  const { workers, total, isLoading, error, refetch } = useWorkers(filters);

  // Real-time updates — backend emits 'safety:event' for worker changes
  useSocketEvent('safety:event', useCallback(() => {
    refetch();
  }, [refetch]));

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchBar field={searchField} placeholder="Search by name, ID, or device…" />

        <FilterSelect
          value={statusFilter}
          onChange={(selectedValue) => {
            setStatusFilter(selectedValue as WorkerStatus | '');
            setPage(1);
          }}
          options={STATUS_OPTIONS}
          icon={<Filter className="w-4 h-4 text-gray-400" />}
        />

        {/* Refresh */}
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Count */}
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Showing {workers.length} of {total} workers
      </p>

      {error && <ErrorAlert message={error} onRetry={refetch} />}

      {/* Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Worker
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                  Status
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                  Location
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                  Battery
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                  Last Activity
                </th>
                <th className="w-8 px-4 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {isLoading && workers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <LoadingSpinner size="lg" className="text-primary-600 mx-auto" />
                  </td>
                </tr>
              ) : workers.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={<Users className="w-6 h-6" />}
                      title="No workers found"
                      description={appliedTerm ? 'Try a different search term.' : 'No workers match the current filter.'}
                    />
                  </td>
                </tr>
              ) : (
                workers.map((worker) => (
                  <tr
                    key={worker.id || worker.workerId}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/workers/${worker.id}`)}
                  >
                    {/* Worker info */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-semibold text-primary-700 dark:text-primary-400">
                            {worker.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">{worker.name}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            ID: {worker.workerId}
                            {(worker.device?.deviceId || worker.deviceId) && (
                              <> · Device: {worker.device?.deviceId ?? worker.deviceId}</>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <WorkerStatusBadge status={worker.status} />
                    </td>

                    {/* Location */}
                    <td className="px-4 py-4 hidden md:table-cell">
                      {worker.location ? (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate max-w-[140px]">
                            {worker.location.zone ?? worker.location.address ?? `${worker.location.latitude.toFixed(3)}, ${worker.location.longitude.toFixed(3)}`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>

                    {/* Battery */}
                    <td className="px-4 py-4 hidden lg:table-cell">
                      {worker.device
                        ? <BatteryIndicator level={worker.device.batteryLevel} />
                        : <span className="text-xs text-gray-400">—</span>
                      }
                    </td>

                    {/* Last activity */}
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatRelativeTime(worker.lastActivity)}
                      </span>
                    </td>

                    {/* Arrow */}
                    <td className="px-4 py-4 text-right">
                      <ChevronRight className="w-4 h-4 text-gray-400 inline-block" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
