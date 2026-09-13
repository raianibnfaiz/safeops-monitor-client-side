import { Search, X } from 'lucide-react';
import { clsx } from 'clsx';
import type { SearchField } from '@/hooks/useSearchField';

interface SearchBarProps {
  field: SearchField;
  placeholder?: string;
  className?: string;
}

export function SearchBar({
  field,
  placeholder = 'Search…',
  className,
}: SearchBarProps) {
  const hasValue = Boolean(field.value.trim());

  return (
    <form
      className={clsx('flex w-full min-w-0 flex-1 gap-2 sm:max-w-md', className)}
      onSubmit={(formEvent) => {
        formEvent.preventDefault();
        field.onSearch();
      }}
    >
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={field.value}
          onChange={(event) => field.onChange(event.target.value)}
          placeholder={placeholder}
          className={clsx(
            'w-full rounded-lg border py-2.5 pl-9 text-sm',
            hasValue ? 'pr-10' : 'pr-3',
            'border-gray-200 bg-white text-gray-900 placeholder-gray-400',
            'dark:border-gray-700 dark:bg-gray-800 dark:text-white',
            'focus:outline-none focus:ring-2 focus:ring-primary-500',
            '[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden',
          )}
          aria-label={placeholder}
        />
        {hasValue && (
          <button
            type="button"
            onClick={field.onClear}
            className={clsx(
              'absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md',
              'bg-slate-700 text-white hover:bg-slate-800',
              'dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white',
              'focus:outline-none focus:ring-2 focus:ring-slate-700 dark:focus:ring-slate-200',
            )}
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        )}
      </div>
      <button
        type="submit"
        className={clsx(
          'inline-flex shrink-0 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium',
          'bg-blue-900 text-white hover:bg-blue-950',
          'dark:bg-blue-900 dark:hover:bg-blue-950',
          'focus:outline-none focus:ring-2 focus:ring-blue-900',
        )}
      >
        Search
      </button>
    </form>
  );
}
