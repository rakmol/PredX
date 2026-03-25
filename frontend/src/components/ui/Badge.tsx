import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'brand';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-slate-500/20 border-slate-500/40 text-slate-300',
  success: 'bg-green-500/20 border-green-500/40 text-green-400',
  warning: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400',
  danger:  'bg-red-500/20 border-red-500/40 text-red-400',
  brand:   'bg-brand/20 border-brand/40 text-brand',
};

export default function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
