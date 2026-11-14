import { ChevronRight, FolderGit2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';
import { routes } from '../../routes';
import { TreeView } from '../file-tree/TreeView';
import { readExpanded, writeExpanded } from '../file-tree/expandedState';
import { type TreeNode, useFileTree } from '../file-tree/useFileTree';
import { IconButton } from '../ui/IconButton';
import { Spinner } from '../ui/Spinner';
import { WORKSPACE_NAV } from './navConfig';

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
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDialogElement>(null);
  const { libraryId } = useParams<{ libraryId?: string }>();
  const navigate = useNavigate();

  const activeLibraryId = libraryId ?? currentLibrary?.id;
  const { tree, isLoading, error } = useFileTree(activeLibraryId);
  // 与桌面侧栏共享同一份展开状态（localStorage），两边看到的树是一致的
  const [expanded, setExpanded] = useState<Set<string>>(() => readExpanded(activeLibraryId));

  useEffect(() => {
    setExpanded(readExpanded(activeLibraryId));
  }, [activeLibraryId]);

  const handleExpandedChange = useCallback(
    (next: Set<string>) => {
      setExpanded(next);
      if (!activeLibraryId) return;
      writeExpanded(activeLibraryId, next);
    },
    [activeLibraryId]
  );

  const handleOpenFile = (node: TreeNode) => {
    if (!activeLibraryId) return;
    navigate(`/editor/${activeLibraryId}/${node.relativePath}`);
    onClose();
  };

  // 移动端抽屉只保留「别处找不到」的入口：通知在顶栏铃铛、仪表盘/搜索/任务
  // 在底部栏、设置在右上角账号菜单，这里重复列一遍只会让文件区被挤扁。
  const aiItem = WORKSPACE_NAV.find((item) => item.to === routes.ai);
  const AiIcon = aiItem?.icon;

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';

    const focusableSelector =
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const focusFirst = () => {
      panelRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();
    };
    focusFirst();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const items = [...panelRef.current.querySelectorAll<HTMLElement>(focusableSelector)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 bg-overlay/50 z-[var(--z-scrim)] lg:hidden cursor-default"
        onClick={onClose}
        aria-label={t('common.close')}
      />
      {/* Mounted only while open, so `open` is what makes it visible at all; the
          UA stylesheet hides a dialog without it. Focus is trapped manually in
          the effect above, because showModal() would conflict with unmounting. */}
      <dialog
        ref={panelRef}
        id="mobile-menu-drawer"
        open
        aria-modal="true"
        aria-label="Menu"
        className="fixed inset-y-0 left-0 m-0 p-0 z-[var(--z-drawer)] w-[var(--mobile-drawer-w)] max-w-none h-full bg-bg-elevated border-r border-border lg:hidden flex flex-col backdrop:bg-transparent"
      >
        <div className="flex items-center justify-between px-3 py-3 border-b border-border">
          <h2 className="text-lg font-medium text-fg">{t('components.layout.buttonMenu')}</h2>
          <IconButton size="sm" onClick={onClose} aria-label={t('common.close')}>
            <X className="w-5 h-5" />
          </IconButton>
        </div>

        <div className="px-3 py-3 border-b border-border flex-shrink-0 max-h-56 overflow-y-auto [scrollbar-gutter:stable]">
          <h3 className="text-xs font-medium text-fg-muted uppercase tracking-wider mb-2">
            {t('components.layout.labelLibraries')}
          </h3>
          {libraries.map((lib) => (
            <button
              type="button"
              key={lib.id}
              onClick={() => {
                onLibraryChange(lib.id);
                onClose();
              }}
              className={cn(
                'w-full px-3 py-2 text-left text-sm rounded-md flex items-center gap-2 transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                currentLibrary?.id === lib.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-fg hover:bg-bg-hover'
              )}
            >
              <FolderGit2 className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span className="truncate">{lib.name}</span>
              {currentLibrary?.id === lib.id && (
                <ChevronRight className="w-4 h-4 ml-auto" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>

        {activeLibraryId && (
          <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
            <h3 className="text-xs font-medium text-fg-muted uppercase tracking-wider mb-2 flex-shrink-0">
              {t('components.layout.labelFiles')}
            </h3>
            {isLoading ? (
              <div className="flex min-h-0 flex-1 items-center justify-center">
                <Spinner size="sm" label={t('components.layout.spinnerLoadingFiles')} />
              </div>
            ) : error ? (
              <div className="flex min-h-0 flex-1 items-center justify-center px-2 py-2 text-sm text-destructive">
                {error.message}
              </div>
            ) : tree.length === 0 ? (
              <div className="flex min-h-0 flex-1 items-center justify-center px-2 py-2 text-sm text-fg-muted text-center">
                {t('components.layout.emptyNoFilesYet')}
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <TreeView
                  nodes={tree}
                  selectedPath={null}
                  onOpenFile={handleOpenFile}
                  expanded={expanded}
                  onExpandedChange={handleExpandedChange}
                  isLoading={false}
                  error={null}
                />
              </div>
            )}
          </div>
        )}

        {aiItem && AiIcon && (
          <nav
            className="mt-auto flex-shrink-0 border-t border-border px-3 py-2"
            aria-label={t('components.layout.ariaMobileMainNav')}
          >
            <NavLink
              to={aiItem.to}
              end
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                  isActive ? 'bg-primary/10 text-primary font-medium' : 'text-fg hover:bg-bg-hover'
                )
              }
            >
              <AiIcon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              {t(aiItem.label)}
            </NavLink>
          </nav>
        )}
      </dialog>
    </>
  );
}
