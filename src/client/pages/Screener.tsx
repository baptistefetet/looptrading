import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { functionalUpdate, type OnChangeFn, type SortingState } from '@tanstack/react-table';
import { ScreenerTable } from '../components/ScreenerTable';
import {
  DEFAULT_SCREENER_FILTERS,
  useScreener,
  type ScreenerFiltersState,
  type ScreenerSortBy,
} from '../hooks/useScreener';

export function Screener() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ScreenerFiltersState>(DEFAULT_SCREENER_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<ScreenerFiltersState>(DEFAULT_SCREENER_FILTERS);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'score', desc: true }]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedFilters(filters);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [filters]);

  const sortBy = (sorting[0]?.id as ScreenerSortBy | undefined) ?? 'score';
  const sortOrder: 'asc' | 'desc' = sorting[0]?.desc ? 'desc' : 'asc';

  const screenerQuery = useScreener({
    filters: debouncedFilters,
    sortBy,
    sortOrder,
    pageIndex,
    pageSize,
  });

  const total = screenerQuery.data?.meta.total ?? 0;
  const data = screenerQuery.data?.data ?? [];

  useEffect(() => {
    const maxPageIndex = Math.max(0, Math.ceil(total / pageSize) - 1);
    if (pageIndex > maxPageIndex) {
      setPageIndex(maxPageIndex);
    }
  }, [pageIndex, pageSize, total]);

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting((current) => {
      const next = functionalUpdate(updater, current);
      if (next.length === 0) return current;
      return [next[0]];
    });
    setPageIndex(0);
  };

  const handleFiltersChange = (next: ScreenerFiltersState) => {
    setFilters(next);
    setPageIndex(0);
  };

  const handlePageSizeChange = (next: number) => {
    setPageSize(next);
    setPageIndex(0);
  };

  const summaryLabel = useMemo(() => {
    if (total === 0) return 'No matching opportunities right now.';

    const from = pageIndex * pageSize + 1;
    const to = Math.min((pageIndex + 1) * pageSize, total);
    return `Showing ${from}-${to} of ${total} matching stocks.`;
  }, [pageIndex, pageSize, total]);

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-100">Screener</h1>
      <p className="mt-2 text-sm text-gray-400">
        Server-side filtered and sorted technical universe. {summaryLabel}
      </p>

      <ScreenerTable
        data={data}
        total={total}
        isLoading={screenerQuery.isLoading}
        isFetching={screenerQuery.isFetching}
        errorMessage={screenerQuery.error?.message}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        sorting={sorting}
        onSortingChange={handleSortingChange}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageIndexChange={setPageIndex}
        onPageSizeChange={handlePageSizeChange}
        onRowClick={(symbol) => navigate(`/stocks/${encodeURIComponent(symbol)}`)}
      />
    </div>
  );
}
