import { useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, CheckCircle2, RefreshCw } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card';
import { SeverityBadge, StatusBadge } from '@/components/common/Badge';
import { PageLoader, LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { RecordId } from '@/components/common/RecordId';
import { LocationMap, hasValidCoordinates } from '@/components/common/LocationMap';
import { useIncident } from '@/hooks/useIncidents';
import { incidentsApi } from '@/api';
import { useToast } from '@/contexts/ToastContext';
import { formatDateTime, formatRelativeTime } from '@/utils/formatters';
import { INCIDENT_TYPE_LABELS } from '@/utils/constants';
import type { Incident } from '@/types';

export default function IncidentDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const initialIncident = (location.state as { incident?: Incident } | null)?.incident;
  const { incident, isLoading, error, refetch, setIncident } = useIncident(id, initialIncident);
  const { success, error: toastError } = useToast();
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  if (isLoading) return <PageLoader />;
  if (error || !incident) return <ErrorAlert message={error ?? 'Incident not found'} onRetry={refetch} />;

  const acknowledge = async () => {
    setIsAcknowledging(true);
    try {
      const updated = await incidentsApi.acknowledgeIncident(incident.id);
      setIncident(updated);
      success('Incident acknowledged', incident.title);
    } catch {
      toastError('Failed to acknowledge incident');
    } finally {
      setIsAcknowledging(false);
    }
  };

  const resolve = async () => {
    setIsResolving(true);
    try {
      const updated = await incidentsApi.resolveIncident(incident.id);
      setIncident(updated);
      success('Incident resolved', incident.title);
    } catch {
      toastError('Failed to resolve incident');
    } finally {
      setIsResolving(false);
    }
  };

  const hasLocation = hasValidCoordinates(incident.location?.latitude, incident.location?.longitude);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <button
        onClick={() => navigate('/incidents')}
        className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Incidents
      </button>

      {/* Header */}
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{incident.title}</h2>
                <SeverityBadge severity={incident.severity} />
                <StatusBadge status={incident.status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <RecordId value={incident.id} />
                {incident.incidentId && incident.incidentId !== incident.id && (
                  <RecordId value={incident.incidentId} label="Incident ID" />
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={refetch}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <RefreshCw className={isLoading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              {incident.status === 'OPEN' && (
                <button
                  onClick={acknowledge}
                  disabled={isAcknowledging}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-60 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/40"
                >
                  {isAcknowledging ? <LoadingSpinner size="sm" /> : <Clock className="w-3.5 h-3.5" />}
                  Acknowledge
                </button>
              )}
              {(incident.status === 'OPEN' || incident.status === 'ACKNOWLEDGED') && (
                <button
                  onClick={resolve}
                  disabled={isResolving}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-60 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/40"
                >
                  {isResolving ? <LoadingSpinner size="sm" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Resolve
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {formatDateTime(incident.createdAt)}
            </span>
            <span>{INCIDENT_TYPE_LABELS[incident.type] ?? incident.type}</span>
            {incident.workerName && incident.workerId ? (
              <span>
                Worker:{' '}
                <Link
                  to={`/workers/${incident.workerId}`}
                  className="text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {incident.workerName}
                </Link>
              </span>
            ) : incident.workerName ? (
              <span>Worker: {incident.workerName}</span>
            ) : null}
            {incident.deviceId && <span>Device: {incident.deviceId}</span>}
          </div>
        </div>
      </Card>

      {/* Description */}
      {incident.description && (
        <Card>
          <CardHeader title="Description" />
          <p className="text-sm text-gray-700 dark:text-gray-300">{incident.description}</p>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader title="Timeline" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Created</p>
            <p className="font-medium text-gray-800 dark:text-gray-200">{formatDateTime(incident.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Acknowledged</p>
            {incident.acknowledgedAt ? (
              <>
                <p className="font-medium text-gray-800 dark:text-gray-200">{formatDateTime(incident.acknowledgedAt)}</p>
                {incident.acknowledgedBy && (
                  <p className="text-xs text-gray-400">by {incident.acknowledgedBy}</p>
                )}
              </>
            ) : (
              <p className="text-gray-400">—</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Resolved</p>
            {incident.resolvedAt ? (
              <>
                <p className="font-medium text-gray-800 dark:text-gray-200">{formatDateTime(incident.resolvedAt)}</p>
                {incident.resolvedBy && (
                  <p className="text-xs text-gray-400">by {incident.resolvedBy}</p>
                )}
              </>
            ) : (
              <p className="text-gray-400">—</p>
            )}
          </div>
        </div>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader title="Location" />
        {hasLocation ? (
          <div className="space-y-3">
            {incident.location?.zone && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="font-medium text-gray-900 dark:text-white">{incident.location.zone}</span>
              </div>
            )}
            {incident.location?.address && (
              <p className="text-sm text-gray-500 dark:text-gray-400 pl-6">{incident.location.address}</p>
            )}
            <LocationMap
              latitude={incident.location!.latitude!}
              longitude={incident.location!.longitude!}
              label={[incident.title, incident.location?.zone].filter(Boolean).join(' · ')}
            />
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">No location data recorded for this incident.</p>
        )}
      </Card>

      {/* Notes */}
      {incident.notes && incident.notes.length > 0 && (
        <Card>
          <CardHeader title="Notes" />
          <div className="space-y-2">
            {incident.notes.map((note) => (
              <div
                key={note.id || `${incident.id}-${note.createdAt}`}
                className="text-sm bg-gray-50 dark:bg-gray-700/40 rounded-lg p-3 border border-gray-100 dark:border-gray-700"
              >
                <p className="text-gray-700 dark:text-gray-300">{note.content}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {note.author} · {formatRelativeTime(note.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}