import { Database, Download, Lock, LogOut, Palette, Trash2, User, Wrench } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Checkbox } from '../components/ui/Checkbox';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Tabs } from '../components/ui/Tabs';
import { useAuth } from '../hooks/useAuth';
import { useLibraries } from '../hooks/useLibraries';
import { cn } from '../lib/utils';
import { api } from '../services/api';

type SettingsTab = 'account' | 'security' | 'appearance' | 'advanced';
type ThemeChoice = 'light' | 'dark' | 'system';

function readStoredTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // storage unavailable — fall through to system
  }
  return 'system';
}

function applyTheme(theme: ThemeChoice) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function Settings() {
  const { user, changePassword, logoutAll } = useAuth();
  const { libraries, currentLibrary, setCurrentLibrary, deleteLibrary } = useLibraries();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [saving, setSaving] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [libraryBusyId, setLibraryBusyId] = useState<string | null>(null);

  // Account tab (display only; users router is admin-only)
  const [email] = useState(user?.email || '');

  // Advanced tab
  const [advancedMsg, setAdvancedMsg] = useState('');
  const [advancedBusy, setAdvancedBusy] = useState(false);

  // Security tab
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Appearance tab
  const [theme, setTheme] = useState<ThemeChoice>(() => readStoredTheme());
  const [fontSize, setFontSize] = useState(16);
  const [language, setLanguage] = useState('en');
  const fontSizeSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appearanceSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveAppearance = (patch: Record<string, unknown>) => {
    if (appearanceSaveTimer.current) clearTimeout(appearanceSaveTimer.current);
    appearanceSaveTimer.current = setTimeout(async () => {
      try {
        await api.patch('/settings', patch);
      } catch (error) {
        console.error('Failed to save appearance:', error);
      }
    }, 500);
  };

  const handleThemeChange = (t: ThemeChoice) => {
    setTheme(t);
    saveAppearance({ theme: t });
  };

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  useEffect(() => {
    (async () => {
      try {
        const res = (await api.get('/settings')) as unknown as {
          success: boolean;
          data: { user: { fontSize?: number; theme?: ThemeChoice; language?: string } };
        };
        if (res.success) {
          if (typeof res.data.user.fontSize === 'number') {
            setFontSize(res.data.user.fontSize);
          }
          if (
            res.data.user.theme === 'light' ||
            res.data.user.theme === 'dark' ||
            res.data.user.theme === 'system'
          ) {
            setTheme(res.data.user.theme);
          }
          if (typeof res.data.user.language === 'string') {
            setLanguage(res.data.user.language);
          }
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    })();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // storage unavailable — theme still applies for this session
    }
    applyTheme(theme);
    if (theme !== 'system') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) =>
      document.documentElement.classList.toggle('dark', e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [theme]);

  const handleFontSizeChange = (value: number) => {
    setFontSize(value);
    if (fontSizeSaveTimer.current) clearTimeout(fontSizeSaveTimer.current);
    fontSizeSaveTimer.current = setTimeout(async () => {
      try {
        await api.patch('/settings', { fontSize: value });
      } catch (error) {
        console.error('Failed to save font size:', error);
      }
    }, 500);
  };

  const handleExportConfig = async () => {
    setAdvancedMsg('');
    setAdvancedBusy(true);
    try {
      const res = (await api.get('/settings')) as unknown as {
        success: boolean;
        data: unknown;
      };
      if (!res.success) throw new Error('Export failed');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'webnote-config.json';
      a.click();
      URL.revokeObjectURL(url);
      setAdvancedMsg('Configuration exported');
    } catch (error) {
      console.error('Failed to export config:', error);
      setAdvancedMsg(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setAdvancedBusy(false);
    }
  };

  const handleBackupDatabase = async () => {
    setAdvancedMsg('');
    setAdvancedBusy(true);
    try {
      const res = (await api.post('/backup', {})) as unknown as {
        success: boolean;
        data: { size: number };
      };
      if (!res.success) throw new Error('Backup failed');
      setAdvancedMsg(`Database backup completed (${res.data.size} bytes)`);
    } catch (error) {
      console.error('Failed to back up database:', error);
      setAdvancedMsg(error instanceof Error ? error.message : 'Backup failed');
    } finally {
      setAdvancedBusy(false);
    }
  };

  const handleSignOutAll = async () => {
    setSigningOutAll(true);
    try {
      await logoutAll();
      navigate('/login');
    } catch (error) {
      console.error('Failed to sign out all devices:', error);
    } finally {
      setSigningOutAll(false);
    }
  };

  const handleDeleteLibrary = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setLibraryBusyId(id);
    try {
      await deleteLibrary(id);
      if (currentLibrary?.id === id) setCurrentLibrary(null);
      setConfirmDeleteId(null);
    } catch (error) {
      console.error('Failed to delete library:', error);
    } finally {
      setLibraryBusyId(null);
    }
  };
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader title="Settings" />

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col sm:flex-row">
          <nav
            className="w-full sm:w-48 shrink-0 border-b sm:border-b-0 sm:border-r border-border py-2 sm:py-4 bg-bg-elevated/50"
            aria-label="Settings sections"
          >
            <Tabs
              options={[
                { id: 'account', label: 'Account', icon: User },
                { id: 'security', label: 'Security', icon: Lock },
                { id: 'appearance', label: 'Appearance', icon: Palette },
                { id: 'advanced', label: 'Advanced', icon: Wrench },
              ]}
              value={activeTab}
              onChange={setActiveTab}
              orientation="vertical"
              ariaLabel="Settings sections"
              className="px-2"
            />
          </nav>

          <div className="flex-1 min-w-0 p-4 sm:p-6">
            {activeTab === 'account' && (
              <div className="max-w-md space-y-6">
                <div>
                  <h2 className="text-lg font-medium text-fg mb-4">Account Information</h2>
                  <div className="space-y-4">
                    <Input id="email" label="Email" value={email} disabled />
                    <Input id="role" label="Role" value={user?.role || 'user'} disabled />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="max-w-md space-y-6">
                <div>
                  <h2 className="text-lg font-medium text-fg mb-4">Change Password</h2>
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    {passwordError && <Alert>{passwordError}</Alert>}
                    {passwordSuccess && (
                      <Alert variant="success">Password changed successfully</Alert>
                    )}
                    <Input
                      id="currentPassword"
                      label="Current Password"
                      type={showPasswords ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      leadingIcon={<Lock className="w-5 h-5" />}
                      placeholder="••••••••"
                    />
                    <Input
                      id="newPassword"
                      label="New Password"
                      type={showPasswords ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      leadingIcon={<Lock className="w-5 h-5" />}
                      placeholder="••••••••"
                    />
                    <Input
                      id="confirmPassword"
                      label="Confirm New Password"
                      type={showPasswords ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      leadingIcon={<Lock className="w-5 h-5" />}
                      placeholder="••••••••"
                    />
                    <Checkbox
                      label="Show passwords"
                      checked={showPasswords}
                      onChange={(e) => setShowPasswords(e.target.checked)}
                    />
                    <Button type="submit" disabled={saving} className="w-full">
                      {saving ? 'Saving...' : 'Change Password'}
                    </Button>
                  </form>
                </div>
                <div>
                  <h2 className="text-lg font-medium text-fg mb-4">Sessions</h2>
                  <Button
                    variant="secondary"
                    className="w-full justify-between"
                    onClick={handleSignOutAll}
                    disabled={signingOutAll}
                  >
                    <span>{signingOutAll ? 'Signing out...' : 'Sign out of all devices'}</span>
                    <LogOut className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="max-w-md space-y-6">
                <div>
                  <fieldset>
                    <legend className="text-lg font-medium text-fg mb-4 px-0">Theme</legend>
                    <div className="grid grid-cols-3 gap-2">
                      {(['light', 'dark', 'system'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => handleThemeChange(t)}
                          aria-pressed={theme === t}
                          className={cn(
                            'p-3 rounded-md border-2 text-center text-sm transition-colors duration-150',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                            theme === t
                              ? 'border-primary bg-primary/5 text-fg'
                              : 'border-border hover:border-border-strong text-fg-muted'
                          )}
                        >
                          <span className="capitalize">{t}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
                <div>
                  <h2 className="text-lg font-medium text-fg mb-4">Font Size</h2>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="12"
                      max="24"
                      value={fontSize}
                      aria-label="Font size"
                      onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                      className="flex-1 accent-primary"
                    />
                    <span className="text-sm text-fg-muted w-12">{fontSize}px</span>
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-medium text-fg mb-4">Language</h2>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: 'en', label: 'English' },
                        { id: 'zh-CN', label: '简体中文' },
                      ] as const
                    ).map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => {
                          setLanguage(l.id);
                          saveAppearance({ language: l.id });
                        }}
                        aria-pressed={language === l.id}
                        className={cn(
                          'p-3 rounded-md border-2 text-center text-sm transition-colors duration-150',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                          language === l.id
                            ? 'border-primary bg-primary/5 text-fg'
                            : 'border-border hover:border-border-strong text-fg-muted'
                        )}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'advanced' && (
              <div className="max-w-md space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Data Management</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      variant="secondary"
                      className="w-full justify-between"
                      onClick={handleExportConfig}
                      disabled={advancedBusy}
                    >
                      <span>Export Application Config</span>
                      <Download className="w-4 h-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full justify-between"
                      onClick={handleBackupDatabase}
                      disabled={advancedBusy}
                    >
                      <span>Backup Database</span>
                      <Database className="w-4 h-4" aria-hidden="true" />
                    </Button>
                    {advancedMsg && (
                      <output className="block text-sm text-fg-muted">{advancedMsg}</output>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Libraries</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {libraries.length === 0 ? (
                      <p className="text-sm text-fg-muted">No libraries yet.</p>
                    ) : (
                      libraries.map((lib) => (
                        <div
                          key={lib.id}
                          className="flex items-center gap-3 px-3 py-2 border border-border rounded-md"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-fg truncate">
                              {lib.name}
                              {currentLibrary?.id === lib.id && (
                                <span className="ml-2 text-xs font-normal text-primary">
                                  Current
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-fg-muted truncate">{lib.path}</p>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleDeleteLibrary(lib.id)}
                            disabled={libraryBusyId === lib.id}
                            aria-label={
                              confirmDeleteId === lib.id
                                ? `Confirm delete ${lib.name}`
                                : `Delete ${lib.name}`
                            }
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                            {confirmDeleteId === lib.id ? 'Confirm?' : 'Delete'}
                          </Button>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
