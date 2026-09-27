import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Checkbox } from '../components/ui/Checkbox';
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
import { Spinner } from '../components/ui/Spinner';
import { useLibraries } from '../hooks/useLibraries';
import { api } from '../services/api';
import { formatDistanceToNow } from '../utils/format';

interface McpToken {
  id: string;
  name: string;
  libraryId: string;
  permissions: { read?: boolean; write?: boolean; git?: boolean };
  expiresAt?: string | null;
  revokedAt?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
}

export function MCP() {
  const { currentLibrary } = useLibraries();
  const [tokens, setTokens] = useState<McpToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [canWrite, setCanWrite] = useState(false);
  const [canGit, setCanGit] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchTokens = useCallback(async () => {
    if (!currentLibrary?.id) {
      setLoading(false);
      setTokens([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = (await api.get('/mcp/tokens', {
        params: { libraryId: currentLibrary.id },
      })) as unknown as { success: boolean; data: McpToken[] };
      if (res.success) setTokens(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tokens');
    } finally {
      setLoading(false);
    }
  }, [currentLibrary?.id]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const handleCreate = async () => {
    if (!currentLibrary?.id || !name.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = (await api.post('/mcp/tokens', {
        name: name.trim(),
        libraryId: currentLibrary.id,
        permissions: { read: true, write: canWrite, git: canGit },
      })) as unknown as { success: boolean; data: { id: string; token: string } };
      if (res.success) {
        setCreatedToken(res.data.token);
        setName('');
        setCanWrite(false);
        setCanGit(false);
        await fetchTokens();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create token');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setBusy(true);
    try {
      await api.delete(`/mcp/tokens/${id}`);
      setConfirmDeleteId(null);
      await fetchTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke token');
    } finally {
      setBusy(false);
    }
  };

  const closeDialog = () => {
    setShowCreate(false);
    setCreatedToken(null);
  };

  if (!currentLibrary) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <PageHeader title="MCP Tokens" />
        <EmptyState
          icon={KeyRound}
          title="No library selected"
          description="Select a library to manage its MCP tokens."
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="MCP Tokens"
        description={`API tokens for ${currentLibrary.name}`}
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" aria-hidden="true" /> New token
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-3">
          {error && <Alert>{error}</Alert>}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="md" label="Loading tokens" />
            </div>
          ) : tokens.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              title="No tokens"
              description="Create a token so external tools can access this library."
            />
          ) : (
            tokens.map((t) => (
              <div
                key={t.id}
                className={`flex items-center gap-3 px-4 py-3 border border-border rounded-lg bg-bg-elevated ${t.revokedAt ? 'opacity-60' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-fg truncate">{t.name}</p>
                    {t.revokedAt ? (
                      <Badge variant="destructive">Revoked</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                    {[
                      t.permissions.read && 'read',
                      t.permissions.write && 'write',
                      t.permissions.git && 'git',
                    ]
                      .filter(Boolean)
                      .map((p) => (
                        <Badge key={p as string} variant="outline">
                          {p}
                        </Badge>
                      ))}
                  </div>
                  <p className="text-xs text-fg-subtle mt-0.5">
                    Created {formatDistanceToNow(t.createdAt)}
                    {t.expiresAt ? ` · expires ${formatDistanceToNow(t.expiresAt)}` : ''}
                    {t.lastUsedAt
                      ? ` · last used ${formatDistanceToNow(t.lastUsedAt)}`
                      : ' · never used'}
                  </p>
                </div>
                {!t.revokedAt && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDelete(t.id)}
                    disabled={busy}
                    aria-label={
                      confirmDeleteId === t.id ? `Confirm revoke ${t.name}` : `Revoke ${t.name}`
                    }
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    {confirmDeleteId === t.id ? 'Confirm?' : 'Revoke'}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={showCreate} onOpenChange={closeDialog}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>New token</DialogTitle>
            <DialogDescription>
              {createdToken
                ? 'Copy this token now — it will never be shown again.'
                : `Grant an external tool access to ${currentLibrary.name}.`}
            </DialogDescription>
          </DialogHeader>
          {createdToken ? (
            <div className="p-6 space-y-4">
              <code className="block p-3 rounded-md bg-bg border border-border text-sm text-fg break-all select-all">
                {createdToken}
              </code>
              <DialogFooter>
                <Button onClick={closeDialog}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="p-6 space-y-4">
                <Input
                  id="tokenName"
                  label="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="CI runner"
                />
                <Checkbox
                  label="Write access (create/edit files)"
                  checked={canWrite}
                  onChange={(e) => setCanWrite(e.target.checked)}
                />
                <Checkbox
                  label="Git access (commit/push/pull)"
                  checked={canGit}
                  onChange={(e) => setCanGit(e.target.checked)}
                />
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={busy || !name.trim()}>
                  {busy ? 'Creating…' : 'Create'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
