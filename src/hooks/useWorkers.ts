import { useState, useEffect, useCallback } from 'react';
import { workersApi } from '@/api';
import type { Worker, WorkerFilters } from '@/types';

interface UseWorkersResult {
  workers: Worker[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useWorkers(filters?: WorkerFilters): UseWorkersResult {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filtersKey = JSON.stringify(filters);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await workersApi.getWorkers(filters);
      setWorkers(result.workers);
      setTotal(result.total);
    } catch (err) {
      setError('Failed to load workers. Please try again.');
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { workers, total, isLoading, error, refetch: fetch };
}

interface UseWorkerResult {
  worker: Worker | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useWorker(id: string): UseWorkerResult {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await workersApi.getWorker(id);
      setWorker(result);
    } catch {
      setError('Failed to load worker details.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { worker, isLoading, error, refetch: fetch };
}
