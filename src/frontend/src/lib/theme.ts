export type ThemeChoice = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';

function readStoredTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // storage unavailable — fall through to system
  }
  return 'system';
}

function resolveDark(theme: ThemeChoice): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

let current: ThemeChoice = readStoredTheme();
const listeners = new Set<(theme: ThemeChoice) => void>();
let mediaQuery: MediaQueryList | null = null;

function applyTheme(theme: ThemeChoice) {
  const dark = resolveDark(theme);
  document.documentElement.classList.toggle('dark', dark);
  if (theme !== 'system') return;
  // Only the system choice follows the OS; an explicit choice must not drift.
  mediaQuery ??= window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', onSystemChange);
}

function onSystemChange(event: MediaQueryListEvent) {
  if (current !== 'system') return;
  document.documentElement.classList.toggle('dark', event.matches);
  // `isDarkTheme()` resolves against the OS, so subscribers must be told or the
  // top bar toggle keeps showing the state from before the OS flipped.
  for (const listener of listeners) listener(current);
}

export function getTheme(): ThemeChoice {
  return current;
}

/** Whether dark is actually in effect, resolving `system` against the OS. */
export function isDarkTheme(): boolean {
  return resolveDark(current);
}

export function setTheme(theme: ThemeChoice) {
  if (theme === current) return;
  current = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // storage unavailable — theme still applies for this session
  }
  if (mediaQuery) mediaQuery.removeEventListener('change', onSystemChange);
  applyTheme(theme);
  for (const listener of listeners) listener(theme);
}

export function subscribeTheme(listener: (theme: ThemeChoice) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

applyTheme(current);
