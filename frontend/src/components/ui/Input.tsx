import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, prefix, suffix, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefix && (
            <div className="absolute left-3 text-slate-500 pointer-events-none">{prefix}</div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full bg-[#0D1526] border border-[#1E3050] rounded-lg text-sm text-slate-200',
              'placeholder-slate-500 focus:outline-none focus:border-brand transition-colors',
              'py-2.5',
              prefix ? 'pl-9 pr-3' : 'px-3',
              suffix ? 'pr-9' : '',
              error && 'border-red-500/60 focus:border-red-500',
              className,
            )}
            {...props}
          />
          {suffix && (
            <div className="absolute right-3 text-slate-500 pointer-events-none">{suffix}</div>
          )}
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';
export default Input;
