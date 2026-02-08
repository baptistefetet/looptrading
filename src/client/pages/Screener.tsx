import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { functionalUpdate, type OnChangeFn, type SortingState } from '@tanstack/react-table';
import { api } from '../lib/api';
import { ScreenerTable } from '../components/ScreenerTable';
import {
  DEFAULT_SCREENER_FILTERS,
  buildScreenerSearchParams,
  useScreener,
  type ScreenerFiltersState,
  type ScreenerResponse,
  type ScreenerSortBy,
} from '../hooks/useScreener';

function buildCsv(rows: ScreenerResponse['data']): string {
  const headers = [
    'Symbol',
    'Name',
    'Price',
    'ChangePct',
    'Score',
    'RSI',
    'AboveSMA50',
    'AboveSMA200',
    'VolumeRatio',
    'Market',
  ];

  const escape = (value: unknown): string => {
    if (value == null) return '';
    const stringValue = String(value);
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const lines = rows.map((row) =>
    [
      row.symbol,
      row.name,
      row.price.toFixed(2),
      row.change.toFixed(2),
      row.score ?? '',
      row.rsi ?? '',
      row.aboveSma50,
      row.aboveSma200,
      row.volume ?? '',
      row.market,
    ]
      .map(escape)
      .join(','),
  );

  return [headers.join(','), ...lines].join('\n');
}

export function Screener() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ScreenerFiltersState>(DEFAULT_SCREENER_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<ScreenerFiltersState>(DEFAULT_SCREENER_FILTERS);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'score', desc: true }]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [isExporting, setIsExporting] = useState(false);

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

  const exportCsv = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const allRows: ScreenerResponse['data'] = [];
      const chunkSize = 100;
      let offset = 0;
      let totalCount = 0;

      do {
        const params = buildScreenerSearchParams({
          filters: debouncedFilters,
          sortBy,
          sortOrder,
          pageIndex: 0,
          pageSize: chunkSize,
        });
        params.set('offset', String(offset));

        const response = await api.get<ScreenerResponse>(`/screener?${params.toString()}`);
        allRows.push(...response.data);
        totalCount = response.meta.total;
        offset += chunkSize;

        if (response.data.length === 0) break;
      } while (offset < totalCount);

      const csvContent = buildCsv(allRows);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:]/g, '-').slice(0, 19);
      link.href = url;
      link.download = `screener-${timestamp}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
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
        onExportCsv={exportCsv}
        isExporting={isExporting}
      />
    </div>
  );
}
