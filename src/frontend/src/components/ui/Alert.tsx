import { AlertCircle, CheckCircle2, Info, type LucideIcon } from 'lucide-react';
import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'error' | 'success' | 'info';
}

const variantStyles = {
  error: 'bg-destructive/10 border-destructive/20 text-destructive',
  success: 'bg-success/10 border-success/20 text-success',
  info: 'bg-primary/10 border-primary/20 text-primary',
};

const variantIcons: Record<NonNullable<AlertProps['variant']>, LucideIcon> = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'error', children, ...props }, ref) => {
    const Icon = variantIcons[variant];
    return (
      <div
        ref={ref}
        role={variant === 'error' ? 'alert' : 'status'}
        className={cn(
          'flex items-center gap-2 p-3 border rounded-md text-sm',
          variantStyles[variant],
          className
        )}
        {...props}
      >
        <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        <span>{children}</span>
      </div>
    );
  }
);

Alert.displayName = 'Alert';
