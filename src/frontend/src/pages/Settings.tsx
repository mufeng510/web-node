import { Database, Download, Lock, LogOut, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Checkbox } from '../components/ui/Checkbox';
import { ContentShell } from '../components/ui/ContentShell';
import { Input } from '../components/ui/Input';
import { PageContextBar } from '../components/ui/PageContextBar';
import { ScrollArea } from '../components/ui/ScrollArea';
import { useAuth } from '../hooks/useAuth';
import { useLibraries } from '../hooks/useLibraries';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { type Locale, getLocale, setLocale } from '../lib/i18n';
import type { ThemeChoice } from '../lib/theme';
import { cn } from '../lib/utils';
import { api } from '../services/api';

import { SettingsSectionNav } from './settings/SettingsSectionNav';
import AuditSection from './settings/sections/AuditSection';
import DiagnosticsSection from './settings/sections/DiagnosticsSection';
import GitSection from './settings/sections/GitSection';
import McpSection from './settings/sections/McpSection';
import UsersSection from './settings/sections/UsersSection';
import {
  ADMIN_ONLY_TABS,
  DEFAULT_SETTINGS_TAB,
  PERSONAL_TABS,
  SYSTEM_TABS,
  type SettingsTab,
  resolveSettingsTab,
} from './settings/settingsTabs';

export function Settings() {
  const { user, changePassword, logoutAll } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { libraries, currentLibrary, setCurrentLibrary, deleteLibrary } = useLibraries();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = resolveSettingsTab(searchParams.get('tab'));
  // A non-admin following /settings?tab=users must not land on an empty panel.
  const activeTab =
    !isAdmin && ADMIN_ONLY_TABS.includes(requestedTab) ? DEFAULT_SETTINGS_TAB : requestedTab;
  const setActiveTab = (tab: SettingsTab) => {
    setSearchParams(tab === 'account' ? {} : { tab }, { replace: true });
  };
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
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [fontSize, setFontSize] = useState(16);
  const [language, setLanguage] = useState<Locale>(getLocale());
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
            setLanguage(res.data.user.language as Locale);
            setLocale(res.data.user.language as Locale);
          }
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    })();
  }, []);

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
      setAdvancedMsg(t('settings.msgConfigExported'));
    } catch (error) {
      console.error('Failed to export config:', error);
      setAdvancedMsg(error instanceof Error ? error.message : t('settings.msgExportFailed'));
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
      setAdvancedMsg(t('settings.msgBackupCompleted', { size: res.data.size }));
    } catch (error) {
      console.error('Failed to back up database:', error);
      setAdvancedMsg(error instanceof Error ? error.message : t('settings.errorBackupFailedShort'));
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
      setPasswordError(t('settings.errorPasswordsDoNotMatch'));
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(t('settings.errorPasswordTooShort'));
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
      setPasswordError(error instanceof Error ? error.message : t('settings.errorChangePassword'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageContextBar title={t('settings.title')} />

      <ScrollArea>
        <div className="flex flex-col sm:flex-row">
          <nav
            className="w-full sm:w-48 shrink-0 border-b sm:border-b-0 sm:border-r border-border py-2 sm:py-4 bg-bg-elevated/50"
            aria-label="设置章节"
          >
            <SettingsSectionNav
              groups={[
                { id: 'personal', label: 'settings.groupPersonal', tabs: PERSONAL_TABS },
                {
                  id: 'system',
                  label: 'settings.groupSystem',
                  tabs: isAdmin
                    ? SYSTEM_TABS
                    : SYSTEM_TABS.filter((t) => !ADMIN_ONLY_TABS.includes(t)),
                },
              ]}
              activeTab={activeTab}
              onChange={setActiveTab}
            />
          </nav>

          <div className="flex-1 min-w-0 p-4 sm:p-6">
            <ContentShell>
              {activeTab === 'diagnostics' && <DiagnosticsSection />}
              {activeTab === 'git' && <GitSection />}
              {activeTab === 'mcp' && <McpSection />}
              {activeTab === 'users' && isAdmin && <UsersSection />}
              {activeTab === 'audit' && isAdmin && <AuditSection />}
              {activeTab === 'account' && (
                <div className="max-w-md space-y-6">
                  <div>
                    <h2 className="text-lg font-medium text-fg mb-4">
                      {t('settings.accountInformation')}
                    </h2>
                    <div className="space-y-4">
                      <Input id="email" label={t('common.email')} value={email} disabled />
                      <Input
                        id="role"
                        label={t('common.role')}
                        value={user?.role || 'user'}
                        disabled
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="max-w-md space-y-6">
                  <div>
                    <h2 className="text-lg font-medium text-fg mb-4">
                      {t('settings.changePassword')}
                    </h2>
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                      {passwordError && <Alert>{passwordError}</Alert>}
                      {passwordSuccess && (
                        <Alert variant="success">{t('settings.alertPasswordChanged')}</Alert>
                      )}
                      <Input
                        id="currentPassword"
                        label={t('settings.labelCurrentPassword')}
                        type={showPasswords ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        leadingIcon={<Lock className="w-5 h-5" />}
                        placeholder="••••••••"
                      />
                      <Input
                        id="newPassword"
                        label={t('settings.labelNewPassword')}
                        type={showPasswords ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        leadingIcon={<Lock className="w-5 h-5" />}
                        placeholder="••••••••"
                      />
                      <Input
                        id="confirmPassword"
                        label={t('settings.labelConfirmNewPassword')}
                        type={showPasswords ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        leadingIcon={<Lock className="w-5 h-5" />}
                        placeholder="••••••••"
                      />
                      <Checkbox
                        label={t('settings.checkboxShowPasswords')}
                        checked={showPasswords}
                        onChange={(e) => setShowPasswords(e.target.checked)}
                      />
                      <Button type="submit" disabled={saving} className="w-full">
                        {saving ? t('common.saving') : t('settings.btnChangePassword')}
                      </Button>
                    </form>
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-fg mb-4">{t('settings.sessions')}</h2>
                    <Button
                      variant="secondary"
                      className="w-full justify-between"
                      onClick={handleSignOutAll}
                      disabled={signingOutAll}
                    >
                      <span>
                        {signingOutAll
                          ? t('settings.btnSigningOut')
                          : t('settings.btnSignOutAllDevices')}
                      </span>
                      <LogOut className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === 'appearance' && (
                <div className="max-w-md space-y-6">
                  <div>
                    <fieldset>
                      <legend className="text-lg font-medium text-fg mb-4 px-0">
                        {t('settings.legendTheme')}
                      </legend>
                      <div className="grid grid-cols-3 gap-2">
                        {(['light', 'dark', 'system'] as const).map((themeValue) => (
                          <button
                            key={themeValue}
                            type="button"
                            onClick={() => handleThemeChange(themeValue)}
                            aria-pressed={theme === themeValue}
                            className={cn(
                              'p-3 rounded-md border-2 text-center text-sm transition-colors duration-150',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                              theme === themeValue
                                ? 'border-primary bg-primary/5 text-fg'
                                : 'border-border hover:border-border-strong text-fg-muted'
                            )}
                          >
                            <span className="capitalize">
                              {themeValue === 'light'
                                ? t('settings.btnLight')
                                : themeValue === 'dark'
                                  ? t('settings.btnDark')
                                  : t('settings.btnSystem')}
                            </span>
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-fg mb-4">
                      {t('settings.headingFontSize')}
                    </h2>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="12"
                        max="24"
                        value={fontSize}
                        aria-label={t('settings.ariaFontSize')}
                        onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                        className="flex-1 accent-primary"
                      />
                      <span className="text-sm text-fg-muted w-12">
                        {t('settings.textFontSize', { size: fontSize })}
                      </span>
                    </div>
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-fg mb-4">
                      {t('settings.headingLanguage')}
                    </h2>
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
                            setLocale(l.id as Locale);
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
                      <CardTitle>{t('settings.cardDataManagement')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button
                        variant="secondary"
                        className="w-full justify-between"
                        onClick={handleExportConfig}
                        disabled={advancedBusy}
                      >
                        <span>{t('settings.btnExportConfig')}</span>
                        <Download className="w-4 h-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="secondary"
                        className="w-full justify-between"
                        onClick={handleBackupDatabase}
                        disabled={advancedBusy}
                      >
                        <span>{t('settings.btnBackupDatabase')}</span>
                        <Database className="w-4 h-4" aria-hidden="true" />
                      </Button>
                      {advancedMsg && (
                        <output className="block text-sm text-fg-muted">{advancedMsg}</output>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('settings.cardLibraries')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {libraries.length === 0 ? (
                        <p className="text-sm text-fg-muted">{t('settings.textNoLibraries')}</p>
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
                                    {t('settings.textCurrent')}
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
                                  ? t('settings.ariaConfirmDelete', { name: lib.name })
                                  : t('settings.ariaDelete', { name: lib.name })
                              }
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                              {confirmDeleteId === lib.id
                                ? t('settings.btnConfirm')
                                : t('settings.btnDelete')}
                            </Button>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </ContentShell>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
