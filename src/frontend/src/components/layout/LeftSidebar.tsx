import { PanelLeftOpen, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { routes } from '../../routes';
import { TreeView } from '../file-tree/TreeView';
import { useFileTree } from '../file-tree/useFileTree';
import { LibrarySwitcher } from '../library/LibrarySwitcher';
import { WORKSPACE_NAV } from './navConfig';

interface LeftSidebarProps {
  libraries: { id: string; name: string }[];
  currentLibrary: { id: string; name: string } | null;
  onLibraryChange: (libraryId: string) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** True when a parent grid track already controls the width. */
  resizable?: boolean;
  className?: string;
}

function readExpanded(libraryId: string | undefined): Set<string> {
  if (!libraryId) return new Set();
  try {
    const raw = localStorage.getItem(`expanded:${libraryId}`);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return new Set();
  }
}

/**
 * One semantic column: where you are, and what is in it.
 *
 * Application configuration is deliberately absent — it lives behind the top-bar
 * user menu (see `UserMenu`), because settings is a sub-page with its own section
 * navigation and a rail row pointing at it reads as "navigation" rather than
 * "configuration".
 */
export function LeftSidebar({
  libraries,
  currentLibrary,
  onLibraryChange,
  collapsed = false,
  onToggleCollapsed,
  resizable = false,
  className = '',
}: LeftSidebarProps) {
  const navigate = useNavigate();
  const params = useParams();

  // The route wins over remembered context: opening a note in another library
  // (search result, deep link, history) must show that library's tree.
  const routeLibraryId = params.libraryId;
  const libraryId = routeLibraryId ?? currentLibrary?.id;
  const notePath = params['*'] ?? null;

  const { tree, isLoading, error, refetch } = useFileTree(libraryId);
  const [expanded, setExpanded] = useState<Set<string>>(() => readExpanded(libraryId));

  useEffect(() => {
    setExpanded(readExpanded(libraryId));
  }, [libraryId]);

  useEffect(() => {
    if (routeLibraryId && currentLibrary?.id !== routeLibraryId) {
      onLibraryChange(routeLibraryId);
    }
  }, [routeLibraryId, currentLibrary?.id, onLibraryChange]);

  const handleExpandedChange = useCallback(
    (next: Set<string>) => {
      setExpanded(next);
      if (!libraryId) return;
      try {
        localStorage.setItem(`expanded:${libraryId}`, JSON.stringify([...next]));
      } catch {
        // storage unavailable — expansion still works for this session
      }
    },
    [libraryId]
  );

  const handleOpenFile = useCallback(
    (node: { relativePath: string }) => {
      if (libraryId) navigate(routes.editor(libraryId, node.relativePath));
    },
    [libraryId, navigate]
  );

  return (
    <aside
      className={cn(
        'bg-bg-elevated border-r border-border flex flex-col min-w-0 min-h-0',
        // Width comes from the parent grid track when it is resizable, and from
        // the token otherwise; setting it here would override that track.
        !resizable && (collapsed ? 'w-[var(--sidebar-w-collapsed)]' : 'w-[var(--sidebar-w)]'),
        className
      )}
    >
      {onToggleCollapsed && (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'shrink-0 flex items-center text-fg-muted hover:text-fg transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
            collapsed ? 'justify-center px-1 py-2' : 'justify-end px-2 py-1.5'
          )}
        >
          <PanelLeftOpen
            className={cn('w-4 h-4 transition-transform duration-150', !collapsed && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      )}

      {!collapsed && (
        <>
          <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border">
            <h2 className="text-xs font-medium text-fg-muted uppercase tracking-wider">Files</h2>
            {libraryId && (
              <button
                type="button"
                onClick={() => navigate(routes.editor(libraryId), { state: { newNote: true } })}
                aria-label="New note"
                className="p-1 rounded-md text-fg-muted hover:text-fg hover:bg-bg-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <TreeView
            nodes={tree}
            selectedPath={notePath}
            onOpenFile={handleOpenFile}
            expanded={expanded}
            onExpandedChange={handleExpandedChange}
            isLoading={isLoading}
            error={error}
            onRetry={() => void refetch()}
          />
        </>
      )}

      <LibrarySwitcher
        libraries={libraries}
        currentLibrary={currentLibrary}
        onLibraryChange={onLibraryChange}
        active={Boolean(routeLibraryId)}
        collapsed={collapsed}
      />

      {/* 按钮区固定高度，在文件树下方；内容超出时自带滚动条 */}
      <nav
        className={cn(
          'shrink-0 overflow-y-auto py-2 space-y-0.5 [scrollbar-gutter:stable]',
          'h-[var(--sidebar-nav-h)]',
          collapsed ? 'px-1' : 'px-2'
        )}
        aria-label="主导航"
      >
        {WORKSPACE_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              aria-label={item.label}
              className={({ isActive }) =>
                cn(
                  'flex items-center rounded-md text-sm transition-colors duration-150',
                  collapsed ? 'justify-center py-2' : 'gap-2.5 py-1.5 pl-3 pr-2.5',
                  'border-l-2 transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium border-primary'
                    : 'text-fg hover:bg-bg-hover border-transparent'
                )
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
