import { type HTMLAttributes, forwardRef } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';

export interface SpinnerProps extends HTMLAttributes<HTMLOutputElement> {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const sizeStyles = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-[3px]',
};

export const Spinner = forwardRef<HTMLOutputElement, SpinnerProps>(
  ({ className, size = 'md', label, ...props }, ref) => {
    const { t } = useTranslation();
    const resolvedLabel = label ?? t('common.loading');
    return (
      <output
        ref={ref}
        aria-label={resolvedLabel}
        className={cn('inline-flex', className)}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn(
            'animate-spin rounded-full border-primary border-t-transparent',
            sizeStyles[size]
          )}
        />
        <span className="sr-only">{resolvedLabel}</span>
      </output>
    );
  }
);

Spinner.displayName = 'Spinner';
