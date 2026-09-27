import { Bot, BrainCircuit, MessagesSquare, Plus, Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/Dialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { Spinner } from '../components/ui/Spinner';
import { Tabs } from '../components/ui/Tabs';
import { Textarea } from '../components/ui/Textarea';
import { useAuth } from '../hooks/useAuth';
import { useLibraries } from '../hooks/useLibraries';
import { api } from '../services/api';
import { formatDistanceToNow } from '../utils/format';

type AiTab = 'conversations' | 'providers' | 'index';

interface Conversation {
  id: string;
  title?: string | null;
  libraryId: string;
  messageCount?: number;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface Provider {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  chatModel: string;
  embedModel?: string | null;
  isDefault?: boolean;
  lastTestedAt?: string | null;
}

export function AI() {
  const { user } = useAuth();
  const { libraries, currentLibrary } = useLibraries();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState<AiTab>('conversations');

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="AI Assistant"
        description="Conversations, providers and index status"
        actions={
          <Tabs
            options={[
              { id: 'conversations', label: 'Conversations', icon: MessagesSquare },
              { id: 'providers', label: 'Providers', icon: BrainCircuit },
              { id: 'index', label: 'Index', icon: Bot },
            ]}
            value={tab}
            onChange={setTab}
            ariaLabel="AI sections"
          />
        }
      />
      <div className="flex-1 flex flex-col min-h-0">
        {tab === 'conversations' && (
          <ConversationsPanel libraries={libraries} currentLibraryId={currentLibrary?.id} />
        )}
        {tab === 'providers' &&
          (isAdmin ? (
            <ProvidersPanel />
          ) : (
            <EmptyState
              icon={BrainCircuit}
              title="Admin only"
              description="AI provider configuration requires an administrator account."
            />
          ))}
        {tab === 'index' && (
          <IndexPanel libraryId={currentLibrary?.id} libraryName={currentLibrary?.name} />
        )}
      </div>
    </div>
  );
}

function ConversationsPanel({
  libraries,
  currentLibraryId,
}: {
  libraries: { id: string; name: string }[];
  currentLibraryId?: string;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await api.get('/ai/chat/conversations', {
        params: { limit: '50' },
      })) as unknown as { success: boolean; data: { items: Conversation[] } };
      if (res.success) {
        setConversations(res.data.items);
        const first = res.data.items[0];
        if (!activeId && first) setActiveId(first.id);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  const fetchMessages = useCallback(async (id: string) => {
    try {
      const res = (await api.get(`/ai/chat/conversations/${id}/messages`, {
        params: { limit: '100' },
      })) as unknown as { success: boolean; data: { items: ChatMessage[] } };
      if (res.success) setMessages(res.data.items);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (activeId) fetchMessages(activeId);
    else setMessages([]);
  }, [activeId, fetchMessages]);

  const handleNew = async () => {
    const libId = currentLibraryId ?? libraries[0]?.id;
    if (!libId) return;
    setCreating(true);
    try {
      const res = (await api.post('/ai/chat/conversations', {
        libraryId: libId,
        title: 'New conversation',
      })) as unknown as { success: boolean; data: { id: string } };
      if (res.success) {
        await fetchConversations();
        setActiveId(res.data.id);
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleSend = async () => {
    if (!activeId || !draft.trim() || sending) return;
    setSending(true);
    try {
      await api.post(`/ai/chat/conversations/${activeId}/messages`, { content: draft.trim() });
      setDraft('');
      await fetchMessages(activeId);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size="md" label="Loading conversations" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex min-h-0">
      <aside
        className="w-60 shrink-0 border-r border-border p-2 space-y-1 overflow-y-auto hidden sm:block"
        aria-label="Conversations"
      >
        <Button
          variant="secondary"
          size="sm"
          className="w-full mb-2"
          onClick={handleNew}
          disabled={creating || libraries.length === 0}
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> New chat
        </Button>
        {conversations.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveId(c.id)}
            className={`w-full px-3 py-2 text-left text-sm rounded-md truncate transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeId === c.id ? 'bg-primary/10 text-primary font-medium' : 'text-fg hover:bg-bg-hover'}`}
          >
            {c.title || 'Untitled'}
          </button>
        ))}
        {conversations.length === 0 && (
          <p className="text-xs text-fg-muted px-3 py-2">No conversations yet.</p>
        )}
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        {!activeId ? (
          <EmptyState
            icon={MessagesSquare}
            title="No conversation selected"
            description="Create a chat to store messages. Note: automatic AI replies are not wired up on the backend yet — messages are stored for later processing."
            actions={
              <Button onClick={handleNew} disabled={creating || libraries.length === 0}>
                <Plus className="w-4 h-4" aria-hidden="true" /> New chat
              </Button>
            }
          />
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-2xl rounded-lg px-4 py-2.5 text-sm ${m.role === 'user' ? 'ml-auto bg-primary/10 text-fg' : 'mr-auto bg-bg-elevated border border-border text-fg'}`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  <p className="text-xs text-fg-subtle mt-1">{formatDistanceToNow(m.createdAt)}</p>
                </div>
              ))}
              {messages.length === 0 && (
                <p className="text-sm text-fg-muted text-center py-8">
                  No messages yet. Say hello below.
                </p>
              )}
            </div>
            <div className="border-t border-border p-3 flex gap-2">
              <Textarea
                aria-label="Message"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 min-h-[44px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Button
                onClick={handleSend}
                disabled={sending || !draft.trim()}
                aria-label="Send message"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ProvidersPanel() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('openai');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [chatModel, setChatModel] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = (await api.get('/ai/providers')) as unknown as {
        success: boolean;
        data: Provider[];
      };
      if (res.success) setProviders(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleCreate = async () => {
    if (!name.trim() || !baseUrl.trim() || !chatModel.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/ai/providers', {
        name: name.trim(),
        type,
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim() || undefined,
        chatModel: chatModel.trim(),
      });
      setShowCreate(false);
      setName('');
      setBaseUrl('');
      setApiKey('');
      setChatModel('');
      await fetchProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create provider');
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestResult('');
    try {
      const res = (await api.post(`/ai/providers/${id}/test`)) as unknown as {
        success: boolean;
        data?: { models?: string[] };
        error?: { message?: string };
      };
      if (res.success) {
        const models = res.data?.models ?? [];
        setTestResult(
          models.length > 0 ? `Connected. Models: ${models.slice(0, 5).join(', ')}` : 'Connected.'
        );
      } else {
        setTestResult(res.error?.message || 'Connection failed');
      }
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    try {
      await api.delete(`/ai/providers/${id}`);
      await fetchProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete provider');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-3xl mx-auto space-y-3">
        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" aria-hidden="true" /> New provider
          </Button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="md" label="Loading providers" />
          </div>
        ) : providers.length === 0 ? (
          <EmptyState
            icon={BrainCircuit}
            title="No providers"
            description="Add an OpenAI-compatible provider (OpenAI, Ollama or LM Studio) to enable AI features."
          />
        ) : (
          providers.map((p) => (
            <div key={p.id} className="border border-border rounded-lg bg-bg-elevated px-4 py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-fg">{p.name}</p>
                {p.isDefault && <Badge variant="default">Default</Badge>}
                <Badge variant="outline">{p.type}</Badge>
                <span className="ml-auto flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleTest(p.id)}
                    disabled={testingId === p.id}
                  >
                    {testingId === p.id ? 'Testing…' : 'Test'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDelete(p.id)}
                    disabled={busy}
                  >
                    Delete
                  </Button>
                </span>
              </div>
              <p className="text-xs text-fg-muted mt-1 truncate">
                {p.baseUrl} · {p.chatModel}
              </p>
              {p.lastTestedAt && (
                <p className="text-xs text-fg-subtle mt-0.5">
                  Last tested {formatDistanceToNow(p.lastTestedAt)}
                </p>
              )}
            </div>
          ))
        )}
        {testResult && <Alert variant="info">{testResult}</Alert>}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>New provider</DialogTitle>
            <DialogDescription>Connect an OpenAI-compatible chat API.</DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <Input
              id="providerName"
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Ollama"
            />
            <Select
              aria-label="Type"
              label="Type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              options={[
                { value: 'openai', label: 'OpenAI' },
                { value: 'ollama', label: 'Ollama' },
                { value: 'lm-studio', label: 'LM Studio' },
                { value: 'custom', label: 'Custom' },
              ]}
            />
            <Input
              id="providerBaseUrl"
              label="Base URL"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
            <Input
              id="providerApiKey"
              label="API key (optional)"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Stored encrypted"
            />
            <Input
              id="providerChatModel"
              label="Chat model"
              value={chatModel}
              onChange={(e) => setChatModel(e.target.value)}
              placeholder="gpt-4o-mini"
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={busy || !name.trim() || !baseUrl.trim() || !chatModel.trim()}
            >
              {busy ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IndexPanel({ libraryId, libraryName }: { libraryId?: string; libraryName?: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const fetchStatus = useCallback(async () => {
    if (!libraryId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = (await api.get(`/ai/index/${libraryId}/status`)) as unknown as {
        success: boolean;
        data: { status?: string } | null;
      };
      if (res.success) setStatus(res.data?.status ?? 'not_initialized');
    } catch (error) {
      console.error('Failed to load index status:', error);
    } finally {
      setLoading(false);
    }
  }, [libraryId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const run = async (action: 'rebuild' | 'pause' | 'resume') => {
    if (!libraryId) return;
    setBusy(true);
    setMessage('');
    try {
      const res = (await api.post(`/ai/index/${libraryId}/${action}`)) as unknown as {
        success: boolean;
        error?: { message?: string };
      };
      if (res.success) {
        setMessage(`Index ${action} requested.`);
        await fetchStatus();
      } else {
        setMessage(res.error?.message || `${action} failed`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${action} failed`);
    } finally {
      setBusy(false);
    }
  };

  if (!libraryId) {
    return (
      <EmptyState
        icon={Bot}
        title="No library selected"
        description="Select a library to view its search index status."
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-md mx-auto space-y-3">
        <div className="border border-border rounded-lg bg-bg-elevated px-4 py-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-fg flex-1 truncate">{libraryName}</p>
            {loading ? (
              <Spinner size="sm" />
            ) : (
              <Badge variant={status === 'ready' ? 'success' : 'outline'}>{status ?? '—'}</Badge>
            )}
          </div>
          <div className="flex gap-2 mt-3">
            <Button variant="secondary" size="sm" onClick={() => run('rebuild')} disabled={busy}>
              Rebuild
            </Button>
            <Button variant="secondary" size="sm" onClick={() => run('pause')} disabled={busy}>
              Pause
            </Button>
            <Button variant="secondary" size="sm" onClick={() => run('resume')} disabled={busy}>
              Resume
            </Button>
          </div>
        </div>
        {message && <Alert variant="info">{message}</Alert>}
        <p className="text-xs text-fg-subtle">
          Note: the backend has no embedding worker yet — rebuild only flips the status flag.
        </p>
      </div>
    </div>
  );
}
