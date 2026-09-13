import { useCallback } from 'react';
import { useSocketEvent } from '@/hooks/useSocket';
import { useToast } from '@/contexts/ToastContext';
import { normaliseEvent } from '@/api/events';
import type { SafetyEvent } from '@/types';

/**
 * Mounted once at the app root (inside ToastProvider, outside <Routes>) so
 * that CRITICAL/HIGH safety alerts pop up as toasts no matter which page the
 * user is currently viewing, not just while on the Dashboard.
 *
 * Renders nothing — it only wires up the socket listener.
 */
export function GlobalAlertListener() {
  const { warning, error: toastError } = useToast();

  // The raw socket payload doesn't always match our SafetyEvent shape (e.g.
  // it may send `message` instead of `title`, or lowercase severity) —
  // normalise it the same way the REST /events response is normalised so
  // fields are never undefined in the toast text.
  useSocketEvent('safety:event', useCallback((payload: SafetyEvent) => {
    const event = normaliseEvent(payload as unknown as Record<string, unknown>);
    const severity = String(event.severity ?? '').toUpperCase();

    if (severity === 'CRITICAL') {
      toastError(`🚨 Critical: ${event.title}`, event.description);
    } else if (severity === 'HIGH') {
      warning(`⚠️ Alert: ${event.title}`, event.description);
    }
  }, [toastError, warning]));

  return null;
}
