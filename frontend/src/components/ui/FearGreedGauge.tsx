// Fear & Greed Index gauge component

import { fearGreedColor } from '@/lib/utils';

interface Props {
  value: number;
  label: string;
  size?: 'sm' | 'md';
}

export default function FearGreedGauge({ value, label, size = 'md' }: Props) {
  const color = fearGreedColor(value);
  const radius = size === 'sm' ? 36 : 52;
  const strokeWidth = size === 'sm' ? 8 : 10;
  const circumference = Math.PI * radius; // half circle
  const offset = circumference - (value / 100) * circumference;
  const svgSize = (radius + strokeWidth) * 2;
  const center = radius + strokeWidth;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={svgSize}
        height={center + 4}
        style={{ overflow: 'visible' }}
      >
        {/* Background arc */}
        <path
          d={`M ${strokeWidth} ${center} A ${radius} ${radius} 0 0 1 ${svgSize - strokeWidth} ${center}`}
          fill="none"
          stroke="#1E3050"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={`M ${strokeWidth} ${center} A ${radius} ${radius} 0 0 1 ${svgSize - strokeWidth} ${center}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
        {/* Value text */}
        <text
          x={center}
          y={center - (size === 'sm' ? 8 : 10)}
          textAnchor="middle"
          fill={color}
          fontSize={size === 'sm' ? 18 : 26}
          fontWeight="bold"
          fontFamily="system-ui"
        >
          {value}
        </text>
      </svg>
      <span className={`font-semibold ${size === 'sm' ? 'text-xs' : 'text-sm'}`} style={{ color }}>
        {label}
      </span>
      {size === 'md' && (
        <span className="text-xs text-slate-500">Fear & Greed Index</span>
      )}
    </div>
  );
}
