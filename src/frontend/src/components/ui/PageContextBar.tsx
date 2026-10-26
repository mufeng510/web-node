import { Check, Copy } from 'lucide-react';
import { type HTMLAttributes, forwardRef, useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';
import { Breadcrumb, type BreadcrumbItem } from './Breadcrumb';

export interface PageContextBarAction {
  label: string;
  onClick: () => void;
  /** Renders as the single primary action; only one is allowed per bar. */
  primary?: boolean;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface PageContextBarProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  /** Path or location string, rendered next to the title and copyable. */
  detail?: string;
  breadcrumb?: BreadcrumbItem[];
  actions?: PageContextBarAction[];
}

/**
 * Replaces the page-level header: identity plus one place to act.
 *
 * The path is exposed as copyable text rather than as the page subtitle, because
 * it is a filesystem location, not prose — rendering it as a description made it
 * look read-only and it leaked the container's internal layout.
 */
export const PageContextBar = forwardRef<HTMLDivElement, PageContextBarProps>(
  ({ title, detail, breadcrumb, actions, className, ...props }, ref) => {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    useEffect(() => {
      if (!copied) return;
      const timer = setTimeout(() => setCopied(false), 1600);
      return () => clearTimeout(timer);
    }, [copied]);

    const handleCopy = async () => {
      if (!detail) return;
      try {
        await navigator.clipboard.writeText(detail);
        setCopied(true);
      } catch {
        // clipboard unavailable — the path is still selectable text
      }
    };

    return (
      <div
        ref={ref}
        className={cn('shrink-0 border-b border-border bg-bg px-4 py-3 lg:px-6', className)}
        {...props}
      >
        {/* Full-bleed rule, but the row shares the body's measure so the title
            lines up with the content beneath it instead of drifting to the far
            edge of a wide monitor. */}
        <div className="mx-auto w-full max-w-[var(--content-max-w)] flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            {breadcrumb && breadcrumb.length > 0 && (
              <Breadcrumb items={breadcrumb} className="mb-1" />
            )}
            <div className="flex items-center gap-2 min-w-0">
              {/* tabIndex -1 so useRouteFocus can move focus here on navigation;
                  a heading is not focusable by default. */}
              <h1
                tabIndex={-1}
                className="text-lg font-semibold text-fg truncate focus:outline-none"
              >
                {title}
              </h1>
              {detail && (
                <button
                  type="button"
                  onClick={handleCopy}
                  title={detail}
                  className="group flex items-center gap-1 min-w-0 rounded px-1.5 py-0.5 text-xs text-fg-muted hover:text-fg hover:bg-bg-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                >
                  <span className="truncate font-mono">{detail}</span>
                  {copied ? (
                    <Check className="w-3.5 h-3.5 flex-shrink-0 text-success" aria-hidden="true" />
                  ) : (
                    <Copy
                      className="w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-hidden="true"
                    />
                  )}
                  <span className="sr-only">
                    {copied ? t('common.copied') : t('common.copyPath')}
                  </span>
                </button>
              )}
            </div>
          </div>

          {actions && actions.length > 0 && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                    'disabled:opacity-50 disabled:pointer-events-none',
                    action.primary
                      ? 'bg-primary text-primary-fg hover:bg-primary-hover'
                      : 'text-fg hover:bg-bg-hover'
                  )}
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
);

PageContextBar.displayName = 'PageContextBar';
