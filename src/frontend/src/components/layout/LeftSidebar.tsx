import { ChevronRight, FileText, Folder } from 'lucide-react';
import { useEffect, useState } from 'react';

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
  const [tree, _setTree] = useState<TreeNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [_contextMenu, setContextMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(
    null
  );

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
          className={`flex items-center gap-1 px-2 py-1.5 rounded ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-100 dark:hover:bg-gray-700'} cursor-pointer`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={(e) => handleNodeClick(node, e)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleNodeClick(node, e);
          }}
          role="treeitem"
        >
          {hasChildren && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.relativePath);
              }}
              className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <ChevronRight
                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              />
            </button>
          )}
          {!hasChildren && <span className="w-4" />}
          {node.isDir ? (
            <Folder className="w-4 h-4 text-yellow-500" />
          ) : (
            <FileText className="w-4 h-4 text-gray-500" />
          )}
          <span className="truncate text-sm flex-1">{node.name}</span>
        </div>

        {hasChildren && isExpanded && (
          <div>{node.children?.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={`w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col ${className}`}
    >
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Files
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {tree.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm">
            No files in this library
          </div>
        ) : (
          tree.map((node) => renderNode(node))
        )}
      </div>
    </aside>
  );
}
