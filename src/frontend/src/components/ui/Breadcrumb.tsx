import { ChevronRight } from 'lucide-react';
import {
  Fragment,
  type HTMLAttributes,
  type ReactNode,
  forwardRef,
  useEffect,
  useState,
} from 'react';
import { cn } from '../../lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface BreadcrumbProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  items: BreadcrumbItem[];
  maxItems?: number;
  separator?: ReactNode;
  ariaLabel?: string;
  collapseLabel?: string;
}

type BreadcrumbEntry = { kind: 'item'; item: BreadcrumbItem; index: number } | { kind: 'toggle' };

const focusRingClassName =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg';

const itemClassName = 'truncate max-w-[10rem] rounded px-1 py-0.5 transition-colors duration-150';

export const Breadcrumb = forwardRef<HTMLElement, BreadcrumbProps>(
  (
    {
      items,
      maxItems = 4,
      separator = <ChevronRight className="w-4 h-4 text-fg-subtle" aria-hidden="true" />,
      ariaLabel = 'Breadcrumb',
      collapseLabel = 'Show full path',
      className,
      ...props
    },
    ref
  ) => {
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
      setExpanded(false);
    }, [items.length]);

    const needsCollapse = items.length > maxItems;
    const first = items[0];
    let entries: BreadcrumbEntry[];

    if (needsCollapse && first) {
      const tailStart = Math.max(items.length - Math.max(maxItems - 1, 1), 1);
      const tailItems = expanded ? items.slice(1) : items.slice(tailStart);
      const tailStartIndex = expanded ? 1 : tailStart;
      entries = [
        { kind: 'item', item: first, index: 0 },
        { kind: 'toggle' },
        ...tailItems.map<BreadcrumbEntry>((item, index) => ({
          kind: 'item',
          item,
          index: tailStartIndex + index,
        })),
      ];
    } else {
      entries = items.map<BreadcrumbEntry>((item, index) => ({ kind: 'item', item, index }));
    }

    const renderEntry = (entry: BreadcrumbEntry) => {
      if (entry.kind === 'toggle') {
        return (
          <button
            type="button"
            aria-label={collapseLabel}
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
            className={cn(itemClassName, 'hover:text-fg hover:bg-bg-hover', focusRingClassName)}
          >
            …
          </button>
        );
      }

      const { item, index } = entry;

      if (index === items.length - 1) {
        return (
          <span aria-current="page" className={cn(itemClassName, 'text-fg font-medium')}>
            {item.label}
          </span>
        );
      }

      if (item.href) {
        return (
          <a
            href={item.href}
            className={cn(itemClassName, 'hover:text-fg hover:bg-bg-hover', focusRingClassName)}
          >
            {item.label}
          </a>
        );
      }

      if (item.onClick) {
        return (
          <button
            type="button"
            onClick={item.onClick}
            className={cn(itemClassName, 'hover:text-fg hover:bg-bg-hover', focusRingClassName)}
          >
            {item.label}
          </button>
        );
      }

      return <span className={cn(itemClassName, 'text-fg-muted')}>{item.label}</span>;
    };

    return (
      <nav
        ref={ref}
        {...props}
        aria-label={ariaLabel}
        className={cn('min-w-0 text-sm text-fg-muted', className)}
      >
        <ol className="flex min-w-0 list-none items-center gap-1.5">
          {entries.map((entry, position) => (
            <Fragment
              key={
                entry.kind === 'toggle' ? 'breadcrumb-toggle' : `${entry.index}-${entry.item.label}`
              }
            >
              {position > 0 && (
                <li aria-hidden="true" className="flex min-w-0 shrink-0 items-center">
                  {separator}
                </li>
              )}
              <li className="flex min-w-0 items-center">{renderEntry(entry)}</li>
            </Fragment>
          ))}
        </ol>
      </nav>
    );
  }
);

Breadcrumb.displayName = 'Breadcrumb';
