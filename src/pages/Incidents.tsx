import { useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Filter,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Card } from '@/components/common/Card';
import { SeverityBadge, StatusBadge } from '@/components/common/Badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { FilterSelect } from '@/components/common/FilterSelect';
import { RecordId } from '@/components/common/RecordId';
import { SearchBar } from '@/components/common/SearchBar';
import { useSearchField } from '@/hooks/useSearchField';
import { useIncidents } from '@/hooks/useIncidents';
import { useSocketEvent } from '@/hooks/useSocket';
import { incidentsApi } from '@/api';
import { useToast } from '@/contexts/ToastContext';
import { formatRelativeTime } from '@/utils/formatters';
import { INCIDENT_TYPE_LABELS } from '@/utils/constants';
import {
  INCIDENT_TYPES,
  INCIDENT_FILTER_SEVERITIES,
  type IncidentStatus,
  type IncidentSeverity,
  type IncidentType,
  type IncidentFilters,
  type Incident,
} from '@/types';

const STATUS_OPTIONS: { value: IncidentStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { value: 'RESOLVED', label: 'Resolved' },
];

const SEVERITY_OPTIONS: { value: IncidentSeverity | ''; label: string }[] = [
  { value: '', label: 'All Severities' },
  ...INCIDENT_FILTER_SEVERITIES.map((severity) => ({
    value: severity,
    label: severity === 'CRITICAL' ? 'Critical' : 'High',
  })),
];

const TYPE_OPTIONS: { value: IncidentType | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  ...INCIDENT_TYPES.map((type) => ({
    value: type,
    label: INCIDENT_TYPE_LABELS[type] ?? type,
  })),
];

const INCIDENTS_PAGE_SIZE = 20;

export default function Incidents() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | ''>('');
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | ''>('');
  const [typeFilter, setTypeFilter] = useState<IncidentType | ''>('');
  const [page, setPage] = useState(1);
  const { appliedTerm, field: searchField } = useSearchField({
    onTermChange: () => setPage(1),
  });
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const { success, error: toastError } = useToast();

  const apiFilters: IncidentFilters = {
    status: statusFilter || undefined,
    severity: severityFilter || undefined,
    type: typeFilter || undefined,
    search: appliedTerm || undefined,
    page,
    limit: INCIDENTS_PAGE_SIZE,
  };

  const {
    incidents,
    total,
    totalPages,
    isLoading,
    error,
    refetch,
  } = useIncidents(apiFilters);

  const currentPage = Math.min(page, Math.max(1, totalPages));

  const refetchTimerRef = useRef<number | null>(null);
  useSocketEvent('safety:incident', useCallback(() => {
    if (refetchTimerRef.current) window.clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = window.setTimeout(() => {
      refetch();
    }, 400);
  }, [refetch]));

  const runWithIncidentLoading = async (
    incidentId: string,
    actionName: 'acknowledge' | 'resolve',
    action: () => Promise<void>,
  ) => {
    const processingKey = `${incidentId}:${actionName}`;
    setProcessingIds((currentIds) => new Set(currentIds).add(processingKey));
    try {
      await action();
    } finally {
      setProcessingIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(processingKey);
        return nextIds;
      });
    }
  };

  const acknowledge = async (incident: Incident) => {
    await runWithIncidentLoading(incident.id, 'acknowledge', async () => {
      try {
        await incidentsApi.acknowledgeIncident(incident.id);
        success('Incident acknowledged', incident.title);
        refetch();
      } catch {
        toastError('Failed to acknowledge incident');
      }
    });
  };

  const resolve = async (incident: Incident) => {
    await runWithIncidentLoading(incident.id, 'resolve', async () => {
      try {
        await incidentsApi.resolveIncident(incident.id);
        success('Incident resolved', incident.title);
        refetch();
      } catch {
        toastError('Failed to resolve incident');
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchBar field={searchField} placeholder="Search incidents by name or ID…" />

        <FilterSelect
          value={statusFilter}
          onChange={(selectedValue) => { setStatusFilter(selectedValue as IncidentStatus | ''); setPage(1); }}
          options={STATUS_OPTIONS}
          icon={<Filter className="w-4 h-4 text-gray-400" />}
        />
        <FilterSelect
          value={severityFilter}
          onChange={(selectedValue) => { setSeverityFilter(selectedValue as IncidentSeverity | ''); setPage(1); }}
          options={SEVERITY_OPTIONS}
          icon={<AlertTriangle className="w-4 h-4 text-gray-400" />}
        />
        <FilterSelect
          value={typeFilter}
          onChange={(selectedValue) => { setTypeFilter(selectedValue as IncidentType | ''); setPage(1); }}
          options={TYPE_OPTIONS}
        />

        <button
          onClick={refetch}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        {total} incident{total !== 1 ? 's' : ''} found
      </p>

      {error && <ErrorAlert message={error} onRetry={refetch} />}

      {/* Incident list */}
      <div className="space-y-3">
        {isLoading ? (
          <Card className="flex flex-col items-center justify-center gap-3 py-20">
            <LoadingSpinner size="lg" className="text-primary-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading incidents…</p>
          </Card>
        ) : incidents.length === 0 ? (
          <Card>
            <EmptyState
              icon={<AlertTriangle className="w-6 h-6" />}
              title="No incidents found"
              description="No incidents match your current filters."
            />
          </Card>
        ) : (
          incidents.map((incident) => {
            const incidentKey = incident.id || incident.incidentId;
            const isAcknowledging = processingIds.has(`${incident.id}:acknowledge`);
            const isResolving = processingIds.has(`${incident.id}:resolve`);

            return (
              <Card
                key={incidentKey}
                padding="none"
                className={clsx(
                  'overflow-hidden transition-shadow hover:shadow-md',
                  incident.severity === 'CRITICAL' && 'border-l-4 border-l-red-500',
                  incident.severity === 'HIGH' && 'border-l-4 border-l-orange-500',
                  incident.severity === 'MEDIUM' && 'border-l-4 border-l-yellow-500',
                  incident.severity === 'LOW' && 'border-l-4 border-l-green-500',
                )}
              >
                {/* Header row */}
                <div
                  className="px-5 py-4 flex items-start gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors"
                  onClick={() => navigate(`/incidents/${incident.id}`, { state: { incident } })}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900 dark:text-white">
                        {incident.title}
                      </span>
                      <SeverityBadge severity={incident.severity} />
                      <StatusBadge status={incident.status} />
                      <RecordId value={incident.id} />
                      {incident.incidentId && incident.incidentId !== incident.id && (
                        <RecordId value={incident.incidentId} label="Incident ID" />
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(incident.createdAt)}
                      </span>
                      {incident.workerName && incident.workerId ? (
                        <span>
                          Worker:{' '}
                          <Link
                            to={`/workers/${incident.workerId}`}
                            onClick={(clickEvent) => clickEvent.stopPropagation()}
                            className="text-primary-600 dark:text-primary-400 hover:underline"
                          >
                            {incident.workerName}
                          </Link>
                        </span>
                      ) : incident.workerName ? (
                        <span>Worker: {incident.workerName}</span>
                      ) : null}
                      <span>{INCIDENT_TYPE_LABELS[incident.type] ?? incident.type}</span>
                      {incident.location?.zone && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {incident.location.zone}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {incident.status === 'OPEN' && (
                      <ActionButton
                        onClick={() => acknowledge(incident)}
                        loading={isAcknowledging}
                        color="yellow"
                        icon={<Clock className="w-3.5 h-3.5" />}
                        label="Acknowledge"
                      />
                    )}
                    {(incident.status === 'OPEN' || incident.status === 'ACKNOWLEDGED') && (
                      <ActionButton
                        onClick={() => resolve(incident)}
                        loading={isResolving}
                        color="green"
                        icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                        label="Resolve"
                      />
                    )}
                  </div>

                  <ChevronRight className="text-gray-400 flex-shrink-0 mt-0.5 w-4 h-4" />
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col items-center justify-center gap-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">Page {currentPage} of {totalPages}</p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={isLoading || currentPage === 1}
              className="px-4 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={isLoading || currentPage === totalPages}
              className="px-4 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionButton({
  onClick,
  loading,
  color,
  icon,
  label,
}: {
  onClick: () => void;
  loading: boolean;
  color: 'yellow' | 'green';
  icon: React.ReactNode;
  label: string;
}) {
  const colors = {
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/40',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/40',
  }[color];

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={clsx(
        'hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-60',
        colors,
      )}
    >
      {loading ? <LoadingSpinner size="sm" /> : icon}
      {label}
    </button>
  );
}
