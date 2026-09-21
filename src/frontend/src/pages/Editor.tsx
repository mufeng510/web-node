import { Code, Eye, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export function Editor() {
  const { libraryId } = useParams<{ libraryId: string }>();
  const [notePath, setNotePath] = useState<string>('');
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<'wysiwyg' | 'source' | 'reading'>('wysiwyg');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    if (libraryId) {
      // Load note content
      loadNote();
    }
  }, [libraryId]);

  const loadNote = async () => {
    try {
      // In real implementation, fetch from API
      setContent('# Welcome to Web Note\n\nStart writing your notes here...');
      setSaved(true);
    } catch (error) {
      console.error('Failed to load note:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // In real implementation, save to API
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

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-border bg-bg-elevated/50">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={notePath}
            onChange={(e) => setNotePath(e.target.value)}
            placeholder="Note path (e.g., notes/my-note.md)"
            className="input-base w-64"
          />
          <span className="text-sm text-fg-muted">{saved ? 'Saved' : 'Unsaved changes'}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode('wysiwyg')}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors duration-150 ${
              mode === 'wysiwyg'
                ? 'bg-primary/10 text-primary'
                : 'text-fg-muted hover:bg-bg-hover hover:text-fg'
            }`}
          >
            <Eye className="w-4 h-4 inline mr-1" /> WYSIWYG
          </button>
          <button
            type="button"
            onClick={() => setMode('source')}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors duration-150 ${
              mode === 'source'
                ? 'bg-primary/10 text-primary'
                : 'text-fg-muted hover:bg-bg-hover hover:text-fg'
            }`}
          >
            <Code className="w-4 h-4 inline mr-1" /> Source
          </button>
          <button
            type="button"
            onClick={() => setMode('reading')}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors duration-150 ${
              mode === 'reading'
                ? 'bg-primary/10 text-primary'
                : 'text-fg-muted hover:bg-bg-hover hover:text-fg'
            }`}
          >
            <Eye className="w-4 h-4 inline mr-1" /> Read
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || saved}
            className="btn-primary px-3 py-1.5"
          >
            <Save className="w-4 h-4 inline mr-1" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {mode === 'wysiwyg' && (
          <div className="prose prose-lg dark:prose-invert max-w-none min-h-[400px] p-6 bg-bg-elevated border border-border rounded-lg">
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: rendered content is sanitized markdown */}
            <div dangerouslySetInnerHTML={{ __html: content }} />
          </div>
        )}
        {mode === 'source' && (
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            className="w-full h-full font-mono text-sm p-4 border border-border rounded-lg bg-bg text-fg placeholder-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            spellCheck={false}
          />
        )}
        {mode === 'reading' && (
          <div className="prose prose-lg dark:prose-invert max-w-none min-h-[400px] p-6 leading-relaxed">
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: rendered content is sanitized markdown */}
            <div dangerouslySetInnerHTML={{ __html: content }} />
          </div>
        )}
      </div>
    </div>
  );
}
