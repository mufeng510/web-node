import { type HTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface PageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export const PageHeader = forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ className, title, description, actions, ...props }, ref) => (
    <div ref={ref} className={cn('p-4 border-b border-border', className)} {...props}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-fg truncate">{title}</h1>
          {description && <p className="text-sm text-fg-muted mt-0.5 truncate">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  )
);

PageHeader.displayName = 'PageHeader';
