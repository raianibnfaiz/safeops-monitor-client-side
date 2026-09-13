import { useCallback, useEffect, useRef, useState } from 'react';
import { eventsApi } from '@/api';
import type { EventFilters, SafetyEvent } from '@/types';

interface UseEventsResult {
  events: SafetyEvent[];
  total: number;
  totalPages: number;
  page: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

function isCanceledRequest(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const requestError = error as { code?: string; name?: string };
  return (
    requestError.code === 'ERR_CANCELED' ||
    requestError.name === 'CanceledError' ||
    requestError.name === 'AbortError'
  );
}

export function useEvents(filters?: EventFilters): UseEventsResult {
  const [events, setEvents] = useState<SafetyEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const filtersKey = JSON.stringify({
    severity: filters?.severity,
    eventType: filters?.eventType,
    page: filters?.page ?? 1,
    limit: filters?.limit ?? 20,
  });

  const latestFiltersRef = useRef(filters);
  latestFiltersRef.current = filters;

  useEffect(() => {
    const controller = new AbortController();

    const loadEvents = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await eventsApi.getEvents(latestFiltersRef.current, controller.signal);
        if (controller.signal.aborted) return;
        setEvents(result.events);
        setTotal(result.total);
        setTotalPages(result.totalPages);
        setPage(result.page);
      } catch (requestError) {
        if (controller.signal.aborted || isCanceledRequest(requestError)) return;
        setError('Failed to load events. Please try again.');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void loadEvents();

    return () => controller.abort();
  }, [filtersKey, refreshToken]);

  const refetch = useCallback(() => {
    setRefreshToken((currentToken) => currentToken + 1);
  }, []);

  return { events, total, totalPages, page, isLoading, error, refetch };
}
