import { useEffect, useState } from 'react';

/**
 * Subscribes to a CSS media query.
 *
 * Layout that has to change shape at a breakpoint — the editor stacks its panes
 * on narrow screens and drags them apart on wide ones — cannot be expressed with
 * a single set of utility classes, so it needs the breakpoint in JS.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    // jsdom has no matchMedia, and SSR has no window; both fall back to the
    // narrow layout, which is the safe default.
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
