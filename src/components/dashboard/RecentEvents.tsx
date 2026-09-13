import { AlertTriangle, Wifi, WifiOff, CheckCircle, Radio, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { Card, CardHeader } from '@/components/common/Card';
import { RecordId } from '@/components/common/RecordId';
import { formatRelativeTime } from '@/utils/formatters';
import type { SafetyEvent, SafetyEventType } from '@/types';

const EVENT_ICON_MAP: Record<SafetyEventType, { icon: typeof AlertTriangle; color: string }> = {
  HIGH_TEMPERATURE: { icon: AlertTriangle, color: 'text-orange-500' },
  LOW_BATTERY: { icon: AlertTriangle, color: 'text-yellow-500' },
  FALL_DETECTED: { icon: AlertTriangle, color: 'text-orange-600' },
  NO_MOVEMENT: { icon: Radio, color: 'text-yellow-600' },
  GEOFENCE_BREACH: { icon: MapPin, color: 'text-orange-600' },
  SOS: { icon: AlertTriangle, color: 'text-red-600' },
  worker_online: { icon: Wifi, color: 'text-green-500' },
  worker_offline: { icon: WifiOff, color: 'text-gray-400' },
  incident_created: { icon: AlertTriangle, color: 'text-red-500' },
  incident_updated: { icon: Radio, color: 'text-blue-500' },
  incident_resolved: { icon: CheckCircle, color: 'text-green-500' },
  sos_alert: { icon: AlertTriangle, color: 'text-red-600' },
  fall_detected: { icon: AlertTriangle, color: 'text-orange-500' },
  low_battery: { icon: AlertTriangle, color: 'text-yellow-500' },
  location_update: { icon: MapPin, color: 'text-blue-400' },
  zone_breach: { icon: AlertTriangle, color: 'text-orange-600' },
};

const SEVERITY_DOT: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-500',
  WARNING: 'bg-yellow-500',
  MEDIUM: 'bg-yellow-500',
  LOW: 'bg-green-500',
  INFO: 'bg-blue-500',
};

interface RecentEventsProps {
  events: SafetyEvent[];
  isLoading?: boolean;
}

export function RecentEvents({ events, isLoading }: RecentEventsProps) {
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <CardHeader title="Recent Safety Events" subtitle="Live feed" className="mb-0" />
      </div>
      <div className="divide-y divide-gray-50 dark:divide-gray-700/50 max-h-[420px] overflow-y-auto">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-4">
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))
          : events.map((event, idx) => {
              const config = EVENT_ICON_MAP[event.type] ?? {
                icon: Radio,
                color: 'text-gray-400',
              };
              const Icon = config.icon;
              return (
                <div key={event.id ?? idx} className="flex items-start gap-3 px-6 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <Icon className={clsx('w-4 h-4', config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {event.title}
                      </p>
                      {event.severity && (
                        <span
                          className={clsx(
                            'flex-shrink-0 w-2 h-2 rounded-full',
                            SEVERITY_DOT[event.severity],
                          )}
                          title={event.severity}
                        />
                      )}
                      <RecordId value={event.id} />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {event.description}
                    </p>
                    {event.workerName && event.workerId ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Worker:{' '}
                        <Link
                          to={`/workers/${event.workerId}`}
                          className="text-primary-600 dark:text-primary-400 hover:underline"
                        >
                          {event.workerName}
                        </Link>
                      </p>
                    ) : event.workerName ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Worker: {event.workerName}
                      </p>
                    ) : null}
                  </div>
                  <span className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {formatRelativeTime(event.timestamp)}
                  </span>
                </div>
              );
            })}
        {!isLoading && events.length === 0 && (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">No recent events</p>
          </div>
        )}
      </div>
    </Card>
  );
}
