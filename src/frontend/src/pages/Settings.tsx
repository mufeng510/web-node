import {
  AlertCircle,
  CheckCircle,
  Database,
  Download,
  Lock,
  Palette,
  User,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export function Settings() {
  const { user, changePassword } = useAuth();
  const [activeTab, setActiveTab] = useState<'account' | 'security' | 'appearance' | 'advanced'>(
    'account'
  );
  const [saving, setSaving] = useState(false);

  // Account tab
  const [email, setEmail] = useState(user?.email || '');
  const [username, setUsername] = useState('');

  // Security tab
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Appearance tab
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [fontSize, setFontSize] = useState(14);
  const [language, setLanguage] = useState<'en' | 'zh-CN'>('en');

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

  const tabs = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'advanced', label: 'Advanced', icon: Wrench },
  ];

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b border-border">
        <h1 className="text-xl font-semibold text-fg">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex">
          <nav className="w-48 border-r border-border py-4 bg-bg-elevated/50">
            <ul className="space-y-1 px-2">
              {tabs.map((tab) => (
                <li key={tab.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveTab(tab.id as 'account' | 'security' | 'appearance' | 'advanced')
                    }
                    className={`w-full px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors duration-150 ${
                      activeTab === tab.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-fg-muted hover:bg-bg-hover hover:text-fg'
                    }`}
                  >
                    <tab.icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex-1 p-6">
            {activeTab === 'account' && (
              <div className="max-w-md space-y-6">
                <div>
                  <h2 className="text-lg font-medium text-fg mb-4">Account Information</h2>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-fg mb-1">
                        Email
                      </label>
                      <input
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input-base"
                      />
                    </div>
                    <div>
                      <label htmlFor="username" className="block text-sm font-medium text-fg mb-1">
                        Username
                      </label>
                      <input
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="input-base"
                      />
                    </div>
                    <div>
                      <label htmlFor="role" className="block text-sm font-medium text-fg mb-1">
                        Role
                      </label>
                      <input
                        id="role"
                        value={user?.role || 'user'}
                        disabled
                        className="input-base bg-bg-hover text-fg-muted cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="max-w-md space-y-6">
                <div>
                  <h2 className="text-lg font-medium text-fg mb-4">Change Password</h2>
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    {passwordError && (
                      <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {passwordError}
                      </div>
                    )}
                    {passwordSuccess && (
                      <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-md text-success text-sm">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        Password changed successfully
                      </div>
                    )}
                    <div>
                      <label
                        htmlFor="currentPassword"
                        className="block text-sm font-medium text-fg mb-1"
                      >
                        Current Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-fg-subtle" />
                        <input
                          id="currentPassword"
                          type={showPasswords ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="input-base pl-10 pr-12"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor="newPassword"
                        className="block text-sm font-medium text-fg mb-1"
                      >
                        New Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-fg-subtle" />
                        <input
                          id="newPassword"
                          type={showPasswords ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="input-base pl-10 pr-12"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor="confirmPassword"
                        className="block text-sm font-medium text-fg mb-1"
                      >
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-fg-subtle" />
                        <input
                          id="confirmPassword"
                          type={showPasswords ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="input-base pl-10 pr-12"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showPasswords}
                        onChange={(e) => setShowPasswords(e.target.checked)}
                        className="w-4 h-4 text-primary border-border rounded focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <span className="text-sm text-fg-muted">Show passwords</span>
                    </label>
                    <button type="submit" disabled={saving} className="btn-primary w-full">
                      {saving ? 'Saving...' : 'Change Password'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="max-w-md space-y-6">
                <div>
                  <h2 className="text-lg font-medium text-fg mb-4">Theme</h2>
                  <div className="grid grid-cols-3 gap-2">
                    {(['light', 'dark', 'system'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTheme(t)}
                        className={`p-3 rounded-md border-2 text-center text-sm transition-colors duration-150 ${
                          theme === t
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-border-strong'
                        }`}
                      >
                        <span className="capitalize text-fg">{t}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-medium text-fg mb-4">Font Size</h2>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="12"
                      max="24"
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="flex-1 accent-primary"
                    />
                    <span className="text-sm text-fg-muted w-12">{fontSize}px</span>
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-medium text-fg mb-4">Language</h2>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as 'en' | 'zh-CN')}
                    className="input-base"
                  >
                    <option value="en">English</option>
                    <option value="zh-CN">中文 (简体)</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'advanced' && (
              <div className="max-w-md space-y-6">
                <div>
                  <h2 className="text-lg font-medium text-fg mb-4">Data Management</h2>
                  <div className="space-y-3">
                    <button type="button" className="btn-secondary w-full justify-between">
                      <span>Export Application Config</span>
                      <Download className="w-4 h-4" />
                    </button>
                    <button type="button" className="btn-secondary w-full justify-between">
                      <span>Backup Database</span>
                      <Database className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-medium text-fg mb-4">Danger Zone</h2>
                  <div className="p-4 border border-destructive/20 rounded-md bg-destructive/5">
                    <p className="text-sm text-destructive mb-3">
                      These actions are irreversible. Please proceed with caution.
                    </p>
                    <button type="button" className="btn-destructive w-full">
                      Delete All Data
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
