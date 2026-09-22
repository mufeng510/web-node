import {
  Bold,
  Code,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Save,
  Strikethrough,
} from 'lucide-react';
import { marked } from 'marked';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { StatusDot } from '../components/ui/StatusDot';
import { Tabs } from '../components/ui/Tabs';
import { Textarea } from '../components/ui/Textarea';
import { ToolbarButton } from '../components/ui/ToolbarButton';
import { cn } from '../lib/utils';

type EditorView = 'write' | 'preview' | 'split';

const viewOptions = [
  { id: 'write', label: 'Write' },
  { id: 'preview', label: 'Preview' },
  { id: 'split', label: 'Split' },
] as const;

export function Editor() {
  const { libraryId } = useParams<{ libraryId: string }>();
  const [notePath, setNotePath] = useState<string>('');
  const [content, setContent] = useState('');
  const [view, setView] = useState<EditorView>('split');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (libraryId) {
      loadNote();
    }
  }, [libraryId]);

  const loadNote = async () => {
    try {
      setContent('# Welcome to Web Note\n\nStart writing your notes here...');
      setSaved(true);
    } catch (error) {
      console.error('Failed to load note:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setSaved(true);
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

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-border bg-bg-elevated/50">
        <div className="flex items-center gap-3 min-w-0">
          <Input
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
        </div>
      )}

      <div
        className={cn(
          'flex-1 min-h-0 overflow-hidden',
          view === 'split' && 'grid grid-cols-1 lg:grid-cols-2'
        )}
      >
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
      </div>
    </div>
  );
}
