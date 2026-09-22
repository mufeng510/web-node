import { ChevronRight, FileText, Folder } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

interface TreeNode {
  id: string;
  name: string;
  path: string;
  relativePath: string;
  isDir: boolean;
  size: number;
  mimeType?: string;
  mtime: Date;
  children?: TreeNode[];
  hidden?: boolean;
}

interface LeftSidebarProps {
  library: any;
  className?: string;
}

export function LeftSidebar({ library, className = '' }: LeftSidebarProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(
    null
  );
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const toggleExpand = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleNodeClick = (node: TreeNode, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (node.isDir) {
      toggleExpand(node.relativePath);
    } else {
      setSelectedPath(node.relativePath);
    }
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const renderNode = (node: TreeNode, depth = 0): React.ReactElement => {
    const isExpanded = expanded.has(node.relativePath);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedPath === node.relativePath;

    return (
      <div key={node.id} onContextMenu={(e) => handleContextMenu(e, node)}>
        <div
          className={cn(
            'flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors duration-150',
            isSelected ? 'bg-primary/10 text-primary' : 'text-fg hover:bg-bg-hover',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
          )}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={(e) => handleNodeClick(node, e)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleNodeClick(node, e);
          }}
          role="treeitem"
          aria-selected={isSelected}
          aria-expanded={hasChildren ? isExpanded : undefined}
        >
          {hasChildren && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.relativePath);
              }}
              className="p-0.5 text-fg-muted hover:text-fg transition-colors duration-150 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              <ChevronRight
                className={cn(
                  'w-4 h-4 transition-transform duration-150',
                  isExpanded && 'rotate-90'
                )}
              />
            </button>
          )}
          {!hasChildren && <span className="w-4" />}
          {node.isDir ? (
            <Folder className="w-4 h-4 text-fg-muted flex-shrink-0" aria-hidden="true" />
          ) : (
            <FileText className="w-4 h-4 text-fg-muted flex-shrink-0" aria-hidden="true" />
          )}
          <span className="truncate text-sm flex-1 min-w-0">{node.name}</span>
        </div>

        {hasChildren && isExpanded && (
          <div>{node.children?.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={cn(
        'w-[var(--sidebar-w)] bg-bg-elevated border-r border-border flex flex-col',
        className
      )}
    >
      <div className="px-3 py-3 border-b border-border">
        <h2 className="text-xs font-medium text-fg-muted uppercase tracking-wider">Files</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {tree.length === 0 ? (
          <div className="text-center text-fg-muted py-8 text-sm">No files in this library</div>
        ) : (
          tree.map((node) => renderNode(node))
        )}
      </div>
    </aside>
  );
}
