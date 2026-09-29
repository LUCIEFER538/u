import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderGit2, Globe2, Lock, Plus, Search } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Field, Select, TextArea, TextInput } from '../components/ui/Field';
import { Alert, EmptyState, LoadingBlock } from '../components/ui/Feedback';
import { Tabs } from '../components/ui/Tabs';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../lib/api';
import { describeError } from '../lib/errors';
import type { Repository } from '../types';

type Filter = 'all' | 'public' | 'private';

export const RepositoriesPage: React.FC = () => {
  const { t } = useLanguage();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    visibility: 'public',
    default_branch: 'main',
    language: '',
  });

  useEffect(() => {
    let active = true;
    api
      .repositories()
      .then((data) => active && setRepositories(data))
      .catch((err) => active && setError(describeError(err, t)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [t]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return repositories.filter((repo) => {
      if (filter !== 'all' && repo.visibility !== filter) return false;
      if (!needle) return true;
      return (
        repo.name.toLowerCase().includes(needle) ||
        repo.description.toLowerCase().includes(needle)
      );
    });
  }, [repositories, filter, query]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const created = await api.createRepository({
        name: form.name.trim(),
        description: form.description.trim(),
        visibility: form.visibility,
        default_branch: form.default_branch.trim() || 'main',
        language: form.language.trim(),
      });
      setRepositories((current) => [created, ...current]);
      setForm({ name: '', description: '', visibility: 'public', default_branch: 'main', language: '' });
      setShowForm(false);
    } catch (err) {
      setError(describeError(err, t));
    } finally {
      setCreating(false);
    }
  };

  const counts = {
    all: repositories.length,
    public: repositories.filter((repo) => repo.visibility === 'public').length,
    private: repositories.filter((repo) => repo.visibility === 'private').length,
  };

  return (
    <>
      <PageHeader
        title={t('repos.title')}
        subtitle={t('repos.subtitle')}
        actions={
          <Button
            variant={showForm ? 'secondary' : 'primary'}
            icon={showForm ? undefined : Plus}
            onClick={() => setShowForm((value) => !value)}
          >
            {showForm ? t('common.cancel') : t('overview.newRepository')}
          </Button>
        }
      />

      {error && (
        <div className="mb-6">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {showForm && (
        <div className="mb-6">
          <Card title={t('repos.createTitle')}>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleCreate}>
              <Field label={t('repos.name')} htmlFor="repo-name">
                <TextInput
                  id="repo-name"
                  required
                  dir="ltr"
                  placeholder="my-project"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label={t('repos.visibility')} htmlFor="repo-visibility">
                <Select
                  id="repo-visibility"
                  value={form.visibility}
                  onChange={(e) => setForm({ ...form, visibility: e.target.value })}
                >
                  <option value="public">{t('repos.public')}</option>
                  <option value="private">{t('repos.private')}</option>
                </Select>
              </Field>
              <Field label={t('repos.defaultBranch')} htmlFor="repo-branch">
                <TextInput
                  id="repo-branch"
                  dir="ltr"
                  value={form.default_branch}
                  onChange={(e) => setForm({ ...form, default_branch: e.target.value })}
                />
              </Field>
              <Field label={`${t('repos.language')} (${t('common.optional')})`} htmlFor="repo-language">
                <TextInput
                  id="repo-language"
                  dir="ltr"
                  placeholder="Rust"
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label={`${t('repos.description')} (${t('common.optional')})`} htmlFor="repo-description">
                  <TextArea
                    id="repo-description"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </Field>
              </div>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" variant="primary" loading={creating}>
                  {t('common.create')}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      <div className="space-y-4">
        <Tabs
          active={filter}
          onChange={setFilter}
          items={[
            { id: 'all', label: t('repos.all'), icon: FolderGit2, count: counts.all },
            { id: 'public', label: t('repos.public'), icon: Globe2, count: counts.public },
            { id: 'private', label: t('repos.private'), icon: Lock, count: counts.private },
          ]}
        />

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 ltr:left-3 rtl:right-3" />
          <TextInput
            aria-label={t('common.search')}
            placeholder={t('repos.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="ltr:pl-9 rtl:pr-9"
          />
        </div>

        {loading ? (
          <LoadingBlock label={t('common.loading')} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={t('repos.empty')}
            hint={t('repos.emptyHint')}
            action={
              <Button variant="primary" icon={Plus} onClick={() => setShowForm(true)}>
                {t('overview.newRepository')}
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {visible.map((repo) => (
              <li key={repo.id}>
                <Link
                  to={`/repositories/${repo.owner_username}/${repo.name}`}
                  className="block h-full rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-colors hover:border-sky-500/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="truncate font-mono text-sm font-bold text-white">
                      {repo.owner_username}/{repo.name}
                    </p>
                    <Badge tone={repo.visibility === 'public' ? 'success' : 'neutral'}>
                      {repo.visibility === 'public' ? t('repos.public') : t('repos.private')}
                    </Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 min-h-8 text-xs text-slate-400">
                    {repo.description || '—'}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    {repo.language && <span className="font-mono">{repo.language}</span>}
                    <span className="font-mono">{repo.default_branch}</span>
                    {repo.archived && <Badge tone="warning">{t('repos.archived')}</Badge>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
};
