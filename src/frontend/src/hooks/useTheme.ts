import { useSyncExternalStore } from 'react';
import { type ThemeChoice, getTheme, isDarkTheme, setTheme, subscribeTheme } from '../lib/theme';

function subscribe(onChange: () => void) {
  return subscribeTheme(onChange);
}

/**
 * Reads and writes the theme from anywhere in the tree.
 *
 * The setting lives in the server-backed user profile but must apply before the
 * shell mounts, so localStorage stays the source of truth for the running
 * session and the top bar needs this to reflect the current choice.
 */
export function useTheme(): {
  theme: ThemeChoice;
  isDark: boolean;
  setTheme: (theme: ThemeChoice) => void;
} {
  const theme = useSyncExternalStore(subscribe, getTheme, getTheme);
  // Not part of the store's snapshot: `system` resolves against the OS, and the
  // store only notifies on explicit changes.
  const isDark = useSyncExternalStore(subscribe, isDarkTheme, isDarkTheme);
  return { theme, isDark, setTheme };
}
