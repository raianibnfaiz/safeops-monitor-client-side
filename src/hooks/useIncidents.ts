import { useState, useEffect, useCallback, useRef } from 'react';
import { incidentsApi } from '@/api';
import type { Incident, IncidentFilters, IncidentStats } from '@/types';

interface UseIncidentsResult {
  incidents: Incident[];
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

export function useIncidents(filters?: IncidentFilters): UseIncidentsResult {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [searchMatches, setSearchMatches] = useState<Incident[] | null>(null);
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
    status: filters?.status,
    severity: filters?.severity,
    type: filters?.type,
    workerId: filters?.workerId,
    search: searchTerm,
    page: isSearching ? 1 : requestedPage,
    limit: pageSize,
  });

  const latestFiltersRef = useRef(filters);
  latestFiltersRef.current = filters;

  useEffect(() => {
    const controller = new AbortController();

    const loadIncidents = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const currentFilters = latestFiltersRef.current;
        const currentSearch = currentFilters?.search?.trim() ?? '';

        if (currentSearch) {
          const result = await incidentsApi.searchIncidents(currentFilters, controller.signal);
          if (controller.signal.aborted) return;
          setSearchMatches(result.incidents);
          setTotal(result.total);
          setTotalPages(result.totalPages);
        } else {
          const result = await incidentsApi.getIncidents(currentFilters, controller.signal);
          if (controller.signal.aborted) return;
          setSearchMatches(null);
          setIncidents(result.incidents);
          setTotal(result.total);
          setTotalPages(result.totalPages);
        }
      } catch (requestError) {
        if (controller.signal.aborted || isCanceledRequest(requestError)) return;
        setError('Failed to load incidents.');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void loadIncidents();

    return () => controller.abort();
  }, [filtersKey, refreshToken]);

  const refetch = useCallback(() => {
    setRefreshToken((currentToken) => currentToken + 1);
  }, []);

  const visibleIncidents = isSearching && searchMatches
    ? searchMatches.slice((requestedPage - 1) * pageSize, requestedPage * pageSize)
    : incidents;
  const visibleTotal = isSearching && searchMatches ? searchMatches.length : total;
  const visibleTotalPages = isSearching && searchMatches
    ? Math.max(1, Math.ceil(searchMatches.length / pageSize) || 1)
    : totalPages;

  return {
    incidents: visibleIncidents,
    total: visibleTotal,
    totalPages: visibleTotalPages,
    page: requestedPage,
    isLoading,
    error,
    refetch,
  };
}

interface UseIncidentResult {
  incident: Incident | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  setIncident: (incident: Incident) => void;
}

// `initialIncident` lets callers pass in data they already have (e.g. from
// the list the user clicked through from) so the details page can render
// instantly instead of waiting on a full incident-list scan.
export function useIncident(id: string | undefined, initialIncident?: Incident | null): UseIncidentResult {
  const hasInitial = Boolean(initialIncident && initialIncident.id === id);
  const [incident, setIncident] = useState<Incident | null>(hasInitial ? initialIncident! : null);
  const [isLoading, setIsLoading] = useState(!hasInitial);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (options?: { silent?: boolean }) => {
    if (!id) return;
    if (!options?.silent) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const result = await incidentsApi.getIncident(id);
      setIncident(result);
      if (!options?.silent) setError(null);
    } catch {
      if (!options?.silent) setError('Failed to load incident details.');
    } finally {
      if (!options?.silent) setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetch({ silent: hasInitial });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return { incident, isLoading, error, refetch: () => fetch(), setIncident };
}

interface UseIncidentStatsResult {
  stats: IncidentStats | null;
  isLoading: boolean;
  refetch: () => void;
}

export function useIncidentStats(): UseIncidentStatsResult {
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await incidentsApi.getStats();
      setStats(result);
    } catch {
      // Stats are optional — the list page does not depend on this endpoint.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, isLoading, refetch: fetchStats };
}
