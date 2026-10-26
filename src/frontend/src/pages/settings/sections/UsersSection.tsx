import { MonitorSmartphone, Trash2, Unlock } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
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
import { Select } from '../../../components/ui/Select';
import { Spinner } from '../../../components/ui/Spinner';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../hooks/useTranslation';
import { api } from '../../../services/api';
import { formatDistanceToNow } from '../../../utils/format';

interface UserItem {
  id: string;
  email: string;
  role: 'admin' | 'user';
  isActive: boolean;
  failedLoginAttempts?: number;
  lockedUntil?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
}

interface SessionItem {
  id: string;
  deviceInfo?: string | null;
  ip?: string | null;
  expiresAt: string;
  createdAt: string;
  lastActivityAt?: string | null;
}

export default function UsersSection() {
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = (await api.get('/users')) as unknown as {
        success: boolean;
        data: UserItem[];
      };
      if (res.success) setUsers(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sections.users.errorLoadUsers'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async () => {
    if (!email.trim() || !password.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/users', { email: email.trim(), password, role });
      setShowCreate(false);
      setEmail('');
      setPassword('');
      setRole('user');
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sections.users.errorCreateUser'));
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (u: UserItem) => {
    setBusy(true);
    try {
      await api.patch(`/users/${u.id}`, { isActive: !u.isActive });
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sections.users.errorUpdateUser'));
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (u: UserItem, next: 'admin' | 'user') => {
    if (next === u.role) return;
    setBusy(true);
    try {
      await api.patch(`/users/${u.id}`, { role: next });
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sections.users.errorUpdateRole'));
    } finally {
      setBusy(false);
    }
  };

  const handleUnlock = async (id: string) => {
    setBusy(true);
    try {
      await api.post(`/users/${id}/unlock`);
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sections.users.errorUnlockUser'));
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
      await api.delete(`/users/${id}`);
      setConfirmDeleteId(null);
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sections.users.errorDeleteUser'));
    } finally {
      setBusy(false);
    }
  };

  const toggleSessions = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setSessionsLoading(true);
    try {
      const res = (await api.get(`/users/${id}/sessions`)) as unknown as {
        success: boolean;
        data: SessionItem[];
      };
      if (res.success) setSessions(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sections.users.errorLoadSessions'));
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleRevokeSessions = async (id: string) => {
    setBusy(true);
    try {
      await api.delete(`/users/${id}/sessions`);
      setSessions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sections.users.errorRevokeSessions'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="max-w-3xl mx-auto space-y-3">
        {error && <Alert>{error}</Alert>}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="md" label="Loading users" />
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={Unlock}
            title={t('sections.users.emptyNoUsers')}
            description={t('sections.users.emptyNoAccountsFound')}
          />
        ) : (
          users.map((u) => (
            <div key={u.id} className="border border-border rounded-lg bg-bg-elevated">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-fg truncate">{u.email}</p>
                    {me?.id === u.id && (
                      <Badge variant="outline">{t('sections.users.badgeYou')}</Badge>
                    )}
                    {!u.isActive && (
                      <Badge variant="destructive">{t('sections.users.badgeDisabled')}</Badge>
                    )}
                    {u.lockedUntil && (
                      <Badge variant="destructive">{t('sections.users.badgeLocked')}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-fg-subtle mt-0.5">
                    {u.role} ·{' '}
                    {t('sections.users.textJoined', { date: formatDistanceToNow(u.createdAt) })}
                    {u.lastLoginAt
                      ? ` · ${t('sections.users.textLastLogin', { date: formatDistanceToNow(u.lastLoginAt) })}`
                      : ''}
                  </p>
                </div>
                <div className="w-28 flex-shrink-0">
                  <Select
                    aria-label={`Role for ${u.email}`}
                    value={u.role}
                    onChange={(e) => handleRoleChange(u, e.target.value as 'admin' | 'user')}
                    options={[
                      { value: 'admin', label: t('sections.users.labelRoleAdmin') },
                      { value: 'user', label: t('sections.users.labelRoleUser') },
                    ]}
                    disabled={busy || me?.id === u.id}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 pb-3 flex-wrap">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => toggleSessions(u.id)}
                  disabled={busy}
                >
                  <MonitorSmartphone className="w-4 h-4" aria-hidden="true" />
                  {expandedId === u.id
                    ? t('sections.users.btnHideSessions')
                    : t('sections.users.btnSessions')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleToggleActive(u)}
                  disabled={busy || me?.id === u.id}
                >
                  {u.isActive ? t('sections.users.btnDisable') : t('sections.users.btnEnable')}
                </Button>
                {u.lockedUntil && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleUnlock(u.id)}
                    disabled={busy}
                  >
                    <Unlock className="w-4 h-4" aria-hidden="true" />{' '}
                    {t('sections.users.btnUnlock')}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDelete(u.id)}
                  disabled={busy || me?.id === u.id}
                  aria-label={
                    confirmDeleteId === u.id ? `Confirm delete ${u.email}` : `Delete ${u.email}`
                  }
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  {confirmDeleteId === u.id
                    ? t('sections.users.btnConfirmDelete')
                    : t('sections.users.btnDelete')}
                </Button>
              </div>
              {expandedId === u.id && (
                <div className="border-t border-border px-4 py-3">
                  {sessionsLoading ? (
                    <Spinner size="sm" label="Loading sessions" />
                  ) : sessions.length === 0 ? (
                    <p className="text-sm text-fg-muted">
                      {t('sections.users.textNoActiveSessions')}
                    </p>
                  ) : (
                    <>
                      <ul className="space-y-1.5">
                        {sessions.map((s) => (
                          <li key={s.id} className="text-xs text-fg-muted">
                            {s.deviceInfo || t('sections.users.unknownDevice')} ·{' '}
                            {s.ip || t('sections.users.unknownIp')} · last active{' '}
                            {s.lastActivityAt ? formatDistanceToNow(s.lastActivityAt) : '—'}
                          </li>
                        ))}
                      </ul>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-2"
                        onClick={() => handleRevokeSessions(u.id)}
                        disabled={busy}
                      >
                        {t('sections.users.btnRevokeAllSessions')}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t('sections.users.dialogNewUser')}</DialogTitle>
            <DialogDescription>{t('sections.users.dialogNewUserDescription')}</DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <Input
              id="newUserEmail"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
            <Input
              id="newUserPassword"
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
            <Select
              aria-label="Role"
              label="Role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
              options={[
                { value: 'user', label: t('sections.users.labelRoleUser') },
                { value: 'admin', label: t('sections.users.labelRoleAdmin') },
              ]}
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={busy || !email.trim() || !password.trim()}>
              {busy ? t('common.creating') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
