import { ChevronRight, FolderGit2, X } from 'lucide-react';

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
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
        role="button"
        tabIndex={-1}
        aria-hidden="true"
      />
      <aside className="fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-800 transform transition-transform lg:hidden flex flex-col">
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium">Menu</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
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
              className={`w-full px-3 py-2 text-left text-sm rounded-lg flex items-center gap-2 ${currentLibrary?.id === lib.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              <FolderGit2 className="w-4 h-4" />
              <span className="truncate">{lib.name}</span>
              {currentLibrary?.id === lib.id && <ChevronRight className="w-4 h-4 ml-auto" />}
            </button>
          ))}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {[
            { href: '/', label: 'Dashboard', icon: '🏠' },
            { href: '/settings', label: 'Settings', icon: '⚙️' },
            { href: '/diagnostics', label: 'Diagnostics', icon: '🔧' },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <span>{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
    </>
  );
}
