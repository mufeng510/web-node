import type { LucideIcon } from 'lucide-react';
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface TabOption<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
}

export interface TabsProps<T extends string> {
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  orientation?: 'horizontal' | 'vertical';
  ariaLabel?: string;
  className?: string;
}

function TabsInner<T extends string>(
  {
    options,
    value,
    onChange,
    orientation = 'horizontal',
    ariaLabel = 'Tabs',
    className,
  }: TabsProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation={orientation}
      className={cn(
        orientation === 'horizontal' ? 'flex gap-1 overflow-x-auto' : 'flex flex-col gap-1',
        className
      )}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.id)}
            className={cn(
              'flex items-center gap-2 rounded-md font-medium transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
              orientation === 'horizontal'
                ? 'px-3 py-1.5 text-xs whitespace-nowrap'
                : 'w-full px-3 py-2 text-sm',
              selected
                ? 'bg-primary/10 text-primary'
                : 'text-fg-muted hover:bg-bg-hover hover:text-fg'
            )}
          >
            {Icon && <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export const Tabs = forwardRef(TabsInner) as <T extends string>(
  props: TabsProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => React.ReactElement;
