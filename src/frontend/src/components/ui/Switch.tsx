import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, description, id, disabled, ...props }, ref) => {
    const switchId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <label className="flex items-start gap-3 cursor-pointer" htmlFor={switchId}>
        <div className="relative flex items-center">
          <input
            ref={ref}
            type="checkbox"
            id={switchId}
            disabled={disabled}
            className={cn(
              'peer h-5 w-5 appearance-none rounded-full border-2 border-border bg-bg',
              'checked:bg-primary checked:border-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors duration-150',
              'after:content-[""] after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-fg-subtle after:transition-transform after:duration-150',
              'peer-checked:after:translate-x-full peer-checked:after:bg-primary-fg',
              className
            )}
            {...props}
          />
        </div>
        <div className="pt-1">
          {label && (
            <span className={cn('text-sm font-medium text-fg', disabled && 'text-fg-muted')}>
              {label}
            </span>
          )}
          {description && <p className="text-xs text-fg-muted mt-0.5">{description}</p>}
        </div>
      </label>
    );
  }
);

Switch.displayName = 'Switch';
