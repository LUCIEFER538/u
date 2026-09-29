import React, { useEffect, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Alert, EmptyState, LoadingBlock } from '../components/ui/Feedback';
import { Badge } from '../components/ui/Badge';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../lib/api';
import { describeError } from '../lib/errors';
import type { ActivityEvent } from '../types';

export const ActivityPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .activity(100)
      .then((data) => active && setEvents(data))
      .catch((err) => active && setError(describeError(err, t)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [t]);

  return (
    <>
      <PageHeader title={t('activity.title')} subtitle={t('activity.subtitle')} />
      {error && (
        <div className="mb-6">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      <Card>
        {loading ? (
          <LoadingBlock label={t('common.loading')} />
        ) : events.length === 0 ? (
          <EmptyState title={t('activity.empty')} />
        ) : (
          <ol className="divide-y divide-slate-800">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <Badge tone="accent">{event.kind}</Badge>
                  <span className="truncate text-sm text-slate-200">{event.summary}</span>
                  {event.repository_name && (
                    <span className="font-mono text-[11px] text-slate-500">{event.repository_name}</span>
                  )}
                </div>
                <time className="shrink-0 text-[11px] text-slate-500">
                  {new Date(event.created_at).toLocaleString(language === 'ar' ? 'ar' : 'en-GB')}
                </time>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
};
