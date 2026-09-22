import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface StatusDotProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'success' | 'destructive' | 'primary' | 'muted';
  label?: string;
}

const dotStyles = {
  success: 'bg-success',
  destructive: 'bg-destructive',
  primary: 'bg-primary',
  muted: 'bg-fg-subtle',
};

const labelStyles = {
  success: 'text-success',
  destructive: 'text-destructive',
  primary: 'text-primary',
  muted: 'text-fg-muted',
};

export const StatusDot = forwardRef<HTMLSpanElement, StatusDotProps>(
  ({ className, tone = 'muted', label, ...props }, ref) => (
    <span ref={ref} className={cn('inline-flex items-center gap-1.5', className)} {...props}>
      <span
        aria-hidden="true"
        className={cn('w-2 h-2 rounded-full flex-shrink-0', dotStyles[tone])}
      />
      {label && <span className={cn('text-xs', labelStyles[tone])}>{label}</span>}
    </span>
  )
);

StatusDot.displayName = 'StatusDot';
