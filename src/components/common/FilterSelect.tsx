import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

export interface FilterSelectOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  value: string;
  onChange: (selectedValue: string) => void;
  options: FilterSelectOption[];
  icon?: React.ReactNode;
}

export function FilterSelect({ value, onChange, options, icon }: FilterSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className={clsx(
          'flex items-center py-2.5 pr-8 rounded-lg border text-sm cursor-pointer',
          'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
          'text-gray-900 dark:text-white',
          'focus:outline-none focus:ring-2 focus:ring-primary-500',
          icon ? 'pl-9' : 'pl-3',
        )}
      >
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">{icon}</span>
        )}
        <span className="whitespace-nowrap">{selectedOption?.label}</span>
        <ChevronDown
          className={clsx(
            'absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1 min-w-full py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value || 'all'}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={clsx(
                    'w-full text-left px-3 py-2 text-sm whitespace-nowrap',
                    isSelected
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700',
                  )}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
