import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface WatchlistRow {
  id: string;
  symbol: string;
  name: string;
  order: number;
  targetPriceHigh: number | null;
  targetPriceLow: number | null;
  notes: string | null;
  price: number | null;
  score: number | null;
  change: number | null;
}

interface WatchlistResponse {
  data: WatchlistRow[];
}

export function useWatchlist(limit = 8) {
  return useQuery({
    queryKey: ['watchlist', 'compact', limit],
    queryFn: () => api.get<WatchlistResponse>(`/watchlist?limit=${limit}`),
    refetchInterval: 30_000,
  });
}
