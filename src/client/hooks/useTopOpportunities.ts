import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface OpportunityRow {
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

interface TopOpportunitiesResponse {
  data: OpportunityRow[];
}

export function useTopOpportunities(limit = 5) {
  return useQuery({
    queryKey: ['screener', 'top-opportunities', limit],
    queryFn: () =>
      api.get<TopOpportunitiesResponse>(
        `/screener?sortBy=score&sortOrder=desc&limit=${limit}`,
      ),
    refetchInterval: 30_000,
  });
}
