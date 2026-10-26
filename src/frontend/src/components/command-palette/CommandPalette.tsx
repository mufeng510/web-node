import { Command } from 'cmdk';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLibraries } from '../../hooks/useLibraries';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';
import { routes } from '../../routes';
import { SETTINGS_MENU_GROUPS, WORKSPACE_NAV } from '../layout/navConfig';

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  group: string;
  run: () => void;
}

/**
 * Single keyboard entry point for navigation.
 *
 * Everything here is navigation or a section jump — never a destructive action,
 * which is why the settings registry's `advanced` entry is filtered out below.
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { libraries, currentLibrary } = useLibraries();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  const items: CommandItem[] = [
    ...WORKSPACE_NAV.map((item) => ({
      id: `nav:${item.to}`,
      label: item.label,
      group: t('groupNav'),
      run: () => go(item.to),
    })),
    {
      id: 'action:new-note',
      label: t('newNote'),
      group: t('groupAction'),
      run: () => {
        onOpenChange(false);
        if (currentLibrary) {
          navigate(routes.editor(currentLibrary.id), { state: { newNote: true } });
        } else {
          navigate(routes.home);
        }
      },
    },
    {
      id: 'action:new-library',
      label: t('newLibrary'),
      group: t('groupAction'),
      run: () => go(routes.home),
    },
    ...libraries.map((library) => ({
      id: `library:${library.id}`,
      label: library.name,
      hint: library.id === currentLibrary?.id ? t('hintCurrent') : undefined,
      group: t('groupSwitchLibrary'),
      run: () => go(routes.editor(library.id)),
    })),
    ...SETTINGS_MENU_GROUPS.flatMap((group) =>
      group.items
        // `dangerous` sections stay out of the shortcut flow on purpose.
        .filter((item) => item.tab !== 'advanced')
        .map((item) => ({
          id: `settings:${item.to}`,
          label: item.label,
          group: t('groupSettings', { group: t(group.label) }),
          run: () => go(item.to),
        }))
    ),
  ];

  // cmdk renders its own always-mounted backdrop, so the whole tree has to
  // unmount when closed — otherwise it keeps intercepting clicks.
  if (!open) return null;

  return (
    <Command
      ref={listRef}
      label={t('commandPalette.label')}
      shouldFilter
      loop
      className={cn(
        'fixed inset-0 z-[var(--z-modal)] bg-overlay/50 p-4 pt-[10vh]',
        'flex items-start justify-center'
      )}
      onClick={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div
        className="w-full max-w-lg bg-bg-elevated border border-border rounded-lg shadow-lg overflow-hidden"
        // cmdk's own dialog semantics; the outer div provides the backdrop.
        {...({ role: 'dialog', 'aria-modal': true } as Record<string, unknown>)}
      >
        <Command.Input
          autoFocus
          placeholder={t('commandPalette.placeholder')}
          className="w-full px-4 py-3 text-sm bg-transparent text-fg placeholder-fg-subtle outline-none border-b border-border"
        />
        <Command.List className="max-h-[24rem] overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-fg-muted">
            {t('commandPalette.noMatchingCommands')}
          </Command.Empty>
          {[
            t('groupNav'),
            t('groupAction'),
            t('groupSwitchLibrary'),
            t('groupSettings', { group: t('settings.groupPersonal') }),
            t('groupSettings', { group: t('settings.groupSystem') }),
          ].map((group) => {
            const groupItems = items.filter((item) => item.group === group);
            if (groupItems.length === 0) return null;
            return (
              <Command.Group
                key={group}
                heading={group}
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-subtle [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
              >
                {groupItems.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={`${item.label} ${item.hint ?? ''}`}
                    onSelect={item.run}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm text-fg cursor-pointer data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
                  >
                    <span className="truncate">{item.label}</span>
                    {item.hint && <span className="text-xs text-fg-muted">{item.hint}</span>}
                  </Command.Item>
                ))}
              </Command.Group>
            );
          })}
        </Command.List>
      </div>
    </Command>
  );
}
