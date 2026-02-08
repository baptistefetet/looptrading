import { useMemo } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
} from '@tanstack/react-table';
import type { ScreenerFiltersState, ScreenerRow } from '../hooks/useScreener';

interface ScreenerTableProps {
  data: ScreenerRow[];
  total: number;
  isLoading: boolean;
  isFetching: boolean;
  errorMessage?: string;
  filters: ScreenerFiltersState;
  onFiltersChange: (next: ScreenerFiltersState) => void;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  pageIndex: number;
  pageSize: number;
  onPageIndexChange: (next: number) => void;
  onPageSizeChange: (next: number) => void;
  onRowClick: (symbol: string) => void;
  onExportCsv: () => void;
  isExporting: boolean;
}

function numberOrDash(value: number | null, digits: number = 2): string {
  if (value == null) return '-';
  return value.toFixed(digits);
}

function sortIndicator(state: false | 'asc' | 'desc'): string {
  if (state === 'asc') return '▲';
  if (state === 'desc') return '▼';
  return '↕';
}

export function ScreenerTable({
  data,
  total,
  isLoading,
  isFetching,
  errorMessage,
  filters,
  onFiltersChange,
  sorting,
  onSortingChange,
  pageIndex,
  pageSize,
  onPageIndexChange,
  onPageSizeChange,
  onRowClick,
  onExportCsv,
  isExporting,
}: ScreenerTableProps) {
  const columns = useMemo<ColumnDef<ScreenerRow>[]>(
    () => [
      {
        accessorKey: 'symbol',
        header: 'Symbol',
        cell: ({ row }) => (
          <span className="font-semibold text-neon-cyan">{row.original.symbol}</span>
        ),
      },
      { accessorKey: 'name', header: 'Name' },
      {
        accessorKey: 'price',
        header: 'Price',
        cell: ({ row }) => `$${row.original.price.toFixed(2)}`,
      },
      {
        accessorKey: 'change',
        header: 'Change %',
        cell: ({ row }) => {
          const value = row.original.change;
          const className = value >= 0 ? 'text-neon-green' : 'text-red-400';
          const sign = value >= 0 ? '+' : '';
          return <span className={className}>{`${sign}${value.toFixed(2)}%`}</span>;
        },
      },
      {
        accessorKey: 'score',
        header: 'Score',
        cell: ({ row }) => numberOrDash(row.original.score, 0),
      },
      {
        accessorKey: 'rsi',
        header: 'RSI',
        cell: ({ row }) => numberOrDash(row.original.rsi, 2),
      },
      {
        accessorKey: 'aboveSma50',
        header: 'vs SMA50',
        cell: ({ row }) => (
          <span className={row.original.aboveSma50 ? 'text-neon-green' : 'text-red-400'}>
            {row.original.aboveSma50 ? 'Above' : 'Below'}
          </span>
        ),
      },
      {
        accessorKey: 'aboveSma200',
        header: 'vs SMA200',
        cell: ({ row }) => (
          <span className={row.original.aboveSma200 ? 'text-neon-green' : 'text-red-400'}>
            {row.original.aboveSma200 ? 'Above' : 'Below'}
          </span>
        ),
      },
      {
        accessorKey: 'volume',
        header: 'Volume',
        cell: ({ row }) => numberOrDash(row.original.volume, 2),
      },
      { accessorKey: 'market', header: 'Market' },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableSortingRemoval: false,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(pageIndex + 1, totalPages);
  const pageStart = Math.max(1, currentPage - 2);
  const pageEnd = Math.min(totalPages, currentPage + 2);
  const pageNumbers = Array.from(
    { length: pageEnd - pageStart + 1 },
    (_, index) => pageStart + index,
  );

  const updateFilter = <K extends keyof ScreenerFiltersState>(
    key: K,
    value: ScreenerFiltersState[K],
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="card mt-8 border-neon-cyan/30 bg-dark-800/90 shadow-[0_0_20px_rgba(0,212,255,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-neon-cyan">
            Filtered Universe
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            {total} results {isFetching ? '· updating...' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onExportCsv}
          disabled={isExporting || total === 0}
          className="rounded border border-neon-cyan/50 px-3 py-1.5 text-xs font-medium text-neon-cyan transition hover:bg-neon-cyan/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        <input
          type="number"
          min={0}
          max={100}
          value={filters.minScore}
          onChange={(event) => updateFilter('minScore', event.target.value)}
          placeholder="Min score"
          className="rounded border border-dark-600 bg-dark-900 px-2 py-1.5 text-sm text-gray-100 focus:border-neon-cyan focus:outline-none"
        />
        <input
          type="number"
          min={0}
          max={100}
          value={filters.maxScore}
          onChange={(event) => updateFilter('maxScore', event.target.value)}
          placeholder="Max score"
          className="rounded border border-dark-600 bg-dark-900 px-2 py-1.5 text-sm text-gray-100 focus:border-neon-cyan focus:outline-none"
        />
        <input
          type="number"
          min={0}
          max={100}
          value={filters.minRsi}
          onChange={(event) => updateFilter('minRsi', event.target.value)}
          placeholder="Min RSI"
          className="rounded border border-dark-600 bg-dark-900 px-2 py-1.5 text-sm text-gray-100 focus:border-neon-cyan focus:outline-none"
        />
        <input
          type="number"
          min={0}
          max={100}
          value={filters.maxRsi}
          onChange={(event) => updateFilter('maxRsi', event.target.value)}
          placeholder="Max RSI"
          className="rounded border border-dark-600 bg-dark-900 px-2 py-1.5 text-sm text-gray-100 focus:border-neon-cyan focus:outline-none"
        />
        <select
          value={filters.aboveSma50}
          onChange={(event) =>
            updateFilter(
              'aboveSma50',
              event.target.value as ScreenerFiltersState['aboveSma50'],
            )
          }
          className="rounded border border-dark-600 bg-dark-900 px-2 py-1.5 text-sm text-gray-100 focus:border-neon-cyan focus:outline-none"
        >
          <option value="all">SMA50: all</option>
          <option value="true">SMA50: above</option>
          <option value="false">SMA50: below</option>
        </select>
        <select
          value={filters.aboveSma200}
          onChange={(event) =>
            updateFilter(
              'aboveSma200',
              event.target.value as ScreenerFiltersState['aboveSma200'],
            )
          }
          className="rounded border border-dark-600 bg-dark-900 px-2 py-1.5 text-sm text-gray-100 focus:border-neon-cyan focus:outline-none"
        >
          <option value="all">SMA200: all</option>
          <option value="true">SMA200: above</option>
          <option value="false">SMA200: below</option>
        </select>
        <input
          type="number"
          min={0}
          step="0.01"
          value={filters.minVolume}
          onChange={(event) => updateFilter('minVolume', event.target.value)}
          placeholder="Min vol ratio"
          className="rounded border border-dark-600 bg-dark-900 px-2 py-1.5 text-sm text-gray-100 focus:border-neon-cyan focus:outline-none"
        />
        <select
          value={filters.market}
          onChange={(event) =>
            updateFilter('market', event.target.value as ScreenerFiltersState['market'])
          }
          className="rounded border border-dark-600 bg-dark-900 px-2 py-1.5 text-sm text-gray-100 focus:border-neon-cyan focus:outline-none"
        >
          <option value="ALL">Market: all</option>
          <option value="US">Market: US</option>
          <option value="EU">Market: EU</option>
        </select>
      </div>

      <div className="mt-5 overflow-x-auto rounded border border-dark-600">
        <table className="min-w-full divide-y divide-dark-600 text-sm">
          <thead className="bg-dark-900/70 text-xs uppercase tracking-[0.08em] text-gray-400">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                    className={`px-3 py-2 text-left ${
                      header.column.getCanSort() ? 'cursor-pointer select-none hover:text-neon-cyan' : ''
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="text-[10px]">
                          {sortIndicator(header.column.getIsSorted())}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-dark-700">
            {isLoading && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-sm text-gray-500"
                >
                  Loading screener results...
                </td>
              </tr>
            )}
            {!isLoading && errorMessage && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-sm text-red-400"
                >
                  Failed to load screener: {errorMessage}
                </td>
              </tr>
            )}
            {!isLoading && !errorMessage && table.getRowModel().rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-sm text-gray-500"
                >
                  No results for current filters.
                </td>
              </tr>
            )}
            {!isLoading && !errorMessage && table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick(row.original.symbol)}
                className="cursor-pointer bg-dark-800/40 text-gray-200 transition hover:bg-dark-700/60"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-gray-400">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded border border-dark-600 bg-dark-900 px-2 py-1 text-gray-100 focus:border-neon-cyan focus:outline-none"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageIndexChange(Math.max(0, pageIndex - 1))}
            disabled={pageIndex === 0}
            className="rounded border border-dark-600 px-2 py-1 text-gray-300 hover:border-neon-cyan disabled:opacity-50"
          >
            Prev
          </button>
          {pageNumbers.map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => onPageIndexChange(page - 1)}
              className={`rounded border px-2 py-1 ${
                page === currentPage
                  ? 'border-neon-cyan text-neon-cyan'
                  : 'border-dark-600 text-gray-300 hover:border-neon-cyan'
              }`}
            >
              {page}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onPageIndexChange(Math.min(totalPages - 1, pageIndex + 1))}
            disabled={pageIndex >= totalPages - 1}
            className="rounded border border-dark-600 px-2 py-1 text-gray-300 hover:border-neon-cyan disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
