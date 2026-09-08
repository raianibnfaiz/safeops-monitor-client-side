import { useState, useEffect, useCallback } from 'react';
import { incidentsApi } from '@/api';
import type { Incident, IncidentFilters, IncidentStats } from '@/types';

interface UseIncidentsResult {
  incidents: Incident[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useIncidents(filters?: IncidentFilters): UseIncidentsResult {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filtersKey = JSON.stringify(filters);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await incidentsApi.getIncidents(filters);
      setIncidents(result.incidents);
      setTotal(result.total);
    } catch {
      setError('Failed to load incidents.');
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { incidents, total, isLoading, error, refetch: fetch };
}

interface UseIncidentStatsResult {
  stats: IncidentStats | null;
  isLoading: boolean;
  refetch: () => void;
}

export function useIncidentStats(): UseIncidentStatsResult {
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await incidentsApi.getStats();
      setStats(result);
    } catch {
      // silently fail stats
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { stats, isLoading, refetch: fetch };
}
