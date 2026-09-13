import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight, Filter, Radio, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { FilterSelect } from '@/components/common/FilterSelect';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { RecordId } from '@/components/common/RecordId';
import { SearchBar } from '@/components/common/SearchBar';
import { useSearchField } from '@/hooks/useSearchField';
import { useEvents } from '@/hooks/useEvents';
import { useSocketEvent } from '@/hooks/useSocket';
import { formatDateTime, formatRelativeTime } from '@/utils/formatters';
import { EVENT_SEVERITY_STYLES, INCIDENT_TYPE_LABELS } from '@/utils/constants';
import {
  EVENT_SEVERITIES,
  MONITOR_EVENT_TYPES,
  type EventFilters,
  type EventSeverity,
  type MonitorEventType,
} from '@/types';

const SEVERITY_OPTIONS: { value: EventSeverity | ''; label: string }[] = [
  { value: '', label: 'All Severities' },
  ...EVENT_SEVERITIES.map((severity) => ({
    value: severity,
    label: EVENT_SEVERITY_STYLES[severity]?.label ?? severity,
  })),
];

const TYPE_OPTIONS: { value: MonitorEventType | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  ...MONITOR_EVENT_TYPES.map((eventType) => ({
    value: eventType,
    label: INCIDENT_TYPE_LABELS[eventType] ?? eventType,
  })),
];

const EVENTS_PAGE_SIZE = 20;

function EventSeverityPill({ severity }: { severity?: string }) {
  if (!severity) return <span className="text-xs text-gray-400">—</span>;
  const styles = EVENT_SEVERITY_STYLES[severity] ?? {
    label: severity,
    bgColor: 'bg-gray-100 dark:bg-gray-700',
    textColor: 'text-gray-600 dark:text-gray-400',
  };

  return (
    <span
      className={clsx(
        'inline-flex px-2 py-0.5 rounded-full text-xs font-semibold',
        styles.bgColor,
        styles.textColor,
      )}
    >
      {styles.label}
    </span>
  );
}

export default function Events() {
  const navigate = useNavigate();
  const [severityFilter, setSeverityFilter] = useState<EventSeverity | ''>('');
  const [typeFilter, setTypeFilter] = useState<MonitorEventType | ''>('');
  const [page, setPage] = useState(1);
  const { appliedTerm, field: searchField } = useSearchField({
    onTermChange: () => setPage(1),
  });

  const filters: EventFilters = {
    search: appliedTerm || undefined,
    severity: severityFilter || undefined,
    eventType: typeFilter || undefined,
    page,
    limit: EVENTS_PAGE_SIZE,
  };

  const { events, total, totalPages, isLoading, error, refetch } = useEvents(filters);

  const currentPage = Math.min(page, Math.max(1, totalPages));

  const refetchTimerRef = useRef<number | null>(null);
  useSocketEvent('safety:event', useCallback(() => {
    if (refetchTimerRef.current) window.clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = window.setTimeout(() => {
      refetch();
    }, 400);
  }, [refetch]));

  useEffect(() => {
    setPage(1);
  }, [severityFilter, typeFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchBar field={searchField} placeholder="Search events by name or ID…" />

        <FilterSelect
          value={severityFilter}
          onChange={(selectedValue) => setSeverityFilter(selectedValue as EventSeverity | '')}
          options={SEVERITY_OPTIONS}
          icon={<AlertTriangle className="w-4 h-4 text-gray-400" />}
        />
        <FilterSelect
          value={typeFilter}
          onChange={(selectedValue) => setTypeFilter(selectedValue as MonitorEventType | '')}
          options={TYPE_OPTIONS}
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
        {total} event{total !== 1 ? 's' : ''} found
      </p>

      {error && <ErrorAlert message={error} onRetry={refetch} />}

      {isLoading ? (
        <Card className="flex flex-col items-center justify-center gap-3 py-20">
          <LoadingSpinner size="lg" className="text-primary-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading events…</p>
        </Card>
      ) : events.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Radio className="w-6 h-6" />}
            title="No events found"
            description="No safety events match the current filters."
          />
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {events.map((event) => (
              <div
                key={event.id}
                onClick={() => navigate(`/events/${event.id}`, { state: { event } })}
                className="px-5 py-4 flex items-start gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 flex-1 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-sm text-gray-900 dark:text-white">
                        {event.title}
                      </p>
                      <EventSeverityPill severity={event.severity} />
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {INCIDENT_TYPE_LABELS[event.type] ?? event.type.replace(/_/g, ' ')}
                      </span>
                      <RecordId value={event.id} />
                    </div>
                    {event.description && event.description !== event.title && (
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {event.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      {event.workerName && event.workerId ? (
                        <span>
                          Worker:{' '}
                          <Link
                            to={`/workers/${event.workerId}`}
                            onClick={(clickEvent) => clickEvent.stopPropagation()}
                            className="text-primary-600 dark:text-primary-400 hover:underline"
                          >
                            {event.workerName}
                          </Link>
                        </span>
                      ) : event.workerName ? (
                        <span>Worker: {event.workerName}</span>
                      ) : null}
                      {event.deviceId && <span>Device: {event.deviceId}</span>}
                      {event.incidentId && <span>Incident ID: {event.incidentId}</span>}
                      <span title={formatDateTime(event.timestamp)}>
                        {formatRelativeTime(event.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="text-gray-400 flex-shrink-0 mt-0.5 w-4 h-4" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={isLoading || currentPage === 1}
              className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={isLoading || currentPage === totalPages}
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
