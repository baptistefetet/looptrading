import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface PortfolioPosition {
  id: string;
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

export interface PortfolioSummary {
  positions: PortfolioPosition[];
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercent: number;
}

interface PortfolioSummaryResponse {
  data: PortfolioSummary;
}

export function usePortfolioSummary() {
  return useQuery({
    queryKey: ['portfolio', 'summary'],
    queryFn: () => api.get<PortfolioSummaryResponse>('/portfolio/positions'),
    refetchInterval: 30_000,
  });
}
