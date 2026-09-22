import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'secondary' | 'primary';
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'ghost', size = 'md', type = 'button', ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 disabled:pointer-events-none';

    const variantStyles = {
      ghost: 'text-fg-muted hover:text-fg hover:bg-bg-hover',
      secondary: 'bg-bg-elevated text-fg border border-border hover:bg-bg-hover',
      primary: 'bg-primary text-primary-fg hover:bg-primary-hover',
    };

    const sizeStyles = {
      sm: 'p-1.5 [&_svg]:w-4 [&_svg]:h-4',
      md: 'p-2 [&_svg]:w-5 [&_svg]:h-5',
    };

    return (
      <button
        ref={ref}
        type={type}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      />
    );
  }
);

IconButton.displayName = 'IconButton';
