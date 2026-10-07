import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface ScrollAreaProps extends React.ComponentPropsWithoutRef<'div'> {}

/**
 * The single scroll container for a region.
 *
 * Every scrollable area in the shell goes through here so three properties are
 * never forgotten again:
 *   min-height: 0        — without it a flex child refuses to shrink and the
 *                          region grows past its parent instead of scrolling
 *   scrollbar-gutter     — reserves the gutter so content does not shift
 *                          sideways when a region gains or loses a scrollbar
 *   overscroll-behavior  — stops scroll chaining into the document
 *
 * Drop-in replacement for the `flex-1 overflow-y-auto` div that each page used
 * to hand-roll.
 */
export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable] [overscroll-behavior:contain]',
        className
      )}
      {...props}
    />
  )
);

ScrollArea.displayName = 'ScrollArea';
