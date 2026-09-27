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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';
import { StatusDot } from '../components/ui/StatusDot';
import { Tabs } from '../components/ui/Tabs';
import { Textarea } from '../components/ui/Textarea';
import { ToolbarButton } from '../components/ui/ToolbarButton';
import { cn } from '../lib/utils';
import { routes } from '../routes';
import { api } from '../services/api';

type EditorView = 'write' | 'preview' | 'split';

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
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fileExists, setFileExists] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pathInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (!libraryId) return;
    if (!splat) {
      setNotePath('');
      setContent('# Welcome to Web Note\n\nStart writing your notes here...');
      setFileExists(false);
      setSaved(true);
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
          setContent(response.data.content ?? '');
          setFileExists(true);
          setSaved(true);
        }
      } catch (error) {
        console.error('Failed to load note:', error);
        if (!cancelled) {
          setLoadError(`Failed to load ${splat}`);
          setNotePath(splat);
          setContent('');
          setFileExists(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [libraryId, splat]);

  const handleSave = async () => {
    const path = notePath.trim();
    if (!libraryId || !path || saving) return;
    setSaving(true);
    try {
      // 已有文件走 PATCH； adopted 老库在 files 表可能没有记录，404 时回退到 POST 创建
      if (fileExists) {
        try {
          await api.patch(`/files/${libraryId}/${encodePath(path)}`, { content });
        } catch (error) {
          if (isAxiosError(error) && error.response?.status === 404) {
            await api.post(`/files/${libraryId}/`, { path, content });
            setFileExists(true);
          } else {
            throw error;
          }
        }
      } else {
        await api.post(`/files/${libraryId}/`, { path, content });
        setFileExists(true);
      }
      setSaved(true);
      if (path !== (splat ?? '')) {
        navigate(routes.editor(libraryId, path), { replace: true });
      }
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setSaved(false);
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

  const renderedHtml = useMemo(() => marked.parse(content) as string, [content]);
  const editing = view !== 'preview';

  const openLinks = async () => {
    setShowLinks(true);
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
      if (res.success) setBacklinks(res.data.backlinks);
    } catch (error) {
      console.error('Failed to load backlinks:', error);
    } finally {
      setLinksLoading(false);
    }
  };

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

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-border bg-bg-elevated/50">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => navigate(routes.home)}
            aria-label="Back to dashboard"
            className="p-1.5 rounded-md text-fg-muted hover:text-fg hover:bg-bg-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <nav
            aria-label="Breadcrumb"
            className="hidden md:flex items-center gap-1 text-sm text-fg-muted flex-shrink-0"
          >
            <span className="truncate max-w-[120px]">{splat ? notePath || splat : 'New note'}</span>
          </nav>
          <Input
            ref={pathInputRef}
            aria-label="Note path"
            value={notePath}
            onChange={(e) => setNotePath(e.target.value)}
            placeholder="Note path (e.g., notes/my-note.md)"
            className="w-64"
          />
          <StatusDot
            tone={saved ? 'success' : 'muted'}
            label={saved ? 'Saved' : 'Unsaved changes'}
          />
        </div>
        <div className="flex items-center gap-2">
          <Tabs
            options={viewOptions.map((o) => ({ ...o }))}
            value={view}
            onChange={setView}
            ariaLabel="Editor view"
          />
          <Button onClick={handleSave} disabled={saving || saved} size="sm">
            <Save className="w-4 h-4" aria-hidden="true" /> {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {editing && (
        <div
          className="flex items-center gap-0.5 px-3 py-2 border-b border-border overflow-x-auto"
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

      <div
        className={cn(
          'flex-1 min-h-0 overflow-hidden',
          view === 'split' && 'grid grid-cols-1 lg:grid-cols-2'
        )}
      >
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Spinner size="md" label="Loading note" />
          </div>
        ) : (
          <>
            {loadError && (
              <div className="px-4 py-2 text-sm text-destructive" role="alert">
                {loadError}
              </div>
            )}
            {editing && (
              <div
                className={cn(
                  'min-h-0 overflow-auto p-4',
                  view === 'split' && 'border-b lg:border-b-0 lg:border-r border-border'
                )}
              >
                <Textarea
                  ref={textareaRef}
                  aria-label="Markdown source"
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  className="h-full min-h-[400px] font-mono text-sm leading-relaxed"
                  spellCheck={false}
                />
              </div>
            )}
            {view !== 'write' && (
              <div className="min-h-0 overflow-auto p-4">
                <div className="md-content max-w-none">
                  {/* biome-ignore lint/security/noDangerouslySetInnerHtml: preview renders author-owned note markdown via marked */}
                  <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
                </div>
              </div>
            )}
          </>
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
