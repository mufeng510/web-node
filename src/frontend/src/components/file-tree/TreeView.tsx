import { AlertTriangle, FolderX } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Spinner } from '../ui/Spinner';
import { TreeNodeItem } from './TreeNodeItem';
import type { TreeNode } from './useFileTree';

export interface TreeViewProps {
  nodes: TreeNode[];
  selectedPath: string | null;
  onOpenFile: (node: TreeNode) => void;
  expanded: Set<string>;
  onExpandedChange: (next: Set<string>) => void;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
}

function ancestorPaths(relativePath: string): string[] {
  const segments = relativePath.split('/');
  return segments.slice(0, -1).map((_, index) => segments.slice(0, index + 1).join('/'));
}

/** Depth-first list of every node the user can arrow-key to. */
function flattenVisible(nodes: TreeNode[], expanded: Set<string>): TreeNode[] {
  return nodes.flatMap((node) => [
    node,
    ...(node.isDir && expanded.has(node.relativePath)
      ? flattenVisible(node.children ?? [], expanded)
      : []),
  ]);
}

/**
 * The file tree. Selection and expansion state are owned by the caller so they
 * can be derived from the route, which is what keeps the tree in sync when the
 * user arrives via deep link, browser history or a search result.
 *
 * Implements the WAI-ARIA tree pattern: one tab stop for the whole tree, arrow
 * keys move between visible nodes, Left collapses or steps to the parent,
 * Right expands or steps to the first child.
 */
export function TreeView({
  nodes,
  selectedPath,
  onOpenFile,
  expanded,
  onExpandedChange,
  isLoading,
  error,
  onRetry,
}: TreeViewProps) {
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const visibleNodes = useMemo(() => flattenVisible(nodes, expanded), [nodes, expanded]);
  const activePath = focusedPath ?? selectedPath ?? visibleNodes[0]?.relativePath ?? null;

  const toggle = useCallback(
    (node: TreeNode) => {
      const next = new Set(expanded);
      if (next.has(node.relativePath)) next.delete(node.relativePath);
      else next.add(node.relativePath);
      onExpandedChange(next);
    },
    [expanded, onExpandedChange]
  );

  const focusNode = useCallback((relativePath: string) => {
    setFocusedPath(relativePath);
    requestAnimationFrame(() => {
      containerRef.current
        ?.querySelector<HTMLElement>(`[data-path="${CSS.escape(relativePath)}"]`)
        ?.focus();
    });
  }, []);

  // Opening a file from elsewhere (deep link, search result, history) must reveal
  // it: expand every ancestor, then bring it into view.
  useEffect(() => {
    if (!selectedPath) return;
    const ancestors = ancestorPaths(selectedPath);
    if (ancestors.every((path) => expanded.has(path))) return;
    onExpandedChange(new Set([...expanded, ...ancestors]));
  }, [selectedPath, expanded, onExpandedChange]);

  useEffect(() => {
    if (!selectedPath) return;
    containerRef.current
      ?.querySelector<HTMLElement>(`[data-path="${CSS.escape(selectedPath)}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedPath, expanded]);

  const moveFocus = useCallback(
    (from: string, delta: number) => {
      const index = visibleNodes.findIndex((node) => node.relativePath === from);
      if (index === -1) return;
      const next = visibleNodes[index + delta];
      if (next) focusNode(next.relativePath);
    },
    [visibleNodes, focusNode]
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const node = visibleNodes.find((item) => item.relativePath === activePath);
    if (!node) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveFocus(node.relativePath, 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveFocus(node.relativePath, -1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (node.isDir && !expanded.has(node.relativePath)) toggle(node);
        else if (node.isDir) moveFocus(node.relativePath, 1);
        break;
      case 'ArrowLeft': {
        event.preventDefault();
        if (node.isDir && expanded.has(node.relativePath)) {
          toggle(node);
          break;
        }
        const parent = ancestorPaths(node.relativePath).at(-1);
        if (parent) focusNode(parent);
        break;
      }
      case 'Home':
        event.preventDefault();
        if (visibleNodes[0]) focusNode(visibleNodes[0].relativePath);
        break;
      case 'End': {
        event.preventDefault();
        const last = visibleNodes[visibleNodes.length - 1];
        if (last) focusNode(last.relativePath);
        break;
      }
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (node.isDir) toggle(node);
        else onOpenFile(node);
        break;
      default:
        break;
    }
  };

  const renderNodes = (list: TreeNode[], depth: number) =>
    list.map((node) => {
      const hasChildren = Boolean(node.children && node.children.length > 0);
      return (
        <Fragment key={node.id}>
          <TreeNodeItem
            node={node}
            depth={depth}
            hasChildren={hasChildren}
            expanded={expanded.has(node.relativePath)}
            selected={selectedPath === node.relativePath}
            tabbable={activePath === node.relativePath}
            onToggle={toggle}
            onOpen={onOpenFile}
            onFocus={setFocusedPath}
          />
          {node.isDir && expanded.has(node.relativePath) && node.children && (
            // biome-ignore lint/a11y/useSemanticElements: role=group is the WAI-ARIA tree pattern; biome only knows group→fieldset, which is form-only
            <div role="group">{renderNodes(node.children, depth + 1)}</div>
          )}
        </Fragment>
      );
    });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="md" label="Loading files" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        compact
        icon={AlertTriangle}
        title="Could not load files"
        description={error.message}
        actions={
          onRetry && (
            <Button size="sm" variant="secondary" onClick={onRetry}>
              Retry
            </Button>
          )
        }
      />
    );
  }

  if (nodes.length === 0) {
    return (
      <EmptyState
        compact
        icon={FolderX}
        title="No files yet"
        description="Create a note to see it appear here."
      />
    );
  }

  return (
    <div
      ref={containerRef}
      role="tree"
      aria-label="Files"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className={cn('min-h-0 flex-1 overflow-y-auto p-2 outline-none', '[scrollbar-gutter:stable]')}
    >
      {renderNodes(nodes, 0)}
    </div>
  );
}
