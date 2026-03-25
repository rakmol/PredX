import { useQuery } from '@tanstack/react-query';

interface FearGreedResponse {
  data: Array<{ value: string; value_classification: string }>;
}

export function useFearGreed() {
  return useQuery({
    queryKey: ['fear-greed'],
    queryFn: async () => {
      const res = await fetch('https://api.alternative.me/fng/?limit=1');
      const json = await res.json() as FearGreedResponse;
      const entry = json.data[0];
      return {
        value: Number(entry.value),
        label: entry.value_classification,
      };
    },
    staleTime: 3_600_000,   // 1 hour — index updates once per day
    refetchInterval: 3_600_000,
  });
}
