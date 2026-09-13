import { clsx } from 'clsx';

interface RecordIdProps {
  value?: string;
  label?: string;
  className?: string;
}

export function RecordId({ value, label = 'ID', className }: RecordIdProps) {
  if (!value) return null;

  return (
    <span
      title={value}
      className={clsx(
        'inline-flex max-w-full items-center truncate rounded-md px-1.5 py-0.5',
        'bg-slate-100 font-mono text-[11px] text-slate-700',
        'dark:bg-slate-700 dark:text-slate-100',
        className,
      )}
    >
      {label} {value}
    </span>
  );
}
