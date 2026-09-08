import { clsx } from 'clsx';
import { Battery, BatteryLow, BatteryWarning, BatteryFull, BatteryCharging } from 'lucide-react';

interface BatteryIndicatorProps {
  level: number;
  isCharging?: boolean;
  showLabel?: boolean;
  className?: string;
}

export function BatteryIndicator({
  level,
  isCharging,
  showLabel = true,
  className,
}: BatteryIndicatorProps) {
  const getIcon = () => {
    if (isCharging) return BatteryCharging;
    if (level >= 80) return BatteryFull;
    if (level >= 40) return Battery;
    if (level >= 20) return BatteryWarning;
    return BatteryLow;
  };

  const getColor = () => {
    if (isCharging) return 'text-blue-500';
    if (level >= 60) return 'text-green-500';
    if (level >= 30) return 'text-yellow-500';
    return 'text-red-500';
  };

  const Icon = getIcon();

  return (
    <span className={clsx('inline-flex items-center gap-1', className)}>
      <Icon className={clsx('w-4 h-4', getColor())} />
      {showLabel && (
        <span className={clsx('text-xs font-medium', getColor())}>{Math.round(level)}%</span>
      )}
    </span>
  );
}
