import type { LucideIcon } from 'lucide-react';
import { type HTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
  compact?: boolean;
}

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon: Icon, title, description, actions, compact = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex-1 flex items-center justify-center',
        compact ? 'py-8' : 'py-12',
        className
      )}
      {...props}
    >
      <div className="text-center max-w-md px-4">
        <Icon
          className={cn('text-fg-subtle mx-auto mb-4', compact ? 'w-12 h-12' : 'w-16 h-16')}
          aria-hidden="true"
        />
        <h2 className="text-xl font-medium text-fg">{title}</h2>
        {description && <p className="text-fg-muted mt-2 leading-relaxed">{description}</p>}
        {actions && <div className="mt-4 flex items-center justify-center gap-3">{actions}</div>}
      </div>
    </div>
  )
);

EmptyState.displayName = 'EmptyState';
