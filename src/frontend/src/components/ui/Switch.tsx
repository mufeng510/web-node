import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
  id?: string;
  disabled?: boolean;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, description, id, disabled, ...props }, ref) => {
    const switchId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const hasLabel = Boolean(label || description);

    return (
      <label
        className={cn(
          'inline-flex items-center gap-2 cursor-pointer',
          disabled && 'opacity-50 disabled:cursor-not-allowed',
          className
        )}
        htmlFor={switchId}
      >
        <div className="relative flex items-center">
          <input
            ref={ref}
            type="checkbox"
            id={switchId}
            disabled={disabled}
            className={cn(
              'peer appearance-none rounded-full border-2 transition-all duration-200 ease-in-out',
              // 未选中：较深的背景条，便于在浅色背景下辨认
              'bg-muted border-border',
              'peer-checked:bg-primary peer-checked:border-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'h-6 w-11',
              className
            )}
            {...props}
          />
          <span
            className={cn(
              'absolute left-1 top-1 rounded-full bg-fg shadow-sm transition-transform duration-200 ease-in-out',
              'h-4 w-4',
              'peer-checked:translate-x-6',
              disabled && 'opacity-50'
            )}
            aria-hidden="true"
          />
        </div>
        {hasLabel && (
          <div className="pt-0.5">
            {label && (
              <span className={cn('text-sm font-medium text-fg', disabled && 'text-fg-muted')}>
                {label}
              </span>
            )}
            {description && <p className="text-xs text-fg-muted mt-0.5">{description}</p>}
          </div>
        )}
      </label>
    );
  }
);

Switch.displayName = 'Switch';
