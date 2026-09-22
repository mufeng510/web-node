import type { LucideIcon } from 'lucide-react';
import { type ReactNode, forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { Card, CardContent } from './Card';

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconClassName?: string;
  details?: ReactNode;
  className?: string;
}

export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  ({ title, value, icon: Icon, iconClassName, details, className }, ref) => (
    <Card ref={ref} className={className}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-fg-muted">{title}</p>
            <p className="text-xl font-semibold text-fg mt-1 break-words">{value}</p>
          </div>
          <Icon
            className={cn('w-8 h-8 flex-shrink-0 text-fg-muted', iconClassName)}
            aria-hidden="true"
          />
        </div>
        {details && <div className="mt-3 pt-3 border-t border-border space-y-1">{details}</div>}
      </CardContent>
    </Card>
  )
);

StatCard.displayName = 'StatCard';
