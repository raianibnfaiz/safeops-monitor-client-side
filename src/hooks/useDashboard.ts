import { useState, useEffect, useCallback } from 'react';
import { workersApi, incidentsApi } from '@/api';
import type { DashboardStats, SafetyEvent } from '@/types';

interface UseDashboardResult {
  stats: DashboardStats | null;
  recentEvents: SafetyEvent[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDashboard(): UseDashboardResult {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentEvents, setRecentEvents] = useState<SafetyEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [dashStats, events, resolvedSummary, acknowledgedSummary] = await Promise.all([
        workersApi.getDashboardStats(),
        incidentsApi.getRecentEvents(15),
        incidentsApi.getResolvedSummary(),
        incidentsApi.getAcknowledgedSummary(),
      ]);
      setStats({
        ...dashStats,
        lastUpdated: resolvedSummary.lastResolvedAt ?? dashStats.lastUpdated,
        acknowledgedIncidents: acknowledgedSummary.count,
        lastAcknowledgedAt: acknowledgedSummary.lastAcknowledgedAt,
        lastAcknowledgedIncidentId: acknowledgedSummary.lastAcknowledgedIncidentId,
        lastResolvedAt: resolvedSummary.lastResolvedAt,
        lastResolvedIncidentId: resolvedSummary.lastResolvedIncidentId,
      });
      setRecentEvents(events);
    } catch {
      setError('Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { stats, recentEvents, isLoading, error, refetch: fetch };
}
