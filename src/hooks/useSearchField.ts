import { useCallback, useRef, useState } from 'react';

export interface SearchField {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  onClear: () => void;
}

export interface UseSearchFieldOptions {
  initialValue?: string;
  onTermChange?: (term: string) => void;
}

export interface UseSearchFieldResult {
  appliedTerm: string;
  field: SearchField;
}

export function useSearchField(options: UseSearchFieldOptions = {}): UseSearchFieldResult {
  const { initialValue = '', onTermChange } = options;
  const startingTerm = initialValue.trim();

  const [inputValue, setInputValue] = useState(startingTerm);
  const [appliedTerm, setAppliedTerm] = useState(startingTerm);

  const inputValueRef = useRef(inputValue);
  const appliedTermRef = useRef(appliedTerm);
  const onTermChangeRef = useRef(onTermChange);
  inputValueRef.current = inputValue;
  appliedTermRef.current = appliedTerm;
  onTermChangeRef.current = onTermChange;

  const commitTerm = useCallback((term: string) => {
    const nextTerm = term.trim();
    setInputValue(nextTerm);
    if (appliedTermRef.current === nextTerm) return;
    setAppliedTerm(nextTerm);
    onTermChangeRef.current?.(nextTerm);
  }, []);

  const onChange = useCallback((nextValue: string) => {
    setInputValue(nextValue);
    if (!nextValue.trim()) {
      commitTerm('');
    }
  }, [commitTerm]);

  const onSearch = useCallback(() => {
    commitTerm(inputValueRef.current);
  }, [commitTerm]);

  const onClear = useCallback(() => {
    commitTerm('');
  }, [commitTerm]);

  return {
    appliedTerm,
    field: {
      value: inputValue,
      onChange,
      onSearch,
      onClear,
    },
  };
}
