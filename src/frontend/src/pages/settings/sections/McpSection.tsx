import { KeyRound, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/Dialog';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Input } from '../../../components/ui/Input';
import { Spinner } from '../../../components/ui/Spinner';
import { useLibraries } from '../../../hooks/useLibraries';
import { useTranslation } from '../../../hooks/useTranslation';
import { api } from '../../../services/api';
import { formatDistanceToNow } from '../../../utils/format';

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

export default function McpSection() {
  const { t } = useTranslation();
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
      setError(err instanceof Error ? err.message : t('sections.mcp.errorLoadTokens'));
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
      setError(err instanceof Error ? err.message : t('sections.mcp.errorCreateToken'));
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
      setError(err instanceof Error ? err.message : t('sections.mcp.errorRevokeToken'));
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
      <EmptyState
        icon={KeyRound}
        title={t('sections.mcp.emptyNoLibrarySelected')}
        description={t('sections.mcp.emptyManageTokens')}
      />
    );
  }

  return (
    <>
      <div className="max-w-3xl mx-auto space-y-3">
        {error && <Alert>{error}</Alert>}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="md" label={t('sections.mcp.spinnerLoadingTokens')} />
          </div>
        ) : tokens.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title={t('sections.mcp.emptyNoTokens')}
            description={t('sections.mcp.emptyNoTokensDescription')}
          />
        ) : (
          tokens.map((token) => (
            <div
              key={token.id}
              className={`flex items-center gap-3 px-4 py-3 border border-border rounded-lg bg-bg-elevated ${token.revokedAt ? 'opacity-60' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-fg truncate">{token.name}</p>
                  {token.revokedAt ? (
                    <Badge variant="destructive">{t('sections.mcp.badgeRevoked')}</Badge>
                  ) : (
                    <Badge variant="success">{t('sections.mcp.badgeActive')}</Badge>
                  )}
                  {[
                    token.permissions.read && 'read',
                    token.permissions.write && 'write',
                    token.permissions.git && 'git',
                  ]
                    .filter((p): p is string => Boolean(p))
                    .map((p) => {
                      const permKey = `sections.mcp.perm${p.charAt(0).toUpperCase() + p.slice(1)}`;
                      return (
                        <Badge key={p} variant="outline">
                          {t(permKey)}
                        </Badge>
                      );
                    })}
                </div>
                <p className="text-xs text-fg-subtle mt-0.5">
                  {t('sections.mcp.textCreated', { date: formatDistanceToNow(token.createdAt) })}
                  {token.expiresAt
                    ? ` · ${t('sections.mcp.textExpires', { date: formatDistanceToNow(token.expiresAt) })}`
                    : ''}
                  {token.lastUsedAt
                    ? ` · ${t('sections.mcp.textLastUsed', { date: formatDistanceToNow(token.lastUsedAt) })}`
                    : ` · ${t('sections.mcp.textNeverUsed')}`}
                </p>
              </div>
              {!token.revokedAt && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDelete(token.id)}
                  disabled={busy}
                  aria-label={
                    confirmDeleteId === token.id
                      ? t('sections.mcp.ariaConfirmRevoke', { name: token.name })
                      : t('sections.mcp.ariaRevoke', { name: token.name })
                  }
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  {confirmDeleteId === token.id
                    ? t('sections.mcp.btnConfirm')
                    : t('sections.mcp.btnRevoke')}
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={closeDialog}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t('sections.mcp.dialogNewToken')}</DialogTitle>
            <DialogDescription>
              {createdToken
                ? t('sections.mcp.dialogCopyToken')
                : t('sections.mcp.dialogGrantAccess', { libraryName: currentLibrary.name })}
            </DialogDescription>
          </DialogHeader>
          {createdToken ? (
            <div className="p-6 space-y-4">
              <code className="block p-3 rounded-md bg-bg border border-border text-sm text-fg break-all select-all">
                {createdToken}
              </code>
              <DialogFooter>
                <Button onClick={closeDialog}>{t('sections.mcp.btnDone')}</Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="p-6 space-y-4">
                <Input
                  id="tokenName"
                  label={t('sections.mcp.labelTokenName')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('sections.mcp.placeholderTokenName')}
                />
                <Checkbox
                  label={t('sections.mcp.labelWriteAccess')}
                  checked={canWrite}
                  onChange={(e) => setCanWrite(e.target.checked)}
                />
                <Checkbox
                  label={t('sections.mcp.labelGitAccess')}
                  checked={canGit}
                  onChange={(e) => setCanGit(e.target.checked)}
                />
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={closeDialog}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleCreate} disabled={busy || !name.trim()}>
                  {busy ? t('common.creating') : t('common.create')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
