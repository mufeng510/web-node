import { ChevronRight, FolderGit2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { IconButton } from '../ui/IconButton';
import { SETTINGS_ENTRY, WORKSPACE_NAV } from './navConfig';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  libraries: any[];
  currentLibrary: any;
  onLibraryChange: (id: string) => void;
}

export function MobileDrawer({
  isOpen,
  onClose,
  libraries,
  currentLibrary,
  onLibraryChange,
}: MobileDrawerProps) {
  const panelRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';

    const focusableSelector =
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const focusFirst = () => {
      panelRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();
    };
    focusFirst();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const items = [...panelRef.current.querySelectorAll<HTMLElement>(focusableSelector)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 bg-overlay/50 z-[var(--z-scrim)] lg:hidden cursor-default"
        onClick={onClose}
        aria-label="Close menu"
      />
      {/* Mounted only while open, so `open` is what makes it visible at all; the
          UA stylesheet hides a dialog without it. Focus is trapped manually in
          the effect above, because showModal() would conflict with unmounting. */}
      <dialog
        ref={panelRef}
        id="mobile-menu-drawer"
        open
        aria-modal="true"
        aria-label="Menu"
        className="fixed inset-y-0 left-0 m-0 p-0 z-[var(--z-drawer)] w-[var(--mobile-drawer-w)] max-w-none h-full bg-bg-elevated border-r border-border lg:hidden flex flex-col backdrop:bg-transparent"
      >
        <div className="flex items-center justify-between px-3 py-3 border-b border-border">
          <h2 className="text-lg font-medium text-fg">Menu</h2>
          <IconButton size="sm" onClick={onClose} aria-label="Close menu">
            <X className="w-5 h-5" />
          </IconButton>
        </div>

        <div className="px-3 py-3 border-b border-border">
          <h3 className="text-xs font-medium text-fg-muted uppercase tracking-wider mb-2">
            Libraries
          </h3>
          {libraries.map((lib) => (
            <button
              type="button"
              key={lib.id}
              onClick={() => {
                onLibraryChange(lib.id);
                onClose();
              }}
              className={cn(
                'w-full px-3 py-2 text-left text-sm rounded-md flex items-center gap-2 transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                currentLibrary?.id === lib.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-fg hover:bg-bg-hover'
              )}
            >
              <FolderGit2 className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span className="truncate">{lib.name}</span>
              {currentLibrary?.id === lib.id && (
                <ChevronRight className="w-4 h-4 ml-auto" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>

        <nav
          className="min-h-0 flex-1 px-3 py-3 space-y-1 overflow-y-auto [scrollbar-gutter:stable] [overscroll-behavior:contain]"
          aria-label="移动主导航"
        >
          {[...WORKSPACE_NAV, SETTINGS_ENTRY].map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-fg hover:bg-bg-hover'
                  )
                }
              >
                <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </dialog>
    </>
  );
}
