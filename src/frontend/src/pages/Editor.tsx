import { isAxiosError } from 'axios';
import {
  ArrowLeft,
  Bold,
  Code,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Network,
  Quote,
  Save,
  Strikethrough,
} from 'lucide-react';
import { marked } from 'marked';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { NoteRail } from '../components/editor/NoteRail';
import { useRegisterRail } from '../components/layout/RightRail';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import { Button } from '../components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { Resizable } from '../components/ui/Resizable';
import { Spinner } from '../components/ui/Spinner';
import { StatusDot } from '../components/ui/StatusDot';
import { Tabs } from '../components/ui/Tabs';
import { Textarea } from '../components/ui/Textarea';
import { ToolbarButton } from '../components/ui/ToolbarButton';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { applyHeadingIds, outlineOf } from '../lib/markdownOutline';
import { cn } from '../lib/utils';
import { routes } from '../routes';
import { api } from '../services/api';

type EditorView = 'write' | 'preview' | 'split';

/**
 * 保存状态机。
 *
 * `dirty` 是唯一会启动防抖计时器的状态；`saving` 期间不排程，
 * 保存结束后由 `saveNote` 依据内容快照决定回到 `saved` 还是 `dirty`；
 * `error` 不自动重试，等用户继续编辑或手动保存。
 */
type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

/** 停止输入多久后自动落盘 */
const AUTOSAVE_DELAY_MS = 1500;

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

const viewOptions = [
  { id: 'write', label: 'Write' },
  { id: 'preview', label: 'Preview' },
  { id: 'split', label: 'Split' },
] as const;

export function Editor() {
  const { libraryId, '*': splat } = useParams<{ libraryId: string; '*': string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [notePath, setNotePath] = useState<string>('');
  const [content, setContent] = useState('');
  const [view, setView] = useState<EditorView>('split');
  // The panes stack on narrow screens and drag apart on wide ones, which needs
  // the breakpoint in JS instead of utility classes alone.
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const splitRef = useRef<HTMLDivElement>(null);
  const [splitSize, setSplitSize] = useState<number | null>(null);

  useEffect(() => {
    if (!isDesktop) {
      setSplitSize(null);
      return;
    }
    const el = splitRef.current;
    // Seed 50/50 once; after that the user's own drag wins, so their split
    // survives window resizes the way the sidebar width does.
    if (el) setSplitSize((current) => current ?? Math.round(el.clientWidth / 2));
  }, [isDesktop]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fileExists, setFileExists] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pathInputRef = useRef<HTMLInputElement>(null);
  /**
   * 已落盘的内容快照。`content` 与它不一致才说明有真正的未保存修改，
   * 避免每次按键都触发一次无谓的写盘。
   */
  const savedContentRef = useRef('');
  /** 编辑器里的最新内容，保存与卸载时读取，不等 React 批处理完成 */
  const contentRef = useRef('');
  /** 当前打开的笔记路径，卸载时用来决定写回哪个文件 */
  const splatRef = useRef(splat);
  useEffect(() => {
    splatRef.current = splat;
  }, [splat]);
  /**
   * 笔记代次。每次加载或切换笔记都 +1。
   *
   * 切换笔记时，旧笔记的保存请求可能在新笔记加载完成后才返回；那时若照常
   * 更新 `savedContentRef` 和状态，会把新笔记误标成"有未保存修改"，进而触发
   * 一次多余的写盘。保存时记下当时的代次，回来发现代次变了就只丢弃结果。
   */
  const noteGenerationRef = useRef(0);
  const fileExistsRef = useRef(false);
  /** 正在写盘时置位，防止防抖回调与手动保存并发写同一个文件 */
  const savingRef = useRef(false);
  const [showLinks, setShowLinks] = useState(false);
  const [backlinks, setBacklinks] = useState<
    { sourcePath: string; sourceName: string; type: string; target: string }[]
  >([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [linkQuery, setLinkQuery] = useState('');
  const [suggestions, setSuggestions] = useState<
    { path: string; name: string; displayName: string }[]
  >([]);

  useEffect(() => {
    const state = location.state as { newNote?: boolean } | null;
    if (state?.newNote) {
      pathInputRef.current?.focus();
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 把内容写盘。`targetPath` 与 `body` 显式传入，这样切换笔记时的 flush
   * 能锁定离开那一刻的内容，而不会被后续的状态更新改写。
   */
  const saveNote = useCallback(
    async (targetPath: string, body: string): Promise<boolean> => {
      const path = targetPath.trim();
      if (!libraryId || !path) return false;
      // 已有一次写盘在进行时直接跳过：防抖回调与手动保存可能撞在一起
      if (savingRef.current) return false;

      savingRef.current = true;
      setSaveState('saving');
      setSaveError(null);
      const generation = noteGenerationRef.current;
      try {
        // 已有文件走 PATCH； adopted 老库在 files 表可能没有记录，404 时回退到 POST 创建
        if (fileExistsRef.current) {
          try {
            await api.patch(`/files/${libraryId}/${encodePath(path)}`, { content: body });
          } catch (error) {
            if (isAxiosError(error) && error.response?.status === 404) {
              await api.post(`/files/${libraryId}/`, { path, content: body });
              fileExistsRef.current = true;
              setFileExists(true);
            } else {
              throw error;
            }
          }
        } else {
          await api.post(`/files/${libraryId}/`, { path, content: body });
          fileExistsRef.current = true;
          setFileExists(true);
        }
        // 已经切到别的笔记了：内容确实写成功了，但别去动当前笔记的快照和状态
        if (noteGenerationRef.current !== generation) return true;
        savedContentRef.current = body;
        // 写盘期间用户可能又改了内容；那就要回到 dirty 让防抖再排一次
        if (contentRef.current === body) {
          setSaveState('saved');
        } else {
          setSaveState('dirty');
        }
        return true;
      } catch (error) {
        console.error('Failed to save:', error);
        // 已经切到别的笔记了，失败信息不该挂到当前笔记头上
        if (noteGenerationRef.current === generation) {
          setSaveState('error');
          setSaveError(error instanceof Error ? error.message : 'Failed to save');
        }
        return false;
      } finally {
        savingRef.current = false;
      }
    },
    [libraryId]
  );

  useEffect(() => {
    if (!libraryId) return;
    // 换一代：上一个笔记还在路上的保存请求回来时，会发现自己已经过期
    noteGenerationRef.current += 1;
    if (!splat) {
      setNotePath('');
      contentRef.current = '# Welcome to Web Note\n\nStart writing your notes here...';
      setContent(contentRef.current);
      fileExistsRef.current = false;
      setFileExists(false);
      savedContentRef.current = contentRef.current;
      setSaveState('saved');
      setSaveError(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const response = (await api.get(`/files/${libraryId}/${encodePath(splat)}`)) as unknown as {
          success: boolean;
          data: { content?: string };
        };
        if (!cancelled && response.success) {
          setNotePath(splat);
          contentRef.current = response.data.content ?? '';
          setContent(contentRef.current);
          fileExistsRef.current = true;
          setFileExists(true);
          savedContentRef.current = contentRef.current;
          setSaveState('saved');
          setSaveError(null);
        }
      } catch (error) {
        console.error('Failed to load note:', error);
        if (!cancelled) {
          setLoadError(`Failed to load ${splat}`);
          setNotePath(splat);
          contentRef.current = '';
          setContent('');
          fileExistsRef.current = false;
          setFileExists(false);
          savedContentRef.current = '';
          setSaveState('saved');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      // 离开这个笔记前把还没落盘的修改保存掉，否则切走后内容就丢了。
      // 这里读的是 ref 而不是 state：cleanup 运行时 content 仍是旧笔记的内容。
      if (fileExistsRef.current && contentRef.current !== savedContentRef.current) {
        void saveNote(splat, contentRef.current);
      }
    };
  }, [libraryId, splat, saveNote]);

  const handleSave = async () => {
    const path = notePath.trim();
    if (!libraryId || !path) return;
    const ok = await saveNote(path, content);
    if (ok && path !== (splat ?? '')) {
      navigate(routes.editor(libraryId, path), { replace: true });
    }
  };

  /**
   * 自动保存：只处理已存在的文件。
   *
   * 新笔记的路径还在输入框里由用户决定，替他落盘会造出半截路径的文件，
   * 所以新笔记仍然要先手动保存一次，之后的编辑才会自动保存。
   */
  const flushAutoSave = useCallback(async () => {
    if (!splat) return;
    if (!fileExistsRef.current) return;
    if (contentRef.current === savedContentRef.current) return;
    if (savingRef.current) return;
    await saveNote(splat, contentRef.current);
  }, [splat, saveNote]);

  // 防抖：`content` 变化就重置计时器，停手 AUTOSAVE_DELAY_MS 后才真正写盘
  useEffect(() => {
    if (saveState !== 'dirty') return;
    if (!fileExists) return;
    const timer = setTimeout(() => {
      void flushAutoSave();
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [saveState, content, fileExists, flushAutoSave]);

  // 离开编辑器（关闭标签页 / 刷新）时，若还有未落盘的修改则拦一下，
  // 给用户一次反悔的机会。自动保存通常已经把内容写掉了，这里只是兜底。
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (saveState === 'saved' || saveState === 'saving') return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [saveState]);

  // 组件卸载时做最后一次保存。依赖数组保持为空，cleanup 只在真正卸载时跑一次
  // （切笔记走的是加载 effect 自己的 cleanup），读 ref 拿到离开时的内容。
  useEffect(() => {
    return () => {
      const path = splatRef.current;
      const body = contentRef.current;
      if (!path || !fileExistsRef.current) return;
      if (body === savedContentRef.current) return;
      void saveNote(path, body);
    };
  }, [saveNote]);

  const handleContentChange = (newContent: string) => {
    // ref 同步更新，这样即使保存请求还在途中，也能拿到最新的内容
    contentRef.current = newContent;
    setContent(newContent);
    setSaveState('dirty');
  };

  const applyEdit = (next: string, selectStart: number, selectEnd: number) => {
    handleContentChange(next);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(selectStart, selectEnd);
      }
    });
  };

  const wrapSelection = (before: string, after: string, placeholder = 'text') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end) || placeholder;
    const next = `${content.slice(0, start)}${before}${selected}${after}${content.slice(end)}`;
    applyEdit(next, start + before.length, start + before.length + selected.length);
  };

  const prefixLines = (prefix: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = content.indexOf('\n', end);
    const targetEnd = lineEnd === -1 ? content.length : lineEnd;
    const block = content.slice(lineStart, targetEnd);
    const next = block
      .split('\n')
      .map((line) => (line.startsWith(prefix) ? line : `${prefix}${line}`))
      .join('\n');
    const full = `${content.slice(0, lineStart)}${next}${content.slice(targetEnd)}`;
    handleContentChange(full);
    requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (node) {
        node.focus();
        node.setSelectionRange(lineStart, lineStart + next.length);
      }
    });
  };

  const insertLink = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end) || 'link text';
    const snippet = `[${selected}](https://)`;
    const next = `${content.slice(0, start)}${snippet}${content.slice(end)}`;
    applyEdit(next, start + snippet.length - 1, start + snippet.length - 1);
  };

  const outline = useMemo(() => outlineOf(content), [content]);
  const renderedHtml = useMemo(
    () => applyHeadingIds(marked.parse(content) as string, outlineOf(content)),
    [content]
  );
  const editing = view !== 'preview';

  const railNode = useMemo(
    () => (
      <NoteRail
        libraryId={libraryId ?? ''}
        notePath={splat ?? ''}
        entries={outline}
        backlinks={backlinks}
        loading={linksLoading}
        onOpenNote={(path) => libraryId && navigate(routes.editor(libraryId, path))}
      />
    ),
    [splat, libraryId, outline, backlinks, linksLoading, navigate]
  );
  useRegisterRail(splat ? `note:${splat}` : null, railNode);

  // Stable identity: the load-on-open effect below depends on it, and a fresh
  // function each render would refetch forever.
  const fetchBacklinks = useCallback(async () => {
    if (!libraryId || !splat) return;
    setLinksLoading(true);
    try {
      const res = (await api.get(
        `/editor/${libraryId}/${encodePath(splat)}/backlinks`
      )) as unknown as {
        success: boolean;
        data: {
          backlinks: { sourcePath: string; sourceName: string; type: string; target: string }[];
        };
      };
      // A response without the array would otherwise leave the rail and the
      // dialog reading a non-list and crash on .length.
      if (res.success && Array.isArray(res.data.backlinks)) setBacklinks(res.data.backlinks);
    } catch (error) {
      console.error('Failed to load backlinks:', error);
    } finally {
      setLinksLoading(false);
    }
  }, [libraryId, splat]);

  const openLinks = () => {
    setShowLinks(true);
    void fetchBacklinks();
  };

  // The rail shows backlinks for the whole time a note is open, so they load
  // with the note rather than only when the dialog is opened.
  useEffect(() => {
    void fetchBacklinks();
  }, [fetchBacklinks, splat]);

  const searchWikilinks = async (q: string) => {
    setLinkQuery(q);
    if (!libraryId || !splat || !q.trim()) {
      setSuggestions([]);
      return;
    }
    try {
      const res = (await api.get(`/editor/${libraryId}/${encodePath(splat)}/wikilinks`, {
        params: { q: q.trim() },
      })) as unknown as {
        success: boolean;
        data: { suggestions: { path: string; name: string; displayName: string }[] };
      };
      if (res.success) setSuggestions(res.data.suggestions);
    } catch (error) {
      console.error('Failed to search wikilinks:', error);
    }
  };

  const draggableSplit = view === 'split' && isDesktop && splitSize !== null;

  const editorPane = editing ? (
    <div
      className={cn(
        'min-h-0 overflow-auto p-4 h-full',
        view === 'split' &&
          (draggableSplit
            ? 'border-r border-border'
            : 'border-b lg:border-b-0 lg:border-r border-border')
      )}
    >
      <Textarea
        ref={textareaRef}
        fill
        aria-label="Markdown source"
        value={content}
        onChange={(e) => handleContentChange(e.target.value)}
        className="h-full min-h-[400px] font-mono text-sm leading-relaxed"
        spellCheck={false}
      />
    </div>
  ) : null;

  const previewPane =
    view !== 'write' ? (
      <div className="min-h-0 overflow-auto p-4 h-full">
        <div className="md-content max-w-none">
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: preview renders author-owned note markdown via marked */}
          <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
        </div>
      </div>
    ) : null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => navigate(routes.home)}
            aria-label="Back to dashboard"
            className="p-1.5 rounded-md text-fg-muted hover:text-fg hover:bg-bg-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          {libraryId && (
            <div className="hidden md:block min-w-0 flex-shrink-0">
              <Breadcrumb
                items={
                  splat
                    ? (notePath || splat)
                        .split('/')
                        .filter(Boolean)
                        .map((part, index, all) => ({
                          label: part,
                          href:
                            index === all.length - 1
                              ? undefined
                              : routes.editor(libraryId, all.slice(0, index + 1).join('/')),
                        }))
                    : [{ label: 'New note' }]
                }
                maxItems={3}
              />
            </div>
          )}
          <Input
            ref={pathInputRef}
            aria-label="Note path"
            value={notePath}
            onChange={(e) => setNotePath(e.target.value)}
            placeholder="Note path (e.g., notes/my-note.md)"
            className="w-64"
          />
          <StatusDot
            tone={
              saveState === 'saved'
                ? 'success'
                : saveState === 'saving'
                  ? 'primary'
                  : saveState === 'error'
                    ? 'destructive'
                    : 'muted'
            }
            label={
              saveState === 'saved'
                ? 'Saved'
                : saveState === 'saving'
                  ? 'Saving…'
                  : saveState === 'error'
                    ? 'Save failed'
                    : 'Unsaved changes'
            }
            title={
              saveState === 'error'
                ? (saveError ?? 'Failed to save')
                : saveState === 'dirty'
                  ? `Auto-saves ${AUTOSAVE_DELAY_MS / 1000}s after you stop typing`
                  : undefined
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <Tabs
            options={viewOptions.map((o) => ({ ...o }))}
            value={view}
            onChange={setView}
            ariaLabel="Editor view"
          />
          <Button
            onClick={handleSave}
            // 新笔记还没有落盘过，即使内容为空也要能保存；已有文件则只在有改动时可点
            disabled={saveState === 'saving' || (saveState === 'saved' && fileExists)}
            size="sm"
          >
            <Save className="w-4 h-4" aria-hidden="true" />{' '}
            {saveState === 'saving' ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {saveState === 'error' && saveError && (
        <div className="px-4 py-2 text-sm text-destructive" role="alert">
          {saveError}
        </div>
      )}

      {editing && (
        <div
          className="shrink-0 flex items-center gap-0.5 px-3 py-2 border-b border-border overflow-x-auto"
          role="toolbar"
          aria-label="Markdown formatting"
        >
          <ToolbarButton
            label="Bold"
            tip="Bold"
            icon={<Bold className="w-4 h-4" aria-hidden="true" />}
            onClick={() => wrapSelection('**', '**')}
          />
          <ToolbarButton
            label="Italic"
            tip="Italic"
            icon={<Italic className="w-4 h-4" aria-hidden="true" />}
            onClick={() => wrapSelection('*', '*')}
          />
          <ToolbarButton
            label="Strikethrough"
            tip="Strikethrough"
            icon={<Strikethrough className="w-4 h-4" aria-hidden="true" />}
            onClick={() => wrapSelection('~~', '~~')}
          />
          <ToolbarButton
            label="Code"
            tip="Inline code"
            icon={<Code className="w-4 h-4" aria-hidden="true" />}
            onClick={() => wrapSelection('`', '`', 'code')}
          />
          <ToolbarButton
            label="Link"
            tip="Insert link"
            icon={<Link2 className="w-4 h-4" aria-hidden="true" />}
            onClick={insertLink}
          />
          <ToolbarButton
            label="Heading"
            tip="Heading"
            icon={<Heading2 className="w-4 h-4" aria-hidden="true" />}
            onClick={() => prefixLines('## ')}
          />
          <ToolbarButton
            label="Bulleted list"
            tip="Bulleted list"
            icon={<List className="w-4 h-4" aria-hidden="true" />}
            onClick={() => prefixLines('- ')}
          />
          <ToolbarButton
            label="Numbered list"
            tip="Numbered list"
            icon={<ListOrdered className="w-4 h-4" aria-hidden="true" />}
            onClick={() => prefixLines('1. ')}
          />
          <ToolbarButton
            label="Quote"
            tip="Blockquote"
            icon={<Quote className="w-4 h-4" aria-hidden="true" />}
            onClick={() => prefixLines('> ')}
          />
          <ToolbarButton
            label="Links"
            tip="Backlinks and wikilinks"
            icon={<Network className="w-4 h-4" aria-hidden="true" />}
            onClick={openLinks}
          />
        </div>
      )}

      {loadError && (
        <div className="px-4 py-2 text-sm text-destructive" role="alert">
          {loadError}
        </div>
      )}

      <div ref={splitRef} className="flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Spinner size="md" label="Loading note" />
          </div>
        ) : draggableSplit ? (
          <Resizable
            orientation="horizontal"
            size={splitSize ?? 0}
            onSizeChange={setSplitSize}
            min={280}
            firstLabel="Resize editor panes"
            className="h-full"
            first={editorPane}
            second={previewPane}
          />
        ) : (
          <div
            className={cn(
              'h-full',
              view === 'split' && 'grid grid-cols-1 lg:grid-cols-2 grid-rows-[minmax(0,1fr)]'
            )}
          >
            {editorPane}
            {previewPane}
          </div>
        )}
      </div>

      <Dialog open={showLinks} onOpenChange={setShowLinks}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Links</DialogTitle>
            <DialogDescription>
              {splat ? `Pages linking to ${splat}` : 'Save the note first to see backlinks.'}
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
            <div>
              <Input
                aria-label="Search notes to link"
                value={linkQuery}
                onChange={(e) => searchWikilinks(e.target.value)}
                placeholder="Type to find a note, e.g. [[my-note]]"
              />
              {suggestions.length > 0 && (
                <ul className="mt-2 border border-border rounded-md divide-y divide-border max-h-48 overflow-y-auto">
                  {suggestions.map((s) => (
                    <li key={s.path}>
                      <button
                        type="button"
                        onClick={() => {
                          if (libraryId) navigate(routes.editor(libraryId, s.path));
                          setShowLinks(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-fg hover:bg-bg-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      >
                        <span className="font-medium">{s.displayName}</span>
                        <span className="block text-xs text-fg-muted truncate">{s.path}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium text-fg mb-2">Backlinks</h3>
              {linksLoading ? (
                <Spinner size="sm" label="Loading backlinks" />
              ) : backlinks.length === 0 ? (
                <p className="text-sm text-fg-muted">No pages link here yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {backlinks.map((b, i) => (
                    <li key={`${b.sourcePath}-${i}`}>
                      <button
                        type="button"
                        onClick={() => {
                          if (libraryId) navigate(routes.editor(libraryId, b.sourcePath));
                          setShowLinks(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm border border-border rounded-md hover:bg-bg-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="font-medium text-fg">{b.sourceName}</span>
                        <span className="block text-xs text-fg-muted truncate">
                          {b.type} · {b.target}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
