import { X } from 'lucide-react';
import { useState } from 'react';

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function RightSidebar({ isOpen, onClose, className = '' }: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<
    'outline' | 'ai' | 'backlinks' | 'properties' | 'search' | 'git' | 'tags'
  >('outline');

  if (!isOpen) return null;

  return (
    <aside
      className={`${className} w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col`}
    >
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-medium">Right Sidebar</h2>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto px-2">
        <nav className="flex gap-1 py-1" role="tablist">
          {[
            { id: 'outline', label: 'Outline', icon: '📋' },
            { id: 'ai', label: 'AI', icon: '🤖' },
            { id: 'backlinks', label: 'Backlinks', icon: '🔗' },
            { id: 'properties', label: 'Properties', icon: '📋' },
            { id: 'search', label: 'Search', icon: '🔍' },
            { id: 'git', label: 'Git', icon: '📦' },
            { id: 'tags', label: 'Tags', icon: '🏷️' },
          ].map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'outline' && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Outline - Table of contents will appear here
          </div>
        )}
        {activeTab === 'ai' && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            AI Agent panel will appear here
          </div>
        )}
        {activeTab === 'backlinks' && (
          <div className="text-sm text-gray-500 dark:text-gray-400">Backlinks will appear here</div>
        )}
        {activeTab === 'properties' && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Frontmatter properties will appear here
          </div>
        )}
        {activeTab === 'search' && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Search results will appear here
          </div>
        )}
        {activeTab === 'git' && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Git history will appear here
          </div>
        )}
        {activeTab === 'tags' && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Tags panel will appear here
          </div>
        )}
      </div>
    </aside>
  );
}
