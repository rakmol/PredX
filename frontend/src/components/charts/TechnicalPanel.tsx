import { useState } from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CoinHistoryPoint } from '@/types';
import { buildChartSeries, formatCompactVolume, formatTooltipDate, type ChartTimeframe } from './chartUtils';

interface TechnicalPanelProps {
  data: CoinHistoryPoint[];
  timeframe: ChartTimeframe;
  height?: number;
}

type PanelTab = 'RSI' | 'MACD' | 'Volume';

export default function TechnicalPanel({ data, timeframe, height = 240 }: TechnicalPanelProps) {
  const [tab, setTab] = useState<PanelTab>('RSI');
  const chartData = buildChartSeries(data, timeframe);

  return (
    <div className="rounded-2xl border border-[#1E3050] bg-[#08111F] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Technical Panel</h3>
          <p className="mt-1 text-xs text-slate-400">RSI, MACD, and volume from the selected chart window.</p>
        </div>
        <div className="flex rounded-xl border border-[#223556] bg-[#0D1526] p-1">
          {(['RSI', 'MACD', 'Volume'] as PanelTab[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTab(option)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                tab === option ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#17304F" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value: number) => chartData.find((point) => point.timestamp === value)?.label ?? ''}
              tick={{ fill: '#7C8CA5', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />

            {tab === 'RSI' && (
              <>
                <YAxis domain={[0, 100]} tick={{ fill: '#7C8CA5', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0]?.payload as (typeof chartData)[number];
                    return (
                      <div className="rounded-xl border border-[#223556] bg-[#07101D] px-4 py-3 shadow-2xl">
                        <p className="text-xs text-slate-400">{formatTooltipDate(point.timestamp, timeframe)}</p>
                        <p className="mt-2 text-sm font-semibold text-slate-100">RSI: {point.rsi?.toFixed(2) ?? 'N/A'}</p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={70} stroke="#EF4444" strokeDasharray="4 4" label={{ value: '70', fill: '#F87171', fontSize: 11 }} />
                <ReferenceLine y={30} stroke="#22C55E" strokeDasharray="4 4" label={{ value: '30', fill: '#4ADE80', fontSize: 11 }} />
                <Line dataKey="rsi" stroke="#38BDF8" strokeWidth={2} dot={false} connectNulls />
              </>
            )}

            {tab === 'MACD' && (
              <>
                <YAxis tick={{ fill: '#7C8CA5', fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0]?.payload as (typeof chartData)[number];
                    return (
                      <div className="rounded-xl border border-[#223556] bg-[#07101D] px-4 py-3 shadow-2xl">
                        <p className="text-xs text-slate-400">{formatTooltipDate(point.timestamp, timeframe)}</p>
                        <p className="mt-2 text-xs text-slate-300">MACD: {point.macd?.toFixed(4) ?? 'N/A'}</p>
                        <p className="text-xs text-slate-300">Signal: {point.macdSignal?.toFixed(4) ?? 'N/A'}</p>
                        <p className="text-xs text-slate-300">Histogram: {point.macdHistogram?.toFixed(4) ?? 'N/A'}</p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={0} stroke="#64748B" />
                <Bar dataKey="macdHistogram" name="Histogram" radius={[2, 2, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.timestamp} fill={(entry.macdHistogram ?? 0) >= 0 ? '#22C55E' : '#EF4444'} />
                  ))}
                </Bar>
                <Line dataKey="macd" name="MACD" stroke="#38BDF8" strokeWidth={2} dot={false} connectNulls />
                <Line dataKey="macdSignal" name="Signal" stroke="#F59E0B" strokeWidth={2} dot={false} connectNulls />
              </>
            )}

            {tab === 'Volume' && (
              <>
                <YAxis tickFormatter={(value: number) => formatCompactVolume(value)} tick={{ fill: '#7C8CA5', fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0]?.payload as (typeof chartData)[number];
                    return (
                      <div className="rounded-xl border border-[#223556] bg-[#07101D] px-4 py-3 shadow-2xl">
                        <p className="text-xs text-slate-400">{formatTooltipDate(point.timestamp, timeframe)}</p>
                        <p className="mt-2 text-xs text-slate-300">Volume: {formatCompactVolume(point.volume)}</p>
                        <p className="text-xs text-slate-300">Average: {point.avgVolume ? formatCompactVolume(point.avgVolume) : 'N/A'}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="volume" fill="#38BDF8" name="Volume" radius={[2, 2, 0, 0]} />
                <Line dataKey="avgVolume" name="Average Volume" stroke="#F59E0B" strokeWidth={2} dot={false} connectNulls />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
