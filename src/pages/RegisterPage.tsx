import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Button } from '../components/ui/Button';
import { Field, TextInput } from '../components/ui/Field';
import { Alert } from '../components/ui/Feedback';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { describeError } from '../lib/errors';

export const RegisterPage: React.FC = () => {
  const { t } = useLanguage();
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', username: '', displayName: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signUp({
        email: form.email.trim(),
        username: form.username.trim(),
        password: form.password,
        display_name: form.displayName.trim() || undefined,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(describeError(err, t));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={t('auth.signUpTitle')}
      subtitle={t('auth.signUpSubtitle')}
      footer={
        <>
          {t('auth.hasAccount')}{' '}
          <Link to="/login" className="font-semibold text-sky-400 hover:text-sky-300">
            {t('auth.signIn')}
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        {error && <Alert tone="error">{error}</Alert>}

        <Field label={t('auth.email')} htmlFor="email">
          <TextInput
            id="email"
            type="email"
            autoComplete="email"
            required
            dir="ltr"
            placeholder="you@example.com"
            value={form.email}
            onChange={update('email')}
          />
        </Field>

        <Field label={t('auth.username')} hint={t('auth.usernameHint')} htmlFor="username">
          <TextInput
            id="username"
            autoComplete="username"
            required
            dir="ltr"
            placeholder="octodev"
            value={form.username}
            onChange={update('username')}
          />
        </Field>

        <Field label={`${t('auth.displayName')} (${t('common.optional')})`} htmlFor="displayName">
          <TextInput
            id="displayName"
            autoComplete="name"
            value={form.displayName}
            onChange={update('displayName')}
          />
        </Field>

        <Field label={t('auth.password')} hint={t('auth.passwordHint')} htmlFor="password">
          <TextInput
            id="password"
            type="password"
            autoComplete="new-password"
            required
            dir="ltr"
            placeholder="••••••••"
            value={form.password}
            onChange={update('password')}
          />
        </Field>

        <Button type="submit" variant="primary" icon={UserPlus} loading={submitting} className="w-full">
          {t('auth.signUp')}
        </Button>
      </form>
    </AuthLayout>
  );
};
