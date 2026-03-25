// Mini sparkline for coin cards — uses recharts

import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { formatPrice } from '@/lib/utils';

interface Props {
  data: number[];
  positive: boolean;
}

export default function SparklineChart({ data, positive }: Props) {
  if (!data || data.length === 0) return null;

  const chartData = data.map((price, i) => ({ i, price }));
  const color = positive ? '#22C55E' : '#EF4444';

  return (
    <ResponsiveContainer width="100%" height={48}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="price"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="bg-[#0D1526] border border-[#1E3050] rounded px-2 py-1 text-xs text-slate-300">
                {formatPrice(payload[0].value as number)}
              </div>
            );
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
