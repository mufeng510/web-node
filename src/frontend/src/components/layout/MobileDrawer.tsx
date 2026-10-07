import { ChevronRight, FolderGit2, X } from 'lucide-react';
import { useEffect } from 'react';
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
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
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
      <aside className="fixed inset-y-0 left-0 z-[var(--z-drawer)] w-[var(--mobile-drawer-w)] bg-bg-elevated border-r border-border lg:hidden flex flex-col">
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
          aria-label="Mobile primary"
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
      </aside>
    </>
  );
}
