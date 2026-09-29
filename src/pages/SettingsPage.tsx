import React, { useEffect, useState } from 'react';
import { KeyRound, Monitor, ShieldCheck, UserRound } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, TextArea, TextInput } from '../components/ui/Field';
import { Alert, EmptyState, LoadingBlock } from '../components/ui/Feedback';
import { Tabs } from '../components/ui/Tabs';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../lib/api';
import { describeError } from '../lib/errors';
import type { Session } from '../types';

type Tab = 'profile' | 'security' | 'sessions';

export const SettingsPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { user, setUser } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({
    display_name: user?.display_name ?? '',
    bio: user?.bio ?? '',
    avatar_url: user?.avatar_url ?? '',
  });
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '' });
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  useEffect(() => {
    if (tab !== 'sessions') return;
    let active = true;
    setSessionsLoading(true);
    api
      .sessions()
      .then((data) => active && setSessions(data))
      .catch((err) => active && setError(describeError(err, t)))
      .finally(() => active && setSessionsLoading(false));
    return () => {
      active = false;
    };
  }, [tab, t]);

  const run = async (action: () => Promise<string>) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      setNotice(await action());
    } catch (err) {
      setError(describeError(err, t));
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = (event: React.FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const updated = await api.updateProfile({
        display_name: profile.display_name.trim(),
        bio: profile.bio,
        avatar_url: profile.avatar_url.trim() || null,
      });
      setUser(updated);
      return t('common.saved');
    });
  };

  const savePassword = (event: React.FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await api.changePassword(passwords);
      setPasswords({ current_password: '', new_password: '' });
      return t('settings.passwordChanged');
    });
  };

  const revoke = (id: string) =>
    void run(async () => {
      await api.revokeSession(id);
      setSessions((current) => current.filter((session) => session.id !== id));
      return t('common.saved');
    });

  const formatDate = (value: string) =>
    new Date(value).toLocaleString(language === 'ar' ? 'ar' : 'en-GB');

  return (
    <>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <Tabs
        active={tab}
        onChange={setTab}
        items={[
          { id: 'profile', label: t('settings.tabs.profile'), icon: UserRound },
          { id: 'security', label: t('settings.tabs.security'), icon: ShieldCheck },
          { id: 'sessions', label: t('settings.tabs.sessions'), icon: Monitor },
        ]}
      />

      <div className="mt-6 space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}

        {tab === 'profile' && (
          <Card title={t('settings.tabs.profile')}>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveProfile}>
              <Field label={t('auth.displayName')} htmlFor="display-name">
                <TextInput
                  id="display-name"
                  value={profile.display_name}
                  onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                />
              </Field>
              <Field label={t('auth.username')} htmlFor="username">
                <TextInput id="username" dir="ltr" value={user?.username ?? ''} disabled />
              </Field>
              <Field label={t('auth.email')} htmlFor="email">
                <TextInput id="email" dir="ltr" value={user?.email ?? ''} disabled />
              </Field>
              <Field label={`${t('settings.avatar')} (${t('common.optional')})`} htmlFor="avatar">
                <TextInput
                  id="avatar"
                  dir="ltr"
                  value={profile.avatar_url}
                  onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label={t('settings.bio')} htmlFor="bio">
                  <TextArea
                    id="bio"
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  />
                </Field>
              </div>
              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" variant="primary" loading={saving}>
                  {t('common.save')}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {tab === 'security' && (
          <Card title={t('settings.changePassword')} description={t('auth.securityNote')}>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={savePassword}>
              <Field label={t('settings.currentPassword')} htmlFor="current-password">
                <TextInput
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  dir="ltr"
                  value={passwords.current_password}
                  onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })}
                />
              </Field>
              <Field
                label={t('settings.newPassword')}
                hint={t('auth.passwordHint')}
                htmlFor="new-password"
              >
                <TextInput
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  dir="ltr"
                  value={passwords.new_password}
                  onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
                />
              </Field>
              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" variant="primary" icon={KeyRound} loading={saving}>
                  {t('settings.changePassword')}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {tab === 'sessions' && (
          <Card title={t('settings.tabs.sessions')} description={t('settings.sessionsHint')}>
            {sessionsLoading ? (
              <LoadingBlock label={t('common.loading')} />
            ) : sessions.length === 0 ? (
              <EmptyState title={t('common.none')} />
            ) : (
              <ul className="divide-y divide-slate-800">
                {sessions.map((session) => (
                  <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-200">{session.user_agent || '—'}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                        {session.ip_address} · {t('settings.lastSeen')} {formatDate(session.last_seen_at)} ·{' '}
                        {t('settings.expires')} {formatDate(session.expires_at)}
                      </p>
                    </div>
                    <Button variant="danger" size="sm" onClick={() => revoke(session.id)}>
                      {t('settings.revoke')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </>
  );
};
