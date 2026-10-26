import { ChevronDown, LogOut, Settings } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';
import { DropdownMenu } from '../ui/DropdownMenu';
import { SETTINGS_ENTRY, visibleSettingsGroups } from './navConfig';

export interface UserMenuProps {
  user: { email: string; role: string } | null;
  onLogout: () => Promise<void> | void;
}

/**
 * The single entry point for everything that is not "what am I working on".
 *
 * Configuration lives here rather than in the rail because `/settings` is a
 * sub-page with its own section navigation; a rail row pointing at it reads as
 * navigation and made the column mean two different things at once. Appearance
 * entries deep-link a section so they land on the right tab.
 */
export function UserMenu({ user, onLogout }: UserMenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const groups = visibleSettingsGroups(user.role === 'admin');
  const displayName = user.email.split('@')[0] ?? user.email;

  return (
    <DropdownMenu
      open={open}
      onOpenChange={setOpen}
      align="end"
      ariaLabel={t('components.layout.labelAccount')}
      menuClassName="min-w-[13rem]"
      trigger={
        <button
          type="button"
          className={cn(
            'flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-md transition-colors duration-150',
            'hover:bg-bg-hover',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
          )}
        >
          <span
            className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-medium flex items-center justify-center flex-shrink-0"
            aria-hidden="true"
          >
            {displayName.slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden sm:flex flex-col items-start leading-tight">
            <span className="text-xs font-medium text-fg max-w-[8rem] truncate">{displayName}</span>
            <span className="text-xs text-fg-muted uppercase tracking-wide">
              {user.role === 'admin' ? t('common.admin') : t('common.user')}
            </span>
          </span>
          <ChevronDown className="w-4 h-4 text-fg-muted flex-shrink-0" aria-hidden="true" />
        </button>
      }
    >
      <p className="px-3 py-2 text-xs text-fg-muted truncate" title={user.email}>
        {user.email}
      </p>

      {groups.map((group) => (
        // biome-ignore lint/a11y/useSemanticElements: role=group is the WAI-ARIA menu grouping pattern; biome only knows group→fieldset, which is form-only
        <div key={group.id} role="group" aria-label={group.label}>
          <p className="px-3 py-1.5 text-xs font-medium text-fg-subtle uppercase tracking-wider">
            {t(group.label)}
          </p>
          {group.items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.to}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  navigate(item.to);
                }}
                className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 text-fg hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                {t(item.label)}
              </button>
            );
          })}
        </div>
      ))}

      <div className="border-t border-border mt-1 pt-1">
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setOpen(false);
            navigate(SETTINGS_ENTRY.to);
          }}
          className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 text-fg-muted hover:text-fg hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <Settings className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          {t('components.layout.labelAllSettings')}
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setOpen(false);
            void onLogout();
          }}
          className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          {t('components.layout.labelLogout')}
        </button>
      </div>
    </DropdownMenu>
  );
}
