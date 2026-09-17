import { Library, LogOut, Menu, PanelRightOpen } from 'lucide-react';

interface TopBarProps {
  user: { id: string; email: string; role: string } | null;
  libraries: { id: string; name: string }[];
  currentLibrary: { id: string; name: string } | null;
  onLibraryChange: (libraryId: string) => void;
  onMenuClick: () => void;
  onRightSidebarClick: () => void;
  onLogout: () => Promise<void>;
}

export function TopBar({
  user,
  libraries,
  currentLibrary,
  onLibraryChange,
  onMenuClick,
  onRightSidebarClick,
  onLogout,
}: TopBarProps) {
  return (
    <header className="h-12 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between px-3 lg:hidden">
      <button
        type="button"
        onClick={onMenuClick}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-2">
        {currentLibrary && (
          <div className="flex items-center gap-1 text-sm font-medium">
            <Library className="w-4 h-4 text-gray-500" />
            <span className="truncate max-w-[120px]">{currentLibrary.name}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onRightSidebarClick}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <PanelRightOpen className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
