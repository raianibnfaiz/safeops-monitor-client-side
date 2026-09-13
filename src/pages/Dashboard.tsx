import { useCallback, useRef } from 'react';
import { Users, Smartphone, AlertTriangle, ShieldAlert, Activity } from 'lucide-react';
import { clsx } from 'clsx';
import { StatCard } from '@/components/dashboard/StatCard';
import { RecentEvents } from '@/components/dashboard/RecentEvents';
import { Card, CardHeader } from '@/components/common/Card';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { PageLoader } from '@/components/common/LoadingSpinner';
import { useDashboard } from '@/hooks/useDashboard';
import { useSocketEvent } from '@/hooks/useSocket';
import { formatDateTime, formatRelativeTime } from '@/utils/formatters';
import type { DashboardStats } from '@/types';

export default function Dashboard() {
  const { stats, recentEvents, isLoading, error, refetch } = useDashboard();

  // Real-time stats update
  useSocketEvent('stats:updated', useCallback((data: DashboardStats) => {
    // In a real app, you'd update the stats state here
    console.log('[Dashboard] Stats updated:', data);
  }, []));

  // Note: toast notifications for `safety:event` alerts are handled globally
  // by <GlobalAlertListener /> (mounted in App.tsx) so they show up on every
  // page, not just the Dashboard.

  // Incident lifecycle events from backend. Debounced so a burst of
  // incidents arriving in quick succession triggers one refetch instead of
  // a request per event.
  const incidentRefetchTimerRef = useRef<number | null>(null);
  useSocketEvent('safety:incident', useCallback(() => {
    if (incidentRefetchTimerRef.current) window.clearTimeout(incidentRefetchTimerRef.current);
    incidentRefetchTimerRef.current = window.setTimeout(() => {
      refetch();
    }, 500);
  }, [refetch]));

  // System health banner
  const isHealthy = stats?.systemHealth === 'healthy';
  const isDegraded = stats?.systemHealth === 'degraded';

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorAlert message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      {/* System health banner */}
      {stats && !isHealthy && (
        <div
          className={clsx(
            'flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium',
            isDegraded
              ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-800 dark:text-red-300',
          )}
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          System is {String(stats.systemHealth)}. Some features may be limited.
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Total Workers"
          value={stats?.totalWorkers ?? 0}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Active Workers"
          value={stats?.activeWorkers ?? 0}
          icon={Activity}
          color="green"
        />
        <StatCard
          title="Active Devices"
          value={stats?.activeDevices ?? 0}
          icon={Smartphone}
          color="purple"
        />
        <StatCard
          title="Inactive Devices"
          value={stats?.inactiveDevices ?? 0}
          icon={Smartphone}
          color="orange"
        />
        <StatCard
          title="Open Incidents"
          value={stats?.openIncidents ?? 0}
          icon={AlertTriangle}
          color="red"
        />
        <StatCard
          title="Critical Incidents"
          value={stats?.criticalIncidents ?? 0}
          icon={ShieldAlert}
          color="red"
        />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 items-start lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentEvents events={recentEvents} isLoading={isLoading} />
        </div>

        <Card padding="sm" className="h-auto self-start">
          <CardHeader title="System Status" className="mb-3" />
          {stats && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Resolved</span>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {stats.resolvedToday}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Acknowledged</span>
                <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                  {stats.acknowledgedIncidents}
                </span>
              </div>
              <div className="flex justify-between gap-3 text-sm pt-1">
                <span className="text-gray-500 dark:text-gray-400">Last resolved</span>
                <span
                  className="font-semibold text-gray-900 dark:text-white"
                  title={stats.lastResolvedAt ? formatDateTime(stats.lastResolvedAt) : undefined}
                >
                  {stats.lastResolvedAt ? formatRelativeTime(stats.lastResolvedAt) : '—'}
                </span>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

