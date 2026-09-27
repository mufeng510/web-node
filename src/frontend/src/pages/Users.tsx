import { MonitorSmartphone, Plus, Trash2, Unlock } from 'lucide-react';
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
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { formatDistanceToNow } from '../utils/format';

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

export function Users() {
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
      setError(err instanceof Error ? err.message : 'Failed to load users');
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
      setError(err instanceof Error ? err.message : 'Failed to create user');
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
      setError(err instanceof Error ? err.message : 'Failed to update user');
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
      setError(err instanceof Error ? err.message : 'Failed to update role');
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
      setError(err instanceof Error ? err.message : 'Failed to unlock user');
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
      setError(err instanceof Error ? err.message : 'Failed to delete user');
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
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
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
      setError(err instanceof Error ? err.message : 'Failed to revoke sessions');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="Users"
        description="Manage accounts, roles and sessions"
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" aria-hidden="true" /> New User
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-3">
          {error && <Alert>{error}</Alert>}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="md" label="Loading users" />
            </div>
          ) : users.length === 0 ? (
            <EmptyState icon={Unlock} title="No users" description="No accounts found." />
          ) : (
            users.map((u) => (
              <div key={u.id} className="border border-border rounded-lg bg-bg-elevated">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-fg truncate">{u.email}</p>
                      {me?.id === u.id && <Badge variant="outline">You</Badge>}
                      {!u.isActive && <Badge variant="destructive">Disabled</Badge>}
                      {u.lockedUntil && <Badge variant="destructive">Locked</Badge>}
                    </div>
                    <p className="text-xs text-fg-subtle mt-0.5">
                      {u.role} · joined {formatDistanceToNow(u.createdAt)}
                      {u.lastLoginAt ? ` · last login ${formatDistanceToNow(u.lastLoginAt)}` : ''}
                    </p>
                  </div>
                  <div className="w-28 flex-shrink-0">
                    <Select
                      aria-label={`Role for ${u.email}`}
                      value={u.role}
                      onChange={(e) => handleRoleChange(u, e.target.value as 'admin' | 'user')}
                      options={[
                        { value: 'admin', label: 'Admin' },
                        { value: 'user', label: 'User' },
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
                    {expandedId === u.id ? 'Hide sessions' : 'Sessions'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleToggleActive(u)}
                    disabled={busy || me?.id === u.id}
                  >
                    {u.isActive ? 'Disable' : 'Enable'}
                  </Button>
                  {u.lockedUntil && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleUnlock(u.id)}
                      disabled={busy}
                    >
                      <Unlock className="w-4 h-4" aria-hidden="true" /> Unlock
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
                    {confirmDeleteId === u.id ? 'Confirm?' : 'Delete'}
                  </Button>
                </div>
                {expandedId === u.id && (
                  <div className="border-t border-border px-4 py-3">
                    {sessionsLoading ? (
                      <Spinner size="sm" label="Loading sessions" />
                    ) : sessions.length === 0 ? (
                      <p className="text-sm text-fg-muted">No active sessions.</p>
                    ) : (
                      <>
                        <ul className="space-y-1.5">
                          {sessions.map((s) => (
                            <li key={s.id} className="text-xs text-fg-muted">
                              {s.deviceInfo || 'Unknown device'} · {s.ip || 'unknown IP'} · last
                              active{' '}
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
                          Revoke all sessions
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>New User</DialogTitle>
            <DialogDescription>
              Create an account. The user signs in with email and password.
            </DialogDescription>
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
                { value: 'user', label: 'User' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={busy || !email.trim() || !password.trim()}>
              {busy ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
