export function matchesSearch(
  values: Array<string | undefined | null>,
  searchTerm: string,
): boolean {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return true;

  return values
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase()
    .includes(term);
}

export async function fetchAllPages<T>(
  fetchPage: (
    page: number,
    limit: number,
    signal?: AbortSignal,
  ) => Promise<{ items: T[]; totalPages: number }>,
  options: { pageSize?: number; signal?: AbortSignal } = {},
): Promise<T[]> {
  const pageSize = options.pageSize ?? 100;
  const firstPage = await fetchPage(1, pageSize, options.signal);
  if (options.signal?.aborted) return firstPage.items;
  if (firstPage.totalPages <= 1) return firstPage.items;

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
      fetchPage(index + 2, pageSize, options.signal),
    ),
  );

  return firstPage.items.concat(...remainingPages.map((result) => result.items));
}
