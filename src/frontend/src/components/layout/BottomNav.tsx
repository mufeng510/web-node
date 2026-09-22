import { FolderGit2, LayoutDashboard, Settings, Wrench } from 'lucide-react';
import { cn } from '../../lib/utils';

interface BottomNavProps {
  currentLibrary: any;
  onLibraryChange: (id: string) => void;
  className?: string;
}

const linkStyles = cn(
  'flex flex-col items-center justify-center py-2 px-2 gap-1 transition-colors duration-150',
  'text-fg-muted hover:text-fg',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
);

export function BottomNav({ currentLibrary, onLibraryChange, className = '' }: BottomNavProps) {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        'fixed bottom-0 left-0 right-0 bg-bg-elevated/95 backdrop-blur-sm border-t border-border z-40 lg:hidden',
        className
      )}
    >
      <div className="grid grid-cols-4">
        <a href="/" className={linkStyles}>
          <LayoutDashboard className="w-6 h-6" aria-hidden="true" />
          <span className="text-xs">Home</span>
        </a>
        <a href="/settings" className={linkStyles}>
          <Settings className="w-6 h-6" aria-hidden="true" />
          <span className="text-xs">Settings</span>
        </a>
        <button
          type="button"
          onClick={() => onLibraryChange(currentLibrary?.id || '')}
          className={linkStyles}
          aria-label="Open current library"
        >
          <FolderGit2 className="w-6 h-6" aria-hidden="true" />
          <span className="text-xs">Library</span>
        </button>
        <a href="/diagnostics" className={linkStyles}>
          <Wrench className="w-6 h-6" aria-hidden="true" />
          <span className="text-xs">Diagnostics</span>
        </a>
      </div>
    </nav>
  );
}
