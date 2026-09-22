import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  label: string;
  icon?: ReactNode;
  tip?: string;
}

export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  ({ className, active = false, label, icon, tip, children, ...props }, ref) => (
    <span className="tooltip-lite" data-tip={tip ?? label}>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        aria-pressed={active}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
          'disabled:opacity-50 disabled:pointer-events-none',
          active ? 'bg-primary/10 text-primary' : 'text-fg-muted hover:bg-bg-hover hover:text-fg',
          className
        )}
        {...props}
      >
        {icon}
        {children}
      </button>
    </span>
  )
);

ToolbarButton.displayName = 'ToolbarButton';
