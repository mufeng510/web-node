import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { api } from '../../services/api';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';

interface ChatMessage {
  id: string;
  role: string;
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  currentNoteId: string | null;
}

export interface AiRailPanelProps {
  libraryId: string;
  notePath: string;
}

const SEEN_LIMIT = 12;

/**
 * Asks the configured provider about the open note.
 *
 * The conversation is bound to the note via `currentNoteId`, which is what lets
 * the backend put the note's contents in front of the model; without it every
 * answer would be about the note's name rather than its text.
 */
export function AiRailPanel({ libraryId, notePath }: AiRailPanelProps) {
  const { t } = useTranslation();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async (id: string) => {
    try {
      const res = (await api.get(`/ai/chat/conversations/${id}/messages`, {
        params: { limit: '50' },
      })) as unknown as { success: boolean; data: { items: ChatMessage[] } };
      if (res.success) setMessages(res.data.items.slice(-SEEN_LIMIT));
    } catch {
      setError(t('editor.ai.loadFailed'));
    }
  }, []);

  // Reuse the note's conversation so its history survives closing the rail.
  useEffect(() => {
    let cancelled = false;
    setConversationId(null);
    setMessages([]);
    setError(null);

    (async () => {
      try {
        const res = (await api.get('/ai/chat/conversations', {
          params: { libraryId, limit: '50' },
        })) as unknown as {
          success: boolean;
          data: { items: Conversation[] };
        };
        if (cancelled || !res.success) return;
        const existing = res.data.items.find((c) => c.currentNoteId === notePath);
        if (!existing || cancelled) return;
        setConversationId(existing.id);
        await loadMessages(existing.id);
      } catch {
        if (!cancelled) setError(t('editor.ai.loadFailed'));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [libraryId, notePath, loadMessages]);

  const send = async () => {
    const content = draft.trim();
    if (!content || busy) return;
    setBusy(true);
    setError(null);

    try {
      let id = conversationId;
      if (!id) {
        const created = (await api.post('/ai/chat/conversations', {
          libraryId,
          title: notePath.split('/').pop() ?? notePath,
          currentNoteId: notePath,
        })) as unknown as { success: boolean; data: { id: string } };
        if (!created.success) throw new Error('创建对话失败');
        id = created.data.id;
        setConversationId(id);
      }

      const res = (await api.post(`/ai/chat/conversations/${id}/messages`, {
        content,
      })) as unknown as { success: boolean; error?: { message: string } };
      setDraft('');
      if (res.error) setError(res.error.message);
      await loadMessages(id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('editor.ai.sendFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
        {messages.length === 0 && !error && (
          <p className="text-sm text-fg-muted">{t('editor.ai.askPrompt')}</p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === 'user'
                ? 'ml-4 rounded-lg bg-primary/10 px-3 py-2 text-sm'
                : 'mr-4 rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm'
            }
          >
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
        ))}
        {busy && (
          <div className="px-1 py-1">
            <Spinner size="sm" label={t('editor.ai.generating')} />
          </div>
        )}
        {error && (
          <p role="alert" className="px-1 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="flex gap-2 border-t border-border p-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void send();
            }
          }}
          rows={2}
          placeholder={t('editor.ai.placeholder')}
          aria-label={t('editor.ai.ariaLabel')}
          className="min-h-[2.5rem] flex-1 resize-none rounded-md border border-border bg-bg px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button onClick={() => void send()} disabled={busy || !draft.trim()} size="sm">
          {t('editor.ai.send')}
        </Button>
      </div>
    </div>
  );
}
