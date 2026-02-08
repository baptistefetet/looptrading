import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface ScreenerRow {
  symbol: string;
  name: string;
  market: 'US' | 'EU';
  price: number;
  change: number;
  score: number | null;
  rsi: number | null;
  aboveSma50: boolean;
  aboveSma200: boolean;
  volume: number | null;
}

export type ScreenerSortBy =
  | 'score'
  | 'symbol'
  | 'name'
  | 'market'
  | 'price'
  | 'change'
  | 'rsi'
  | 'aboveSma50'
  | 'aboveSma200'
  | 'volume';

export interface ScreenerFiltersState {
  minScore: string;
  maxScore: string;
  minRsi: string;
  maxRsi: string;
  aboveSma50: 'all' | 'true' | 'false';
  aboveSma200: 'all' | 'true' | 'false';
  minVolume: string;
  market: 'ALL' | 'US' | 'EU';
}

export interface ScreenerQueryInput {
  filters: ScreenerFiltersState;
  sortBy: ScreenerSortBy;
  sortOrder: 'asc' | 'desc';
  pageIndex: number;
  pageSize: number;
}

export interface ScreenerResponse {
  data: ScreenerRow[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

export const DEFAULT_SCREENER_FILTERS: ScreenerFiltersState = {
  minScore: '',
  maxScore: '',
  minRsi: '',
  maxRsi: '',
  aboveSma50: 'all',
  aboveSma200: 'all',
  minVolume: '',
  market: 'ALL',
};

export function buildScreenerSearchParams(input: ScreenerQueryInput): URLSearchParams {
  const params = new URLSearchParams();
  const { filters } = input;

  if (filters.minScore !== '') params.set('minScore', filters.minScore);
  if (filters.maxScore !== '') params.set('maxScore', filters.maxScore);
  if (filters.minRsi !== '') params.set('minRsi', filters.minRsi);
  if (filters.maxRsi !== '') params.set('maxRsi', filters.maxRsi);
  if (filters.aboveSma50 !== 'all') params.set('aboveSma50', filters.aboveSma50);
  if (filters.aboveSma200 !== 'all') params.set('aboveSma200', filters.aboveSma200);
  if (filters.minVolume !== '') params.set('minVolume', filters.minVolume);
  if (filters.market !== 'ALL') params.set('market', filters.market);

  params.set('sortBy', input.sortBy);
  params.set('sortOrder', input.sortOrder);
  params.set('limit', String(input.pageSize));
  params.set('offset', String(input.pageIndex * input.pageSize));

  return params;
}

export function useScreener(input: ScreenerQueryInput) {
  const params = buildScreenerSearchParams(input).toString();

  return useQuery({
    queryKey: ['screener', params],
    queryFn: () => api.get<ScreenerResponse>(`/screener?${params}`),
    placeholderData: (previousData) => previousData,
  });
}
