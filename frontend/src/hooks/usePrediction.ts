import { useQuery, useMutation } from '@tanstack/react-query';
import { predictionApi } from '@/lib/api';
import type { Horizon, Currency } from '@/types';

export function usePrediction(coinId: string, horizon: Horizon) {
  return useQuery({
    queryKey: ['prediction', coinId, horizon],
    queryFn: () => predictionApi.getPrediction(coinId, horizon),
    enabled: !!coinId,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useInvestmentAdvice() {
  return useMutation({
    mutationFn: ({
      coinId,
      amount,
      currency,
      horizon,
    }: {
      coinId: string;
      amount: number;
      currency: Currency;
      horizon: Horizon;
    }) => predictionApi.getInvestmentAdvice(coinId, amount, currency, horizon),
  });
}
