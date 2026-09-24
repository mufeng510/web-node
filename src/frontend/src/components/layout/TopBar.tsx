import { Check, ChevronDown, Library, LogOut, Menu } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { IconButton } from '../ui/IconButton';

interface TopBarProps {
  user: { id: string; email: string; role: string } | null;
  libraries: { id: string; name: string }[];
  currentLibrary: { id: string; name: string } | null;
  onLibraryChange: (libraryId: string) => void;
  onMenuClick: () => void;
  onLogout: () => Promise<void>;
}

export function TopBar({
  user,
  libraries,
  currentLibrary,
  onLibraryChange,
  onMenuClick,
  onLogout,
}: TopBarProps) {
  const [libraryMenuOpen, setLibraryMenuOpen] = useState(false);
  const libraryMenuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!libraryMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        libraryMenuRef.current &&
        !libraryMenuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setLibraryMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLibraryMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [libraryMenuOpen]);

  return (
    <header className="h-[var(--topbar-h)] bg-bg/80 backdrop-blur-sm border-b border-border flex items-center justify-between px-4 lg:px-6">
      {/* Mobile menu button */}
      <IconButton onClick={onMenuClick} aria-label="Open menu" className="lg:hidden">
        <Menu className="w-5 h-5" />
      </IconButton>

      {/* Library switcher - visible on all screen sizes */}
      <div className="flex items-center gap-3 flex-1 lg:max-w-xs">
        {libraries.length > 1 && (
          <div className="relative flex-1">
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setLibraryMenuOpen(!libraryMenuOpen)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150',
                'bg-bg-elevated border border-border text-fg hover:bg-bg-hover',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
              )}
              aria-haspopup="menu"
              aria-expanded={libraryMenuOpen}
              aria-label="Switch library"
            >
              <Library className="w-4 h-4 text-fg-muted flex-shrink-0" aria-hidden="true" />
              <span className="truncate flex-1 text-left">
                {currentLibrary?.name || 'Select Library'}
              </span>
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-fg-muted flex-shrink-0 transition-transform duration-150',
                  libraryMenuOpen && 'rotate-180'
                )}
                aria-hidden="true"
              />
            </button>

            {libraryMenuOpen && (
              <div
                ref={libraryMenuRef}
                tabIndex={-1}
                className="absolute top-full left-0 right-0 mt-1 bg-bg-elevated border border-border rounded-lg shadow-lg z-50 animate-in fade-in-0 zoom-in-95 overflow-hidden"
                role="menu"
                aria-label="Libraries"
              >
                {libraries.map((lib) => (
                  <button
                    key={lib.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={currentLibrary?.id === lib.id}
                    onClick={() => {
                      onLibraryChange(lib.id);
                      setLibraryMenuOpen(false);
                    }}
                    className={cn(
                      'w-full px-3 py-2 text-sm text-left transition-colors duration-150 flex items-center gap-2',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                      currentLibrary?.id === lib.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-fg hover:bg-bg-hover'
                    )}
                  >
                    <Library className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                    <span className="truncate">{lib.name}</span>
                    {currentLibrary?.id === lib.id && (
                      <Check className="w-4 h-4 ml-auto" aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {libraries.length === 1 && currentLibrary && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-elevated border border-border rounded-md">
            <Library className="w-4 h-4 text-fg-muted" aria-hidden="true" />
            <span className="text-sm font-medium text-fg truncate max-w-[160px]">
              {currentLibrary.name}
            </span>
          </div>
        )}
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-1 lg:gap-2">
        {user && (
          <IconButton onClick={onLogout} aria-label="Log out">
            <LogOut className="w-5 h-5" />
          </IconButton>
        )}
      </div>
    </header>
  );
}
