import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Activity, Archive, ArchiveRestore, Copy, LayoutDashboard, Settings, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Field, Select, TextArea, TextInput } from '../components/ui/Field';
import { Alert, LoadingBlock } from '../components/ui/Feedback';
import { Tabs } from '../components/ui/Tabs';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../lib/api';
import { describeError } from '../lib/errors';
import type { ActivityEvent, Repository } from '../types';

type Tab = 'overview' | 'activity' | 'settings';

export const RepositoryPage: React.FC = () => {
  const { owner = '', name = '' } = useParams();
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const [repository, setRepository] = useState<Repository | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [draft, setDraft] = useState({
    description: '',
    visibility: 'public',
    default_branch: 'main',
    language: '',
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([api.repository(owner, name), api.activity(100)])
      .then(([repo, allEvents]) => {
        if (!active) return;
        setRepository(repo);
        setDraft({
          description: repo.description,
          visibility: repo.visibility,
          default_branch: repo.default_branch,
          language: repo.language,
        });
        setEvents(allEvents.filter((event) => event.repository_name === repo.name));
      })
      .catch((err) => active && setError(describeError(err, t)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [owner, name, t]);

  const cloneUrl = useMemo(
    () => `${window.location.origin}/git/${owner}/${name}.git`,
    [owner, name],
  );

  const persist = async (patch: Parameters<typeof api.updateRepository>[2]) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.updateRepository(owner, name, patch);
      setRepository(updated);
      setNotice(t('common.saved'));
    } catch (err) {
      setError(describeError(err, t));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.deleteRepository(owner, name);
      navigate('/repositories', { replace: true });
    } catch (err) {
      setError(describeError(err, t));
      setSaving(false);
    }
  };

  const copyClone = async () => {
    await navigator.clipboard.writeText(cloneUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <LoadingBlock label={t('common.loading')} />;
  if (!repository) return <Alert tone="error">{error ?? t('repo.notFound')}</Alert>;

  return (
    <>
      <PageHeader
        title={`${repository.owner_username}/${repository.name}`}
        subtitle={repository.description || undefined}
        actions={
          <>
            <Badge tone={repository.visibility === 'public' ? 'success' : 'neutral'}>
              {repository.visibility === 'public' ? t('repos.public') : t('repos.private')}
            </Badge>
            {repository.archived && <Badge tone="warning">{t('repos.archived')}</Badge>}
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {notice && (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      )}

      <Tabs
        active={tab}
        onChange={setTab}
        items={[
          { id: 'overview', label: t('repo.tabs.overview'), icon: LayoutDashboard },
          { id: 'activity', label: t('repo.tabs.activity'), icon: Activity, count: events.length },
          { id: 'settings', label: t('repo.tabs.settings'), icon: Settings },
        ]}
      />

      <div className="mt-6 space-y-6">
        {tab === 'overview' && (
          <Card title={t('repo.clone')}>
            <div className="flex flex-wrap items-center gap-3">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 font-mono text-xs text-slate-300" dir="ltr">
                {cloneUrl}
              </code>
              <Button icon={Copy} onClick={copyClone}>
                {copied ? t('repo.copied') : t('repo.copy')}
              </Button>
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-3">
              {[
                { label: t('repos.owner'), value: repository.owner_username },
                { label: t('repos.defaultBranch'), value: repository.default_branch },
                { label: t('repos.language'), value: repository.language || t('common.none') },
              ].map((row) => (
                <div key={row.label}>
                  <dt className="text-[11px] text-slate-500">{row.label}</dt>
                  <dd className="font-mono text-sm text-slate-200">{row.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        )}

        {tab === 'activity' && (
          <Card>
            {events.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">{t('activity.empty')}</p>
            ) : (
              <ol className="divide-y divide-slate-800">
                {events.map((event) => (
                  <li key={event.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="truncate text-sm text-slate-200">{event.summary}</span>
                    <time className="shrink-0 text-[11px] text-slate-500">
                      {new Date(event.created_at).toLocaleString(language === 'ar' ? 'ar' : 'en-GB')}
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        )}

        {tab === 'settings' && (
          <>
            <Card title={t('repo.tabs.settings')}>
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void persist(draft);
                }}
              >
                <Field label={t('repos.visibility')} htmlFor="visibility">
                  <Select
                    id="visibility"
                    value={draft.visibility}
                    onChange={(e) => setDraft({ ...draft, visibility: e.target.value })}
                  >
                    <option value="public">{t('repos.public')}</option>
                    <option value="private">{t('repos.private')}</option>
                  </Select>
                </Field>
                <Field label={t('repos.defaultBranch')} htmlFor="branch">
                  <TextInput
                    id="branch"
                    dir="ltr"
                    value={draft.default_branch}
                    onChange={(e) => setDraft({ ...draft, default_branch: e.target.value })}
                  />
                </Field>
                <Field label={t('repos.language')} htmlFor="language">
                  <TextInput
                    id="language"
                    dir="ltr"
                    value={draft.language}
                    onChange={(e) => setDraft({ ...draft, language: e.target.value })}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label={t('repos.description')} htmlFor="description">
                    <TextArea
                      id="description"
                      value={draft.description}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
                  <Button
                    type="button"
                    icon={repository.archived ? ArchiveRestore : Archive}
                    onClick={() => void persist({ archived: !repository.archived })}
                  >
                    {repository.archived ? t('repo.unarchive') : t('repo.archive')}
                  </Button>
                  <Button type="submit" variant="primary" loading={saving}>
                    {t('common.save')}
                  </Button>
                </div>
              </form>
            </Card>

            <Card title={t('repo.dangerZone')} description={t('repo.deleteHint')} className="border-rose-900/60">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-56 flex-1">
                  <Field label={t('repo.deleteConfirm')} htmlFor="confirm">
                    <TextInput
                      id="confirm"
                      dir="ltr"
                      placeholder={repository.name}
                      value={confirmName}
                      onChange={(e) => setConfirmName(e.target.value)}
                    />
                  </Field>
                </div>
                <Button
                  variant="danger"
                  icon={Trash2}
                  disabled={confirmName !== repository.name || saving}
                  onClick={() => void handleDelete()}
                >
                  {t('common.delete')}
                </Button>
              </div>
            </Card>
          </>
        )}
      </div>
    </>
  );
};
