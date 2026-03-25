import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  glow?: 'blue' | 'green' | 'red' | null;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, hover, glow, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-[#0D1526] border border-[#1E3050] rounded-xl',
        hover && 'card-hover',
        glow === 'blue'  && 'glow-blue',
        glow === 'green' && 'glow-green',
        glow === 'red'   && 'glow-red',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
Card.displayName = 'Card';
export default Card;
