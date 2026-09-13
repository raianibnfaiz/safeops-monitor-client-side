import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Clock, RefreshCw, Radio, MapPin } from 'lucide-react';
import { clsx } from 'clsx';
import { Card, CardHeader } from '@/components/common/Card';
import { PageLoader } from '@/components/common/LoadingSpinner';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { RecordId } from '@/components/common/RecordId';
import { LocationMap, hasValidCoordinates } from '@/components/common/LocationMap';
import { useEvent } from '@/hooks/useEvents';
import { formatDateTime, formatRelativeTime } from '@/utils/formatters';
import { EVENT_SEVERITY_STYLES, INCIDENT_TYPE_LABELS } from '@/utils/constants';
import type { SafetyEvent } from '@/types';

function EventSeverityPill({ severity }: { severity?: string }) {
  if (!severity) return null;
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

export default function EventDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const initialEvent = (location.state as { event?: SafetyEvent } | null)?.event;
  const { event, isLoading, error, refetch } = useEvent(id, initialEvent);

  if (isLoading) return <PageLoader />;
  if (error || !event) return <ErrorAlert message={error ?? 'Event not found'} onRetry={refetch} />;

  const latitude = event.location?.latitude;
  const longitude = event.location?.longitude;
  const hasLocation = hasValidCoordinates(latitude, longitude);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <button
        onClick={() => navigate('/events')}
        className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Events
      </button>

      {/* Header */}
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{event.title}</h2>
                <EventSeverityPill severity={event.severity} />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {INCIDENT_TYPE_LABELS[event.type] ?? event.type.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <RecordId value={event.id} />
                {event.incidentId && <RecordId value={event.incidentId} label="Incident ID" />}
              </div>
            </div>

            <button
              onClick={refetch}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
            >
              <RefreshCw className={isLoading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5" title={formatDateTime(event.timestamp)}>
              <Clock className="w-3.5 h-3.5" />
              {formatDateTime(event.timestamp)} · {formatRelativeTime(event.timestamp)}
            </span>
            {event.workerName && event.workerId ? (
              <span>
                Worker:{' '}
                <Link
                  to={`/workers/${event.workerId}`}
                  className="text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {event.workerName}
                </Link>
              </span>
            ) : event.workerName ? (
              <span>Worker: {event.workerName}</span>
            ) : null}
            {event.deviceId && <span>Device: {event.deviceId}</span>}
            {event.incidentId && (
              <Link
                to={`/incidents/${event.incidentId}`}
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                View related incident
              </Link>
            )}
          </div>
        </div>
      </Card>

      {/* Description */}
      {event.description && (
        <Card>
          <CardHeader title="Description" />
          <p className="text-sm text-gray-700 dark:text-gray-300">{event.description}</p>
        </Card>
      )}

      {/* Location */}
      {hasLocation && (
        <Card>
          <CardHeader title="Location" />
          <div className="space-y-3">
            {event.location?.zone && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="font-medium text-gray-900 dark:text-white">{event.location.zone}</span>
              </div>
            )}
            {event.location?.address && (
              <p className="text-sm text-gray-500 dark:text-gray-400 pl-6">{event.location.address}</p>
            )}
            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{latitude!.toFixed(5)}, {longitude!.toFixed(5)}</span>
            </div>
            <LocationMap
              latitude={latitude!}
              longitude={longitude!}
              label={[event.title, event.location?.zone].filter(Boolean).join(' · ')}
            />
          </div>
        </Card>
      )}

      {!event.description && !hasLocation && (
        <Card>
          <div className="flex flex-col items-center justify-center py-10 text-center text-gray-400">
            <Radio className="w-6 h-6 mb-2" />
            <p className="text-sm">No additional details available for this event.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
