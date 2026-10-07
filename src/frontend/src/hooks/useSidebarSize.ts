import { useCallback, useEffect, useState } from 'react';

export const DEFAULT_SIDEBAR_WIDTH = 256;

const WIDTH_KEY = 'sidebar-width';
const COLLAPSED_KEY = 'sidebar-collapsed';

function readNumber(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export interface SidebarSizeState {
  width: number;
  setWidth: (width: number) => void;
  collapsed: boolean;
  toggleCollapsed: () => void;
  resetWidth: () => void;
}

/**
 * Sidebar width and collapsed state, persisted per browser.
 *
 * Collapsing matters most on short or narrow monitors, where a 256px rail eats
 * the content area; the collapsed width is the `--sidebar-w-collapsed` token that
 * was declared in the token file but never wired up.
 */
export function useSidebarSize(): SidebarSizeState {
  const [width, setWidthState] = useState(() => readNumber(WIDTH_KEY) ?? DEFAULT_SIDEBAR_WIDTH);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(WIDTH_KEY, String(width));
    } catch {
      // storage unavailable — width still applies for this session
    }
  }, [width]);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      // storage unavailable — collapsed state still applies for this session
    }
  }, [collapsed]);

  const setWidth = useCallback((next: number) => setWidthState(next), []);
  const toggleCollapsed = useCallback(() => setCollapsed((value) => !value), []);
  const resetWidth = useCallback(() => setWidthState(DEFAULT_SIDEBAR_WIDTH), []);

  return { width, setWidth, collapsed, toggleCollapsed, resetWidth };
}
