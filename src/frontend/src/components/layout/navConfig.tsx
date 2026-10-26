import {
  Bell,
  Bot,
  ClipboardList,
  Home,
  KeyRound,
  type LucideIcon,
  Palette,
  ScrollText,
  Search,
  Settings,
  Shield,
  User,
  Users,
  Wrench,
} from 'lucide-react';
import { routes } from '../../routes';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Exact-match the route instead of matching every descendant. */
  end?: boolean;
  /** High-frequency items the mobile bottom bar mirrors. */
  primary?: boolean;
}

/**
 * Single source of truth for the rail. Only destinations that answer "what am I
 * working on" belong here — application configuration lives in the top-bar user
 * menu so this stays one semantic column. Adding an item back to this array
 * reintroduces the duplicate-entry drift this registry exists to prevent.
 *
 * LeftSidebar, MobileDrawer and BottomNav all derive from it.
 */
export const WORKSPACE_NAV: NavItem[] = [
  { to: routes.home, label: 'nav.dashboard', icon: Home, end: true, primary: true },
  { to: routes.search, label: 'nav.search', icon: Search, end: true, primary: true },
  { to: routes.notifications, label: 'nav.notifications', icon: Bell, end: true },
  { to: routes.tasks, label: 'nav.tasks', icon: ClipboardList, end: true, primary: true },
  { to: routes.ai, label: 'nav.ai', icon: Bot, end: true },
];

/** The one config destination reachable without opening a menu, so hiding
 * settings from the rail does not make it undiscoverable on a phone. */
export const SETTINGS_ENTRY: NavItem = {
  to: routes.settings,
  label: 'nav.settings',
  icon: Settings,
  end: true,
};

export interface SettingsMenuItem extends NavItem {
  /** Deep-links a specific section, so a menu entry can land on the exact tab
   * instead of dumping the user on the first one. */
  tab?: string;
  adminOnly?: boolean;
}

export interface SettingsMenuGroup {
  id: string;
  label: string;
  items: SettingsMenuItem[];
}

export function settingsUrl(tab: string): string {
  return `${routes.settings}?tab=${tab}`;
}

export const SETTINGS_MENU_GROUPS: SettingsMenuGroup[] = [
  {
    id: 'personal',
    label: 'settings.groupPersonal',
    items: [
      {
        to: settingsUrl('account'),
        label: 'settings.account',
        icon: User,
        tab: 'account',
        end: true,
      },
      {
        to: settingsUrl('security'),
        label: 'settings.security',
        icon: Shield,
        tab: 'security',
        end: true,
      },
      {
        to: settingsUrl('appearance'),
        label: 'settings.appearance',
        icon: Palette,
        tab: 'appearance',
        end: true,
      },
    ],
  },
  {
    id: 'system',
    label: 'settings.groupSystem',
    items: [
      {
        to: settingsUrl('diagnostics'),
        label: 'settings.diagnostics',
        icon: Wrench,
        tab: 'diagnostics',
        end: true,
      },
      { to: settingsUrl('mcp'), label: 'common.mcp', icon: KeyRound, tab: 'mcp', end: true },
      { to: routes.users, label: 'common.users', icon: Users, end: true, adminOnly: true },
      { to: routes.audit, label: 'common.audit', icon: ScrollText, end: true, adminOnly: true },
    ],
  },
];

export function visibleSettingsGroups(isAdmin: boolean): SettingsMenuGroup[] {
  return SETTINGS_MENU_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.adminOnly || isAdmin),
  })).filter((group) => group.items.length > 0);
}
