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
  const [searchMatches, setSearchMatches] = useState<SafetyEvent[] | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const searchTerm = filters?.search?.trim() ?? '';
  const isSearching = Boolean(searchTerm);
  const pageSize = filters?.limit ?? 20;
  const requestedPage = filters?.page ?? 1;

  const filtersKey = JSON.stringify({
    severity: filters?.severity,
    eventType: filters?.eventType,
    search: searchTerm,
    page: isSearching ? 1 : requestedPage,
    limit: pageSize,
  });

  const latestFiltersRef = useRef(filters);
  latestFiltersRef.current = filters;

  useEffect(() => {
    const controller = new AbortController();

    const loadEvents = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const currentFilters = latestFiltersRef.current;
        const currentSearch = currentFilters?.search?.trim() ?? '';

        if (currentSearch) {
          const result = await eventsApi.searchEvents(currentFilters, controller.signal);
          if (controller.signal.aborted) return;
          setSearchMatches(result.events);
          setTotal(result.total);
          setTotalPages(result.totalPages);
        } else {
          const result = await eventsApi.getEvents(currentFilters, controller.signal);
          if (controller.signal.aborted) return;
          setSearchMatches(null);
          setEvents(result.events);
          setTotal(result.total);
          setTotalPages(result.totalPages);
        }
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

  const visibleEvents = isSearching && searchMatches
    ? searchMatches.slice((requestedPage - 1) * pageSize, requestedPage * pageSize)
    : events;
  const visibleTotal = isSearching && searchMatches ? searchMatches.length : total;
  const visibleTotalPages = isSearching && searchMatches
    ? Math.max(1, Math.ceil(searchMatches.length / pageSize) || 1)
    : totalPages;

  return {
    events: visibleEvents,
    total: visibleTotal,
    totalPages: visibleTotalPages,
    page: requestedPage,
    isLoading,
    error,
    refetch,
  };
}

interface UseEventResult {
  event: SafetyEvent | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// `initialEvent` lets callers pass in data they already have (e.g. from the
// list the user clicked through from) so the details page can render
// instantly instead of waiting on a network round-trip.
export function useEvent(id: string | undefined, initialEvent?: SafetyEvent | null): UseEventResult {
  const hasInitial = Boolean(initialEvent && initialEvent.id === id);
  const [event, setEvent] = useState<SafetyEvent | null>(hasInitial ? initialEvent! : null);
  const [isLoading, setIsLoading] = useState(!hasInitial);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (options?: { silent?: boolean }) => {
    if (!id) return;
    if (!options?.silent) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const result = await eventsApi.getEvent(id);
      setEvent(result);
      if (!options?.silent) setError(null);
    } catch {
      if (!options?.silent) setError('Failed to load event details.');
    } finally {
      if (!options?.silent) setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetch({ silent: hasInitial });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return { event, isLoading, error, refetch: () => fetch() };
}
