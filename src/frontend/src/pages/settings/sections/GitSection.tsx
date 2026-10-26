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
import { useTranslation } from '../../../hooks/useTranslation';
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

interface DetectedRepo {
  isRepository: boolean;
  remotes: { name: string; url: string; fetchUrl: string; pushUrl: string }[];
  branch: string | null;
  upstream: string | null;
}

export default function GitSection() {
  const { t } = useTranslation();

  const AUTH_OPTIONS: { value: AuthType; label: string }[] = [
    { value: 'none', label: t('sections.git.authNone') },
    { value: 'https', label: t('sections.git.authHttps') },
    { value: 'ssh', label: t('sections.git.authSsh') },
  ];

  const CREDENTIALS_HINT: Record<AuthType, string> = {
    none: t('sections.git.hintCredentialsNone'),
    https: t('sections.git.hintCredentialsStored'),
    ssh: t('sections.git.hintCredentialsNone'),
  };

  const SCHEDULE_PRESETS: { label: string; value: string }[] = [
    { label: t('sections.git.presetEvery5Minutes'), value: '*/5 * * * *' },
    { label: t('sections.git.presetEveryHour'), value: '0 * * * *' },
    { label: t('sections.git.presetEveryDay2am'), value: '0 2 * * *' },
    { label: t('sections.git.presetEveryMonday3am'), value: '0 3 * * 1' },
  ];

  const { currentLibrary, updateLibrary } = useLibraries();
  const [config, setConfig] = useState<GitConfig | null>(null);
  const [detected, setDetected] = useState<DetectedRepo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
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
      // config 和 detect 分别请求：detect 失败（例如旧部署没有该端点）
      // 不应导致已保存的配置无法显示。
      const configRes = (await api.get(`/git/${currentLibrary.id}/config`)) as unknown as {
        success: boolean;
        data: GitConfig;
      };
      let detectRes: { success: boolean; data: DetectedRepo } | null = null;
      try {
        detectRes = (await api.get(`/git/${currentLibrary.id}/detect`)) as unknown as {
          success: boolean;
          data: DetectedRepo;
        };
      } catch {
        // detect 失败不影响配置显示
      }

      if (configRes.success) {
        const saved = configRes.data;
        const repo = detectRes?.success ? detectRes.data : null;

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
        setError(t('sections.git.errorLoadGit'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sections.git.errorLoadGit'));
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

  const handleTestConnection = async () => {
    if (!currentLibrary?.id) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = (await api.post(`/git/${currentLibrary.id}/test`)) as unknown as {
        success: boolean;
        data?: { message: string };
        error?: { message?: string };
      };
      if (res.success) {
        setTestResult({
          type: 'success',
          message: res.data?.message ?? t('sections.git.msgConnectionSuccessful'),
        });
      } else {
        setTestResult({
          type: 'error',
          message: res.error?.message || t('sections.git.msgTestFailed'),
        });
      }
    } catch (err) {
      setTestResult({
        type: 'error',
        message: err instanceof Error ? err.message : t('sections.git.msgTestFailed'),
      });
    } finally {
      setTestLoading(false);
    }
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
      setNotice(t('sections.git.msgGitConfigSaved'));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sections.git.errorSaveGit'));
    } finally {
      setSaving(false);
    }
  };

  if (!currentLibrary) {
    return (
      <EmptyState
        icon={GitBranch}
        title={t('sections.git.emptyNoLibrarySelected')}
        description={t('sections.git.emptyConfigureGit')}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" label={t('sections.git.spinnerLoadingGitConfig')} />
      </div>
    );
  }

  if (!config) {
    return <Alert>{error || t('sections.git.errorLoadGit')}</Alert>;
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
            <GitBranch className="w-5 h-5 text-fg-muted" aria-hidden="true" />{' '}
            {t('sections.git.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {detected?.isRepository && (
            <div className="rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="success">{t('sections.git.detected')}</Badge>
                {detected.branch && (
                  <span className="text-fg-muted">
                    on branch <span className="text-fg">{detected.branch}</span>
                  </span>
                )}
              </div>
              {detected.remotes.length > 0 ? (
                <p className="mt-1.5 text-xs text-fg-muted">
                  {detected.remotes.length === 1
                    ? t('sections.git.labelRemote')
                    : t('sections.git.labelRemotes')}
                  {detected.remotes.map((r) => `${r.name} → ${r.url || '(no url)'}`).join(', ')}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-fg-muted">{t('sections.git.textNoRemote')}</p>
              )}
            </div>
          )}

          <SettingRow
            label={t('sections.git.labelEnableGit')}
            description={t('sections.git.descEnableGit')}
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
            label={t('sections.git.labelRemoteUrl')}
            value={config.remoteUrl}
            onChange={(e) => update('remoteUrl', e.target.value)}
            placeholder={t('sections.git.placeholderRemoteUrl')}
            hint={
              detected?.isRepository
                ? t('sections.git.hintRemoteUrlDetected')
                : t('sections.git.hintRemoteUrlLocal')
            }
          />

          <Input
            id="git-branch"
            label={t('sections.git.labelBranch')}
            value={config.branch}
            onChange={(e) => update('branch', e.target.value)}
            placeholder={t('sections.git.placeholderBranch')}
            hint={detected?.branch ? t('sections.git.hintBranch') : undefined}
          />

          <div className="flex items-center gap-2">
            <Button
              onClick={handleTestConnection}
              disabled={testLoading || !config.remoteUrl}
              size="sm"
            >
              {testLoading ? (
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {testLoading ? t('common.testing') : t('sections.git.btnTestConnection')}
            </Button>
            {testResult && (
              <Badge variant={testResult.type === 'success' ? 'success' : 'destructive'}>
                {testResult.message}
              </Badge>
            )}
          </div>

          <Select
            id="git-auth-type"
            label={t('sections.git.labelAuthentication')}
            value={config.authType}
            onChange={(e) => update('authType', e.target.value as AuthType)}
            options={AUTH_OPTIONS}
            hint={CREDENTIALS_HINT[config.authType]}
          />

          {config.authType !== 'none' && (
            <div className="space-y-2">
              <Input
                id="git-credentials"
                label={t('sections.git.labelCredentials')}
                type="password"
                value={credentials}
                onChange={(e) => {
                  setCredentials(e.target.value);
                  setClearCredentials(false);
                }}
                disabled={clearCredentials}
                placeholder={
                  config.hasCredentials
                    ? t('sections.git.placeholderCredentialsUnchanged')
                    : t('sections.git.placeholderCredentials')
                }
                leadingIcon={<KeyRound className="w-4 h-4" />}
                hint={
                  clearCredentials
                    ? t('sections.git.hintCredentialsRemove')
                    : config.hasCredentials
                      ? t('sections.git.hintCredentialsStored')
                      : t('sections.git.hintCredentialsNone')
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
                  {clearCredentials
                    ? t('sections.git.btnKeepCredentials')
                    : t('sections.git.btnClearCredentials')}
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
            label={t('sections.git.labelAutoBackup')}
            description={t('sections.git.descAutoBackup')}
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
                label={t('sections.git.labelSchedule')}
                value={config.autoBackupSchedule}
                onChange={(e) => update('autoBackupSchedule', e.target.value)}
                placeholder={t('sections.git.placeholderSchedule')}
                hint={t('sections.git.hintSchedule')}
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
            <span className="text-fg-muted">{t('sections.git.labelLastBackup')}</span>
            {lastBackup ? (
              <Badge variant="success">{lastBackup}</Badge>
            ) : (
              <Badge variant="outline">{t('sections.git.textNever')}</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4" aria-hidden="true" />
          {saving ? t('common.saving') : t('sections.git.btnSaveGitConfig')}
        </Button>
      </div>
    </div>
  );
}
