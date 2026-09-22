import { type HTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface TooltipProps extends HTMLAttributes<HTMLSpanElement> {
  tip: string;
  children: ReactNode;
}

export function TooltipLite({ tip, children, className, ...props }: TooltipProps) {
  return (
    <span className={cn('tooltip-lite', className)} data-tip={tip} {...props}>
      {children}
    </span>
  );
}

export interface TooltipLabelProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

export const TooltipLabel = forwardRef<HTMLSpanElement, TooltipLabelProps>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'pointer-events-none whitespace-nowrap rounded-md bg-fg px-2 py-1 text-xs font-medium text-bg',
        className
      )}
      {...props}
    />
  )
);

TooltipLabel.displayName = 'TooltipLabel';
