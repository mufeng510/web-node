import { FolderGit2, LayoutDashboard, Settings, Wrench } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { routes } from '../../routes';

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
  const navigate = useNavigate();
  return (
    <nav
      aria-label="Primary"
      className={cn(
        'fixed bottom-0 left-0 right-0 bg-bg-elevated/95 backdrop-blur-sm border-t border-border z-40 lg:hidden',
        className
      )}
    >
      <div className="grid grid-cols-4">
        <Link to="/" className={linkStyles}>
          <LayoutDashboard className="w-6 h-6" aria-hidden="true" />
          <span className="text-xs">Home</span>
        </Link>
        <Link to="/settings" className={linkStyles}>
          <Settings className="w-6 h-6" aria-hidden="true" />
          <span className="text-xs">Settings</span>
        </Link>
        <button
          type="button"
          onClick={() => {
            if (currentLibrary?.id) {
              onLibraryChange(currentLibrary.id);
              navigate(routes.editor(currentLibrary.id));
            } else {
              navigate('/');
            }
          }}
          className={linkStyles}
          aria-label="Open current library"
        >
          <FolderGit2 className="w-6 h-6" aria-hidden="true" />
          <span className="text-xs">Library</span>
        </button>
        <Link to="/diagnostics" className={linkStyles}>
          <Wrench className="w-6 h-6" aria-hidden="true" />
          <span className="text-xs">Diagnostics</span>
        </Link>
      </div>
    </nav>
  );
}
