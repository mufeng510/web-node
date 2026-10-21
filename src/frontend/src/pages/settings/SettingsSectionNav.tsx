import {
  GitBranch,
  KeyRound,
  Lock,
  Palette,
  ScrollText,
  User,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { DANGEROUS_SETTINGS_TABS, type SettingsTab } from './settingsTabs';

const ICONS: Record<SettingsTab, LucideIcon> = {
  account: User,
  security: Lock,
  appearance: Palette,
  advanced: Wrench,
  diagnostics: Wrench,
  git: GitBranch,
  mcp: KeyRound,
  users: Users,
  audit: ScrollText,
};

const LABELS: Record<SettingsTab, string> = {
  account: '账号',
  security: '安全',
  appearance: '外观',
  advanced: '高级',
  diagnostics: '诊断',
  git: 'Git',
  mcp: 'MCP Tokens',
  users: '用户',
  audit: '审计日志',
};

export interface SettingsSectionNavProps {
  groups: { id: string; label: string; tabs: SettingsTab[] }[];
  activeTab: SettingsTab;
  onChange: (tab: SettingsTab) => void;
}

export function SettingsSectionNav({ groups, activeTab, onChange }: SettingsSectionNavProps) {
  const visibleGroups = groups.filter((group) => group.tabs.length > 0);

  return (
    <nav aria-label="设置章节" className="px-2 space-y-4">
      {visibleGroups.map((group) => {
        const headingId = `settings-group-${group.id}`;
        return (
          <div key={group.id}>
            <p
              id={headingId}
              className="px-2 pb-1 text-xs font-medium text-fg-subtle uppercase tracking-wider"
            >
              {group.label}
            </p>
            <ul className="space-y-0.5" aria-labelledby={headingId}>
              {group.tabs.map((tab) => {
                const Icon = ICONS[tab];
                const isActive = tab === activeTab;
                return (
                  <li key={tab}>
                    <button
                      type="button"
                      onClick={() => onChange(tab)}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'w-full flex items-center gap-2.5 rounded-md py-1.5 pl-3 pr-2.5 text-sm text-left transition-colors duration-150',
                        'border-l-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                        isActive
                          ? 'bg-primary/10 text-primary font-medium border-primary'
                          : 'text-fg hover:bg-bg-hover border-transparent'
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                      {LABELS[tab]}
                      {DANGEROUS_SETTINGS_TABS.includes(tab) && (
                        <X
                          className="w-3.5 h-3.5 ml-auto flex-shrink-0 text-fg-subtle"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
