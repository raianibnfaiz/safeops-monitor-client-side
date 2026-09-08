import type { IncidentSeverity, IncidentStatus, WorkerStatus } from '@/types';

export const SEVERITY_CONFIG: Record<
  IncidentSeverity,
  { label: string; color: string; bgColor: string; textColor: string; borderColor: string }
> = {
  CRITICAL: {
    label: 'Critical',
    color: '#dc2626',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    textColor: 'text-red-700 dark:text-red-400',
    borderColor: 'border-red-500',
  },
  HIGH: {
    label: 'High',
    color: '#ea580c',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    textColor: 'text-orange-700 dark:text-orange-400',
    borderColor: 'border-orange-500',
  },
  MEDIUM: {
    label: 'Medium',
    color: '#ca8a04',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    textColor: 'text-yellow-700 dark:text-yellow-400',
    borderColor: 'border-yellow-500',
  },
  LOW: {
    label: 'Low',
    color: '#16a34a',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-700 dark:text-green-400',
    borderColor: 'border-green-500',
  },
};

export const INCIDENT_STATUS_CONFIG: Record<
  IncidentStatus,
  { label: string; bgColor: string; textColor: string }
> = {
  OPEN: {
    label: 'Open',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    textColor: 'text-red-700 dark:text-red-400',
  },
  ACKNOWLEDGED: {
    label: 'Acknowledged',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    textColor: 'text-yellow-700 dark:text-yellow-400',
  },
  RESOLVED: {
    label: 'Resolved',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-700 dark:text-green-400',
  },
};

export const WORKER_STATUS_CONFIG: Record<
  WorkerStatus,
  { label: string; bgColor: string; textColor: string; dotColor: string }
> = {
  active: {
    label: 'Active',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-700 dark:text-green-400',
    dotColor: 'bg-green-500',
  },
  inactive: {
    label: 'Inactive',
    bgColor: 'bg-gray-100 dark:bg-gray-700',
    textColor: 'text-gray-600 dark:text-gray-400',
    dotColor: 'bg-gray-400',
  },
  offline: {
    label: 'Offline',
    bgColor: 'bg-slate-100 dark:bg-slate-700',
    textColor: 'text-slate-600 dark:text-slate-400',
    dotColor: 'bg-slate-400',
  },
  emergency: {
    label: 'Emergency',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    textColor: 'text-red-700 dark:text-red-400',
    dotColor: 'bg-red-500 animate-pulse',
  },
};

export const INCIDENT_TYPE_LABELS: Record<string, string> = {
  fall_detected: 'Fall Detected',
  sos_triggered: 'SOS Triggered',
  no_motion: 'No Motion',
  restricted_area: 'Restricted Area',
  equipment_fault: 'Equipment Fault',
  gas_leak: 'Gas Leak',
  fire_alert: 'Fire Alert',
  medical: 'Medical',
  other: 'Other',
};

export const PAGE_SIZE = 10;
