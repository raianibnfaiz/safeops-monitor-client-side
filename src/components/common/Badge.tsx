import { clsx } from 'clsx';
import type { IncidentSeverity, IncidentStatus, WorkerStatus } from '@/types';
import { SEVERITY_CONFIG, INCIDENT_STATUS_CONFIG, WORKER_STATUS_CONFIG } from '@/utils/constants';

interface SeverityBadgeProps {
  severity: IncidentSeverity;
  className?: string;
}

const UNKNOWN_BADGE = {
  label: 'Unknown',
  bgColor: 'bg-gray-100 dark:bg-gray-700',
  textColor: 'text-gray-500 dark:text-gray-400',
};

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const config = SEVERITY_CONFIG[severity] ?? { ...UNKNOWN_BADGE, color: '#9ca3af', borderColor: '' };
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
        config.bgColor,
        config.textColor,
        className,
      )}
    >
      {config.label}
    </span>
  );
}

interface StatusBadgeProps {
  status: IncidentStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = INCIDENT_STATUS_CONFIG[status] ?? UNKNOWN_BADGE;
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
        config.bgColor,
        config.textColor,
        className,
      )}
    >
      {config.label}
    </span>
  );
}

interface WorkerStatusBadgeProps {
  status: WorkerStatus;
  className?: string;
}

// Fallback config for any unrecognised status value coming from the backend
const UNKNOWN_STATUS_CONFIG = {
  label: 'Unknown',
  bgColor: 'bg-gray-100 dark:bg-gray-700',
  textColor: 'text-gray-500 dark:text-gray-400',
  dotColor: 'bg-gray-400',
};

export function WorkerStatusBadge({ status, className }: WorkerStatusBadgeProps) {
  const config = WORKER_STATUS_CONFIG[status] ?? UNKNOWN_STATUS_CONFIG;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold',
        config.bgColor,
        config.textColor,
        className,
      )}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full', config.dotColor)} />
      {config.label}
    </span>
  );
}

// Also add fallbacks to SeverityBadge and StatusBadge for robustness
