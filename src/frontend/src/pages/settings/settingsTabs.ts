export const SETTINGS_TABS = [
  'account',
  'security',
  'appearance',
  'advanced',
  'diagnostics',
  'mcp',
  'users',
  'audit',
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const DEFAULT_SETTINGS_TAB: SettingsTab = 'account';

/** `advanced` holds destructive actions, so it is reachable by URL and by the
 * section nav but never offered in the user menu or the command palette. */
export const DANGEROUS_SETTINGS_TABS: SettingsTab[] = ['advanced'];

export const PERSONAL_TABS: SettingsTab[] = ['account', 'security', 'appearance'];

export const SYSTEM_TABS: SettingsTab[] = ['diagnostics', 'mcp', 'users', 'audit'];

export const ADMIN_ONLY_TABS: SettingsTab[] = ['users', 'audit'];

export function isSettingsTab(value: string | null | undefined): value is SettingsTab {
  return value != null && (SETTINGS_TABS as readonly string[]).includes(value);
}

/** Falls back to the default rather than rendering nothing on a bad `?tab=`. */
export function resolveSettingsTab(value: string | null | undefined): SettingsTab {
  return isSettingsTab(value) ? value : DEFAULT_SETTINGS_TAB;
}
