import { LayoutDashboard, Settings, Wrench } from 'lucide-react';

interface BottomNavProps {
  currentLibrary: any;
  onLibraryChange: (id: string) => void;
  className?: string;
}

export function BottomNav({ currentLibrary, onLibraryChange, className = '' }: BottomNavProps) {
  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-40 ${className}`}
    >
      <div className="grid grid-cols-4">
        <a href="/" className="flex flex-col items-center justify-center py-2 px-2 gap-1">
          <LayoutDashboard className="w-6 h-6" />
          <span className="text-xs">Home</span>
        </a>
        <a href="/settings" className="flex flex-col items-center justify-center py-2 px-2 gap-1">
          <Settings className="w-6 h-6" />
          <span className="text-xs">Settings</span>
        </a>
        <button
          onClick={() => onLibraryChange(currentLibrary?.id || '')}
          className="flex flex-col items-center justify-center py-2 px-2 gap-1"
        >
          <span className="w-6 h-6">📁</span>
          <span className="text-xs">Library</span>
        </button>
        <a
          href="/diagnostics"
          className="flex flex-col items-center justify-center py-2 px-2 gap-1"
        >
          <Wrench className="w-6 h-6" />
          <span className="text-xs">Diagnostics</span>
        </a>
      </div>
    </nav>
  );
}
