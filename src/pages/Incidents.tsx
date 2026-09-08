import { useState, useCallback } from 'react';
import {
  AlertTriangle,
  Filter,
  RefreshCw,
  CheckCircle2,
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Card } from '@/components/common/Card';
import { SeverityBadge, StatusBadge } from '@/components/common/Badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { useIncidents } from '@/hooks/useIncidents';
import { useSocketEvent } from '@/hooks/useSocket';
import { incidentsApi } from '@/api';
import { useToast } from '@/contexts/ToastContext';
import { formatRelativeTime, formatDateTime } from '@/utils/formatters';
import { INCIDENT_TYPE_LABELS, PAGE_SIZE } from '@/utils/constants';
import type {
  IncidentStatus,
  IncidentSeverity,
  IncidentType,
  IncidentFilters,
  Incident,
} from '@/types';

const STATUS_OPTIONS: { value: IncidentStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { value: 'RESOLVED', label: 'Resolved' },
];

const SEVERITY_OPTIONS: { value: IncidentSeverity | ''; label: string }[] = [
  { value: '', label: 'All Severities' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

const TYPE_OPTIONS: { value: IncidentType | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  ...Object.entries(INCIDENT_TYPE_LABELS).map(([value, label]) => ({
    value: value as IncidentType,
    label,
  })),
];

export default function Incidents() {
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | ''>('');
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | ''>('');
  const [typeFilter, setTypeFilter] = useState<IncidentType | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const { success, error: toastError } = useToast();

  const filters: IncidentFilters = {
    status: statusFilter || undefined,
    severity: severityFilter || undefined,
    type: typeFilter || undefined,
    search: search || undefined,
    page,
    limit: PAGE_SIZE,
  };

  const { incidents, total, isLoading, error, refetch } = useIncidents(filters);

  // Real-time updates — backend emits 'safety:incident' for incident changes
  useSocketEvent('safety:incident', useCallback(() => {
    refetch();
  }, [refetch]));

  // Also listen to general safety events that may affect incident list
  useSocketEvent('safety:event', useCallback(() => {
    refetch();
  }, [refetch]));

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const withLoading = async (id: string, fn: () => Promise<void>) => {
    setProcessingIds((s) => new Set(s).add(id));
    try {
      await fn();
    } finally {
      setProcessingIds((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  };

  const acknowledge = async (incident: Incident) => {
    await withLoading(incident.id, async () => {
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
    await withLoading(incident.id, async () => {
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
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search incidents…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <FilterSelect
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v as IncidentStatus | ''); setPage(1); }}
          options={STATUS_OPTIONS}
          icon={<Filter className="w-4 h-4 text-gray-400" />}
        />
        <FilterSelect
          value={severityFilter}
          onChange={(v) => { setSeverityFilter(v as IncidentSeverity | ''); setPage(1); }}
          options={SEVERITY_OPTIONS}
          icon={<AlertTriangle className="w-4 h-4 text-gray-400" />}
        />
        <FilterSelect
          value={typeFilter}
          onChange={(v) => { setTypeFilter(v as IncidentType | ''); setPage(1); }}
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
        {isLoading && incidents.length === 0 ? (
          <Card className="flex items-center justify-center py-20">
            <LoadingSpinner size="lg" className="text-primary-600" />
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
            const isExpanded = expandedId === incident.id;
            const isProcessing = processingIds.has(incident.id);

            return (
              <Card
                key={incident.id}
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
                  onClick={() => setExpandedId(isExpanded ? null : incident.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900 dark:text-white">
                        {incident.title}
                      </span>
                      <SeverityBadge severity={incident.severity} />
                      <StatusBadge status={incident.status} />
                      <span className="text-xs font-mono text-gray-400 hidden sm:inline">
                        #{incident.incidentId}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(incident.createdAt)}
                      </span>
                      {incident.workerName && <span>Worker: {incident.workerName}</span>}
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
                        loading={isProcessing}
                        color="yellow"
                        icon={<Clock className="w-3.5 h-3.5" />}
                        label="Acknowledge"
                      />
                    )}
                    {(incident.status === 'OPEN' || incident.status === 'ACKNOWLEDGED') && (
                      <ActionButton
                        onClick={() => resolve(incident)}
                        loading={isProcessing}
                        color="green"
                        icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                        label="Resolve"
                      />
                    )}
                  </div>

                  <button className="text-gray-400 flex-shrink-0 mt-0.5">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-4 bg-gray-50/50 dark:bg-gray-800/30 space-y-4">
                    {incident.description && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Description</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{incident.description}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Created</p>
                        <p className="font-medium text-gray-800 dark:text-gray-200">{formatDateTime(incident.createdAt)}</p>
                      </div>
                      {incident.acknowledgedAt && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Acknowledged</p>
                          <p className="font-medium text-gray-800 dark:text-gray-200">{formatDateTime(incident.acknowledgedAt)}</p>
                          {incident.acknowledgedBy && (
                            <p className="text-xs text-gray-400">by {incident.acknowledgedBy}</p>
                          )}
                        </div>
                      )}
                      {incident.resolvedAt && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Resolved</p>
                          <p className="font-medium text-gray-800 dark:text-gray-200">{formatDateTime(incident.resolvedAt)}</p>
                          {incident.resolvedBy && (
                            <p className="text-xs text-gray-400">by {incident.resolvedBy}</p>
                          )}
                        </div>
                      )}
                      {incident.location && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Location</p>
                          <p className="font-medium text-gray-800 dark:text-gray-200">
                            {incident.location.zone ?? incident.location.address ?? 'Unknown'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    {incident.notes && incident.notes.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Notes</p>
                        <div className="space-y-2">
                          {incident.notes.map((note) => (
                            <div key={note.id} className="text-sm bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                              <p className="text-gray-700 dark:text-gray-300">{note.content}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                {note.author} · {formatRelativeTime(note.createdAt)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  icon?: React.ReactNode;
}) {
  return (
    <div className="relative">
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">{icon}</div>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(
          'py-2.5 pr-8 rounded-lg border text-sm appearance-none cursor-pointer',
          'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
          'text-gray-900 dark:text-white',
          'focus:outline-none focus:ring-2 focus:ring-primary-500',
          icon ? 'pl-9' : 'pl-3',
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
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
