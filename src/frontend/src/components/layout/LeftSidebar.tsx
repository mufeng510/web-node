import {
  ChevronRight,
  FileText,
  Folder,
  FolderGit2,
  Home,
  Plus,
  Settings,
  Wrench,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { routes } from '../../routes';
import { api } from '../../services/api';
import { Spinner } from '../ui/Spinner';

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
  const navigate = useNavigate();
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!library?.id) {
      setTree([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setTree([]);
    setExpanded(new Set());
    setSelectedPath(null);
    (async () => {
      try {
        const response = (await api.get(`/files/${library.id}/tree`)) as unknown as {
          success: boolean;
          data: { tree: TreeNode[] };
        };
        if (!cancelled && response.success) {
          setTree(response.data.tree);
        }
      } catch (error) {
        console.error('Failed to load file tree:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [library?.id]);

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
      if (library?.id) {
        navigate(routes.editor(library.id, node.relativePath));
      }
    }
  };

  const renderNode = (node: TreeNode, depth = 0): React.ReactElement => {
    const isExpanded = expanded.has(node.relativePath);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedPath === node.relativePath;

    return (
      <div key={node.id}>
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
      <nav className="px-2 py-2 border-b border-border space-y-0.5" aria-label="Primary">
        {[
          { to: routes.home, label: 'Dashboard', icon: Home, end: true },
          ...(library?.id
            ? [{ to: routes.editor(library.id), label: 'Library', icon: FolderGit2, end: false }]
            : []),
          { to: routes.settings, label: 'Settings', icon: Settings, end: false },
          { to: routes.diagnostics, label: 'Diagnostics', icon: Wrench, end: false },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                  isActive ? 'bg-primary/10 text-primary font-medium' : 'text-fg hover:bg-bg-hover'
                )
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="px-3 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-xs font-medium text-fg-muted uppercase tracking-wider">Files</h2>
        {library?.id && (
          <button
            type="button"
            onClick={() => navigate(routes.editor(library.id), { state: { newNote: true } })}
            aria-label="New note"
            className="p-1 rounded-md text-fg-muted hover:text-fg hover:bg-bg-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" label="Loading files" />
          </div>
        ) : tree.length === 0 ? (
          <div className="text-center text-fg-muted py-8 text-sm">No files in this library</div>
        ) : (
          tree.map((node) => renderNode(node))
        )}
      </div>
    </aside>
  );
}
