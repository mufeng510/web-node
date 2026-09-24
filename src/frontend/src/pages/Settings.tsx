import { Database, Download, Lock, Palette, User, Wrench } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Checkbox } from '../components/ui/Checkbox';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Tabs } from '../components/ui/Tabs';
import { useAuth } from '../hooks/useAuth';
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
  const { user, changePassword } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [saving, setSaving] = useState(false);

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
  const fontSizeSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  useEffect(() => {
    (async () => {
      try {
        const res = (await api.get('/settings')) as unknown as {
          success: boolean;
          data: { user: { fontSize?: number } };
        };
        if (res.success && typeof res.data.user.fontSize === 'number') {
          setFontSize(res.data.user.fontSize);
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
        <div className="flex">
          <nav
            className="w-48 shrink-0 border-r border-border py-4 bg-bg-elevated/50"
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

          <div className="flex-1 min-w-0 p-6">
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
                          onClick={() => setTheme(t)}
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
