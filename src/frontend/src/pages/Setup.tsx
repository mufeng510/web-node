import { CheckCircle, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { IconButton } from '../components/ui/IconButton';
import { Input } from '../components/ui/Input';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';

export function Setup() {
  const { t } = useTranslation();
  const { setup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('pages.setup.errorPasswordsDoNotMatch'));
      return;
    }

    if (password.length < 8) {
      setError(t('pages.setup.errorPasswordTooShort'));
      return;
    }

    setLoading(true);

    try {
      await setup(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pages.setup.errorFailed'));
    } finally {
      setLoading(false);
    }
  };

  const passwordToggle = (
    <IconButton
      size="sm"
      onClick={() => setShowPassword(!showPassword)}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
    >
      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
    </IconButton>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <CheckCircle className="w-8 h-8 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-semibold text-fg">{t('pages.setup.title')}</h1>
          <p className="text-fg-muted mt-2">{t('pages.setup.subtitle')}</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit}>
            {error && <Alert className="mb-4">{error}</Alert>}

            <div className="mb-4">
              <Input
                id="email"
                label={t('pages.setup.adminEmail')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leadingIcon={<Mail className="w-5 h-5" />}
                placeholder={t('pages.setup.placeholderEmail')}
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="mb-4">
              <Input
                id="password"
                label={t('pages.setup.password')}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leadingIcon={<Lock className="w-5 h-5" />}
                trailing={passwordToggle}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

            <div className="mb-6">
              <Input
                id="confirmPassword"
                label={t('pages.setup.confirmPassword')}
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leadingIcon={<Lock className="w-5 h-5" />}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? t('pages.setup.creatingAccount') : t('pages.setup.createAdminAccount')}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
