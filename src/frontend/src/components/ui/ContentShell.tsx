import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface ContentShellProps {
  children: React.ReactNode;
  /** `reading` for prose, `editing` for the editor. Both are token-driven. */
  variant?: 'reading' | 'editing' | 'full';
  className?: string;
}

/**
 * Centres content and caps its measure.
 *
 * Without a cap, prose stretches to the full width of a wide monitor — about 1740
 * px of line length here — which is well past comfortable reading. `--content-max-w`
 * and `--editor-max-w` were declared in the token file from the start but never
 * referenced; this is the single place that now uses them.
 */
export const ContentShell = forwardRef<HTMLDivElement, ContentShellProps>(
  ({ children, variant = 'reading', className }, ref) => (
    <div
      ref={ref}
      className={cn(
        'mx-auto w-full',
        variant === 'reading' && 'max-w-[var(--content-max-w)]',
        variant === 'editing' && 'max-w-[var(--editor-max-w)]',
        className
      )}
    >
      {children}
    </div>
  )
);

ContentShell.displayName = 'ContentShell';
