import { type HTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface SettingRowProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  description?: string;
  control?: ReactNode;
}

export const SettingRow = forwardRef<HTMLDivElement, SettingRowProps>(
  ({ className, label, description, control, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-between gap-4 py-3 border-b border-border last:border-0',
        className
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">{label}</p>
        {description && <p className="text-xs text-fg-muted mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">
        {control}
        {children}
      </div>
    </div>
  )
);

SettingRow.displayName = 'SettingRow';
