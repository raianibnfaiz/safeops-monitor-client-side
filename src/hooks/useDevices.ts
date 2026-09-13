import { useCallback, useEffect, useState } from 'react';
import { devicesApi } from '@/api';
import type { FieldDevice } from '@/types';

interface UseDevicesResult {
  devices: FieldDevice[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDevices(): UseDevicesResult {
  const [devices, setDevices] = useState<FieldDevice[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await devicesApi.getDevices();
      setDevices(result.devices);
      setTotal(result.total);
    } catch {
      setError('Failed to load devices. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  return { devices, total, isLoading, error, refetch: fetchDevices };
}
