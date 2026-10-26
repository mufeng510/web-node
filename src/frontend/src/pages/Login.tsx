import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Checkbox } from '../components/ui/Checkbox';
import { IconButton } from '../components/ui/IconButton';
import { Input } from '../components/ui/Input';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';

export function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password, rememberMe);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pages.login.errorFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-fg">{t('pages.login.title')}</h1>
          <p className="text-fg-muted mt-2">{t('pages.login.subtitle')}</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit}>
            {error && <Alert className="mb-4">{error}</Alert>}

            <div className="mb-4">
              <Input
                id="email"
                label={t('pages.login.email')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leadingIcon={<Mail className="w-5 h-5" />}
                placeholder={t('pages.login.placeholderEmail')}
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="mb-4">
              <Input
                id="password"
                label={t('pages.login.password')}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leadingIcon={<Lock className="w-5 h-5" />}
                trailing={
                  <IconButton
                    size="sm"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword
                        ? t('pages.login.ariaHidePassword')
                        : t('pages.login.ariaShowPassword')
                    }
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </IconButton>
                }
                placeholder="••••••••"
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <div className="mb-6 flex items-center justify-between">
              <Checkbox
                label={t('pages.login.rememberMe')}
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? t('pages.login.signingIn') : t('pages.login.signIn')}
            </Button>

            <p className="mt-6 text-center text-sm text-fg-muted">
              {t('pages.login.firstTime')}{' '}
              <a href="/setup" className="text-primary hover:text-primary-hover font-medium">
                {t('pages.login.setupWizard')}
              </a>
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
