import { useCallback } from 'react';
import { Users, Wifi, WifiOff, AlertTriangle, ShieldAlert, Activity } from 'lucide-react';
import { clsx } from 'clsx';
import { StatCard } from '@/components/dashboard/StatCard';
import { IncidentsByDayChart, IncidentsBySeverityChart } from '@/components/dashboard/IncidentChart';
import { RecentEvents } from '@/components/dashboard/RecentEvents';
import { Card, CardHeader } from '@/components/common/Card';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { PageLoader } from '@/components/common/LoadingSpinner';
import { useDashboard } from '@/hooks/useDashboard';
import { useIncidentStats } from '@/hooks/useIncidents';
import { useSocketEvent } from '@/hooks/useSocket';
import { useToast } from '@/contexts/ToastContext';
import { formatRelativeTime } from '@/utils/formatters';
import { useSocketContext } from '@/contexts/SocketContext';
import type { DashboardStats, SafetyEvent } from '@/types';

export default function Dashboard() {
  const { stats, recentEvents, isLoading, error, refetch } = useDashboard();
  const { stats: incidentStats } = useIncidentStats();
  const { warning, error: toastError } = useToast();
  const { isConnected } = useSocketContext();

  // Real-time stats update
  useSocketEvent('stats:updated', useCallback((data: DashboardStats) => {
    // In a real app, you'd update the stats state here
    console.log('[Dashboard] Stats updated:', data);
  }, []));

  // Real-time safety events from backend (primary socket event)
  useSocketEvent('safety:event', useCallback((event: SafetyEvent) => {
    if (event.severity === 'CRITICAL') {
      toastError(`🚨 Critical: ${event.title}`, event.description);
    } else if (event.severity === 'HIGH') {
      warning(`⚠️ Alert: ${event.title}`, event.description);
    }
  }, [toastError, warning]));

  // Incident lifecycle events from backend
  useSocketEvent('safety:incident', useCallback(() => {
    refetch();
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
          title="Online Devices"
          value={stats?.onlineDevices ?? 0}
          icon={Wifi}
          color="purple"
        />
        <StatCard
          title="Offline Devices"
          value={stats?.offlineDevices ?? 0}
          icon={WifiOff}
          color="orange"
        />
        <StatCard
          title="Open Incidents"
          value={stats?.openIncidents ?? 0}
          icon={AlertTriangle}
          color="red"
        />
        <StatCard
          title="Critical Alerts"
          value={stats?.criticalIncidents ?? 0}
          icon={ShieldAlert}
          color="red"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {incidentStats?.byDay ? (
            <IncidentsByDayChart data={incidentStats.byDay} />
          ) : (
            <Card>
              <CardHeader title="Incidents by Day" subtitle="Last 7 days" />
              <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">
                No chart data available
              </div>
            </Card>
          )}
        </div>
        <div>
          {incidentStats?.bySeverity ? (
            <IncidentsBySeverityChart data={incidentStats.bySeverity} />
          ) : (
            <Card>
              <CardHeader title="By Severity" />
              <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">
                No data available
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent events (2/3 width) */}
        <div className="lg:col-span-2">
          <RecentEvents events={recentEvents} isLoading={isLoading} />
        </div>

        {/* System status */}
        <Card>
          <CardHeader title="System Status" />
          <div className="space-y-4">
            {/* Database */}
            <StatusRow
              label="Database"
              status={
                stats?.systemHealthRaw
                  ? String(stats.systemHealthRaw.database).toLowerCase().includes('connect')
                    ? 'operational'
                    : 'down'
                  : isHealthy ? 'operational' : 'down'
              }
            />
            {/* Socket / WebSocket */}
            <StatusRow
              label="WebSocket"
              status={isConnected ? 'operational' : 'degraded'}
            />
            {/* Simulator */}
            <StatusRow
              label="Event Simulator"
              status={
                stats?.systemHealthRaw
                  ? stats.systemHealthRaw.simulator ? 'operational' : 'degraded'
                  : 'operational'
              }
            />
            {/* Backend API overall */}
            <StatusRow
              label="Backend API"
              status={isHealthy ? 'operational' : isDegraded ? 'degraded' : 'down'}
            />

            {/* Live metrics from systemHealthRaw */}
            {stats?.systemHealthRaw && (
              <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Clients connected</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {stats.systemHealthRaw.clientsConnected}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Uptime</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatUptime(stats.systemHealthRaw.uptimeSeconds)}
                  </span>
                </div>
              </div>
            )}

            {stats && (
              <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Resolved today</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {stats.resolvedToday}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Last updated</span>
                  <span>{formatRelativeTime(stats.lastUpdated)}</span>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

function StatusRow({ label, status }: { label: string; status: 'operational' | 'degraded' | 'down' }) {
  const config = {
    operational: { dot: 'bg-green-500', text: 'Operational', color: 'text-green-600 dark:text-green-400' },
    degraded: { dot: 'bg-yellow-500', text: 'Degraded', color: 'text-yellow-600 dark:text-yellow-400' },
    down: { dot: 'bg-red-500 animate-pulse', text: 'Down', color: 'text-red-600 dark:text-red-400' },
  }[status];

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={clsx('w-2 h-2 rounded-full', config.dot)} />
        <span className={clsx('text-xs font-medium', config.color)}>{config.text}</span>
      </div>
    </div>
  );
}
