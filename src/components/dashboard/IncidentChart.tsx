import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Card, CardHeader } from '@/components/common/Card';
import { SEVERITY_CONFIG } from '@/utils/constants';
import type { IncidentStats } from '@/types';

interface IncidentsByDayChartProps {
  data: IncidentStats['byDay'];
}

export function IncidentsByDayChart({ data }: IncidentsByDayChartProps) {
  return (
    <Card>
      <CardHeader title="Incidents by Day" subtitle="Last 7 days" />
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickFormatter={(dateValue: string) => {
              const date = new Date(dateValue);
              return date.toLocaleDateString('en-US', { weekday: 'short' });
            }}
          />
          <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--tooltip-bg, #1f2937)',
              borderColor: '#374151',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#f9fafb',
            }}
            labelFormatter={(dateValue: string) => new Date(dateValue).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          />
          <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Incidents" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

interface IncidentsBySeverityChartProps {
  data: IncidentStats['bySeverity'];
}

export function IncidentsBySeverityChart({ data }: IncidentsBySeverityChartProps) {
  const chartData = data.map((severityRow) => ({
    name: SEVERITY_CONFIG[severityRow.severity].label,
    value: severityRow.count,
    color: SEVERITY_CONFIG[severityRow.severity].color,
  }));

  return (
    <Card>
      <CardHeader title="By Severity" subtitle="All time distribution" />
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              borderColor: '#374151',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#f9fafb',
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(label) => <span style={{ fontSize: 12, color: '#9ca3af' }}>{label}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}
