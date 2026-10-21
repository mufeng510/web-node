import { GitBranch, KeyRound, RefreshCw, Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { SettingRow } from '../../../components/ui/SettingRow';
import { Spinner } from '../../../components/ui/Spinner';
import { Switch } from '../../../components/ui/Switch';
import { useLibraries } from '../../../hooks/useLibraries';
import { api } from '../../../services/api';

type AuthType = 'none' | 'https' | 'ssh';

interface GitConfig {
  enabled: boolean;
  remoteUrl: string;
  branch: string;
  authType: AuthType;
  hasCredentials: boolean;
  autoBackup: boolean;
  autoBackupSchedule: string;
  lastBackupAt: number | null;
}

const AUTH_OPTIONS: { value: AuthType; label: string }[] = [
  { value: 'none', label: 'None (public repo)' },
  { value: 'https', label: 'HTTPS (username / token)' },
  { value: 'ssh', label: 'SSH (private key)' },
];

const CREDENTIALS_HINT: Record<AuthType, string> = {
  none: 'No credentials are used.',
  https: 'Format: username:password, or a personal access token on its own.',
  ssh: 'Absolute path to the private key file inside the container.',
};

const SCHEDULE_PRESETS: { label: string; value: string }[] = [
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day at 02:00', value: '0 2 * * *' },
  { label: 'Every Monday at 03:00', value: '0 3 * * 1' },
];

interface DetectedRepo {
  isRepository: boolean;
  remotes: { name: string; url: string; fetchUrl: string; pushUrl: string }[];
  branch: string | null;
  upstream: string | null;
}

export default function GitSection() {
  const { currentLibrary, updateLibrary } = useLibraries();
  const [config, setConfig] = useState<GitConfig | null>(null);
  const [detected, setDetected] = useState<DetectedRepo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  /** 凭据输入框留空表示“保持原值”，避免把已存凭据覆盖成空 */
  const [credentials, setCredentials] = useState('');
  const [clearCredentials, setClearCredentials] = useState(false);

  const load = useCallback(async () => {
    if (!currentLibrary?.id) {
      setLoading(false);
      setConfig(null);
      setDetected(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [configRes, detectRes] = (await Promise.all([
        api.get(`/git/${currentLibrary.id}/config`),
        api.get(`/git/${currentLibrary.id}/detect`),
      ])) as unknown as [
        { success: boolean; data: GitConfig },
        { success: boolean; data: DetectedRepo },
      ];

      if (configRes.success) {
        const saved = configRes.data;
        const repo = detectRes.success ? detectRes.data : null;

        // 库里已经是个 Git 仓库，但 Web Note 自己还没配过：把仓库里已有的
        // remote 和分支预填进表单，用户能一眼看出系统读到的是什么，
        // 确认或改完再保存。
        const origin = repo?.remotes.find((r) => r.name === 'origin') ?? repo?.remotes[0];
        const prefilled: GitConfig = {
          ...saved,
          remoteUrl: saved.remoteUrl || origin?.url || '',
          branch: saved.branch || repo?.branch || saved.branch,
        };

        setConfig(prefilled);
        setDetected(repo);
        setCredentials('');
        setClearCredentials(false);
      } else {
        setError('Failed to load Git configuration');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Git configuration');
    } finally {
      setLoading(false);
    }
  }, [currentLibrary?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const update = <K extends keyof GitConfig>(key: K, value: GitConfig[K]) => {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
    setNotice('');
  };

  const handleSave = async () => {
    if (!currentLibrary?.id || !config) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const git: Record<string, unknown> = {
        enabled: config.enabled,
        remoteUrl: config.remoteUrl,
        branch: config.branch,
        authType: config.authType,
        autoBackup: config.autoBackup,
        autoBackupSchedule: config.autoBackupSchedule,
      };
      // 只有用户明确输入或勾选清除时才发送 credentials，其余情况沿用已存值
      if (clearCredentials) {
        git.credentials = '';
      } else if (credentials) {
        git.credentials = credentials;
      }

      await updateLibrary(currentLibrary.id, { git });
      setCredentials('');
      setClearCredentials(false);
      setNotice('Git configuration saved.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Git configuration');
    } finally {
      setSaving(false);
    }
  };

  if (!currentLibrary) {
    return (
      <EmptyState
        icon={GitBranch}
        title="No library selected"
        description="Select a library to configure its Git remote and automatic backups."
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" label="Loading Git configuration" />
      </div>
    );
  }

  if (!config) {
    return <Alert>{error || 'Failed to load Git configuration'}</Alert>;
  }

  const lastBackup = config.lastBackupAt
    ? new Date(config.lastBackupAt * 1000).toLocaleString()
    : null;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {error && <Alert>{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-fg-muted" aria-hidden="true" /> Git Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {detected?.isRepository && (
            <div className="rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="success">Git repository detected</Badge>
                {detected.branch && (
                  <span className="text-fg-muted">
                    on branch <span className="text-fg">{detected.branch}</span>
                  </span>
                )}
              </div>
              {detected.remotes.length > 0 ? (
                <p className="mt-1.5 text-xs text-fg-muted">
                  {detected.remotes.length === 1 ? 'Remote: ' : 'Remotes: '}
                  {detected.remotes.map((r) => `${r.name} → ${r.url || '(no url)'}`).join(', ')}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-fg-muted">
                  This repository has no remote configured yet.
                </p>
              )}
            </div>
          )}

          <SettingRow
            label="Enable Git"
            description="Track this library in a Git repository and allow commit, push and pull."
            control={
              <Switch
                id="git-enabled"
                checked={config.enabled}
                onChange={(e) => update('enabled', e.target.checked)}
              />
            }
          />

          <Input
            id="git-remote-url"
            label="Remote URL"
            value={config.remoteUrl}
            onChange={(e) => update('remoteUrl', e.target.value)}
            placeholder="https://github.com/owner/repo.git"
            hint={
              detected?.isRepository
                ? 'Prefilled from the repository. Leave empty to use the repository’s own remote as-is.'
                : 'Leave empty to keep the repository local only.'
            }
          />

          <Input
            id="git-branch"
            label="Branch"
            value={config.branch}
            onChange={(e) => update('branch', e.target.value)}
            placeholder="main"
            hint={detected?.branch ? 'Prefilled from the repository’s current branch.' : undefined}
          />

          <Select
            id="git-auth-type"
            label="Authentication"
            value={config.authType}
            onChange={(e) => update('authType', e.target.value as AuthType)}
            options={AUTH_OPTIONS}
            hint={CREDENTIALS_HINT[config.authType]}
          />

          {config.authType !== 'none' && (
            <div className="space-y-2">
              <Input
                id="git-credentials"
                label="Credentials"
                type="password"
                value={credentials}
                onChange={(e) => {
                  setCredentials(e.target.value);
                  setClearCredentials(false);
                }}
                disabled={clearCredentials}
                placeholder={
                  config.hasCredentials ? '•••••••• (unchanged)' : 'username:password or token'
                }
                leadingIcon={<KeyRound className="w-4 h-4" />}
                hint={
                  clearCredentials
                    ? 'Credentials will be removed when you save.'
                    : config.hasCredentials
                      ? 'Credentials are stored encrypted. Leave blank to keep the current value.'
                      : 'No credentials stored yet.'
                }
              />
              {config.hasCredentials && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setClearCredentials((v) => !v);
                    setCredentials('');
                  }}
                >
                  {clearCredentials ? 'Keep credentials' : 'Clear credentials'}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-fg-muted" aria-hidden="true" /> Automatic Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingRow
            label="Auto backup"
            description="Commit and push this library automatically on a schedule."
            control={
              <Switch
                id="git-auto-backup"
                checked={config.autoBackup}
                onChange={(e) => update('autoBackup', e.target.checked)}
              />
            }
          />

          {config.autoBackup && (
            <>
              <Input
                id="git-auto-backup-schedule"
                label="Schedule (cron)"
                value={config.autoBackupSchedule}
                onChange={(e) => update('autoBackupSchedule', e.target.value)}
                placeholder="0 * * * *"
                hint="Five fields: minute hour day-of-month month day-of-week. The server checks every minute."
              />
              <div className="flex flex-wrap gap-2">
                {SCHEDULE_PRESETS.map((preset) => (
                  <Button
                    key={preset.value}
                    variant="secondary"
                    size="sm"
                    onClick={() => update('autoBackupSchedule', preset.value)}
                    aria-pressed={config.autoBackupSchedule === preset.value}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-fg-muted">Last backup</span>
            {lastBackup ? (
              <Badge variant="success">{lastBackup}</Badge>
            ) : (
              <Badge variant="outline">Never</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4" aria-hidden="true" />
          {saving ? 'Saving…' : 'Save Git configuration'}
        </Button>
      </div>
    </div>
  );
}
