import { Bot, FileText, GitBranch, Link2, List, Search, Tag, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';
import { IconButton } from '../ui/IconButton';
import { Tabs } from '../ui/Tabs';

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

type TabId = 'outline' | 'ai' | 'backlinks' | 'properties' | 'search' | 'git' | 'tags';

const tabOptions = [
  { id: 'outline', label: 'Outline', icon: List },
  { id: 'ai', label: 'AI', icon: Bot },
  { id: 'backlinks', label: 'Backlinks', icon: Link2 },
  { id: 'properties', label: 'Properties', icon: FileText },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'git', label: 'Git', icon: GitBranch },
  { id: 'tags', label: 'Tags', icon: Tag },
] as const;

export function RightSidebar({ isOpen, onClose, className = '' }: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabId>('outline');

  if (!isOpen) return null;

  return (
    <aside
      className={cn(
        'w-[var(--right-sidebar-w)] bg-bg-elevated border-l border-border flex flex-col',
        className
      )}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h2 className="text-sm font-medium text-fg">Right Sidebar</h2>
        <IconButton size="sm" onClick={onClose} aria-label="Close sidebar">
          <X className="w-4 h-4" />
        </IconButton>
      </div>

      <div className="border-b border-border px-2">
        <Tabs
          options={tabOptions.map((t) => ({ ...t }))}
          value={activeTab}
          onChange={setActiveTab}
          ariaLabel="Right sidebar panels"
          className="py-1"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'outline' && (
          <div className="text-sm text-fg-muted">Outline - Table of contents will appear here</div>
        )}
        {activeTab === 'ai' && (
          <div className="text-sm text-fg-muted">AI Agent panel will appear here</div>
        )}
        {activeTab === 'backlinks' && (
          <div className="text-sm text-fg-muted">Backlinks will appear here</div>
        )}
        {activeTab === 'properties' && (
          <div className="text-sm text-fg-muted">Frontmatter properties will appear here</div>
        )}
        {activeTab === 'search' && (
          <div className="text-sm text-fg-muted">Search results will appear here</div>
        )}
        {activeTab === 'git' && (
          <div className="text-sm text-fg-muted">Git history will appear here</div>
        )}
        {activeTab === 'tags' && (
          <div className="text-sm text-fg-muted">Tags panel will appear here</div>
        )}
      </div>
    </aside>
  );
}
