import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface DashboardAlert {
  id: string;
  symbol: string;
  strategy: string;
  score: number | null;
  message: string;
  triggeredAt: string;
  acknowledged: boolean;
}

interface AlertsResponse {
  data: DashboardAlert[];
}

export function useAlerts(limit = 10) {
  return useQuery({
    queryKey: ['alerts', 'dashboard', limit],
    queryFn: () =>
      api.get<AlertsResponse>(`/alerts?acknowledged=false&limit=${limit}`),
    refetchInterval: 30_000,
  });
}
