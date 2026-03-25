// Signal badge — strong buy / buy / hold / sell / strong sell

import { cn, signalBg, signalLabel } from '@/lib/utils';

interface Props {
  signal: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function SignalBadge({ signal, size = 'md' }: Props) {
  return (
    <span className={cn(
      'inline-flex items-center font-semibold border rounded-full tracking-wide',
      signalBg(signal),
      size === 'sm' && 'text-xs px-2 py-0.5',
      size === 'md' && 'text-sm px-3 py-1',
      size === 'lg' && 'text-base px-4 py-1.5',
    )}>
      {signalLabel(signal)}
    </span>
  );
}
