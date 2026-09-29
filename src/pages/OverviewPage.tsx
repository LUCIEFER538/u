import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, FolderGit2, Globe2, KeyRound, Plus } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, StatCard } from '../components/ui/Card';
import { Alert, EmptyState, LoadingBlock, StatusDot } from '../components/ui/Feedback';
import { Button } from '../components/ui/Button';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../lib/api';
import { describeError } from '../lib/errors';
import type { ActivityEvent, PlatformHealth, Stats } from '../types';

export const OverviewPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [stats, setStats] = useState<Stats | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [health, setHealth] = useState<PlatformHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([api.stats(), api.activity(6), api.platformHealth().catch(() => null)])
      .then(([nextStats, nextEvents, nextHealth]) => {
        if (!active) return;
        setStats(nextStats);
        setEvents(nextEvents);
        setHealth(nextHealth);
      })
      .catch((err) => active && setError(describeError(err, t)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [t]);

  if (loading) return <LoadingBlock label={t('common.loading')} />;

  return (
    <>
      <PageHeader
        title={t('overview.title')}
        subtitle={t('overview.subtitle')}
        actions={
          <Link to="/repositories">
            <Button variant="primary" icon={Plus}>
              {t('overview.newRepository')}
            </Button>
          </Link>
        }
      />

      {error && (
        <div className="mb-6">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('overview.repositories')} value={stats?.repositories ?? 0} icon={FolderGit2} />
        <StatCard label={t('overview.publicRepos')} value={stats?.publicRepositories ?? 0} icon={Globe2} />
        <StatCard label={t('overview.sessions')} value={stats?.activeSessions ?? 0} icon={KeyRound} />
        <StatCard label={t('overview.weekEvents')} value={stats?.eventsThisWeek ?? 0} icon={Activity} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title={t('overview.recentActivity')} className="lg:col-span-2">
          {events.length === 0 ? (
            <EmptyState title={t('activity.empty')} />
          ) : (
            <ul className="divide-y divide-slate-800">
              {events.map((event) => (
                <li key={event.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-200">{event.summary}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-500">{event.kind}</p>
                  </div>
                  <time className="shrink-0 text-[11px] text-slate-500">
                    {new Date(event.created_at).toLocaleString(language === 'ar' ? 'ar' : 'en-GB')}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t('overview.platform')}>
          <ul className="space-y-3 text-sm">
            {[
              { label: t('overview.apiRust'), online: health?.upstream === 'healthy' },
              { label: t('overview.gatewayGo'), online: Boolean(health) },
              { label: t('overview.database'), online: Boolean(health?.database) },
            ].map((row) => (
              <li key={row.label} className="flex items-center justify-between gap-3">
                <span className="text-slate-300">{row.label}</span>
                <span className="flex items-center gap-2 text-xs text-slate-400">
                  <StatusDot online={row.online} />
                  {row.online ? t('overview.online') : t('overview.offline')}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
};
