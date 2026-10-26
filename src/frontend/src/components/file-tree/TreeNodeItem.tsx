import { ChevronRight, FileText, Folder } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';
import type { TreeNode } from './useFileTree';

export interface TreeNodeItemProps {
  node: TreeNode;
  depth: number;
  expanded: boolean;
  selected: boolean;
  /** Roving tabindex: exactly one node is in the tab order at a time. */
  tabbable: boolean;
  hasChildren: boolean;
  onToggle: (node: TreeNode) => void;
  onOpen: (node: TreeNode) => void;
  onFocus: (relativePath: string) => void;
}

export function TreeNodeItem({
  node,
  depth,
  expanded,
  selected,
  tabbable,
  hasChildren,
  onToggle,
  onOpen,
  onFocus,
}: TreeNodeItemProps) {
  const { t } = useTranslation();
  const isFolder = node.isDir;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the WAI-ARIA tree pattern puts one keydown handler on the tree container and moves focus between items, rather than one per item
    <div
      role="treeitem"
      aria-selected={selected}
      aria-expanded={isFolder ? expanded : undefined}
      data-path={node.relativePath}
      tabIndex={tabbable ? 0 : -1}
      onClick={(event) => {
        event.stopPropagation();
        if (isFolder) {
          onToggle(node);
        } else {
          onOpen(node);
        }
        onFocus(node.relativePath);
      }}
      onFocus={() => onFocus(node.relativePath)}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors duration-150',
        selected ? 'bg-primary/10 text-primary' : 'text-fg hover:bg-bg-hover',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
      )}
      style={{ paddingLeft: `${8 + depth * 16}px` }}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggle(node);
        }}
        tabIndex={-1}
        className={cn(
          'p-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          hasChildren ? 'text-fg-muted hover:text-fg' : 'invisible'
        )}
        aria-label={
          expanded ? t('components.fileTree.collapseFolder') : t('components.fileTree.expandFolder')
        }
      >
        <ChevronRight
          className={cn('w-4 h-4 transition-transform duration-150', expanded && 'rotate-90')}
          aria-hidden="true"
        />
      </button>

      {isFolder ? (
        <Folder
          className={cn('w-4 h-4 flex-shrink-0', selected ? 'text-primary' : 'text-fg-muted')}
          aria-hidden="true"
        />
      ) : (
        <FileText
          className={cn('w-4 h-4 flex-shrink-0', selected ? 'text-primary' : 'text-fg-muted')}
          aria-hidden="true"
        />
      )}
      <span className="truncate text-sm flex-1 min-w-0">{node.name}</span>
    </div>
  );
}
