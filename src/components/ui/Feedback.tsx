import React from 'react';
import { AlertTriangle, CheckCircle2, Inbox, Loader2 } from 'lucide-react';

export const Alert: React.FC<{ tone: 'error' | 'success'; children: React.ReactNode }> = ({
  tone,
  children,
}) => {
  const Icon = tone === 'error' ? AlertTriangle : CheckCircle2;
  const styles =
    tone === 'error'
      ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
      : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';

  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${styles}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="leading-relaxed">{children}</span>
    </p>
  );
};

export const EmptyState: React.FC<{ title: string; hint?: string; action?: React.ReactNode }> = ({
  title,
  hint,
  action,
}) => (
  <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-800 px-6 py-12 text-center">
    <Inbox className="h-8 w-8 text-slate-600" />
    <div>
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
    {action}
  </div>
);

export const LoadingBlock: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
    <Loader2 className="h-4 w-4 animate-spin" />
    {label}
  </div>
);

export const StatusDot: React.FC<{ online: boolean }> = ({ online }) => (
  <span
    className={`inline-block h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-rose-500'}`}
    aria-hidden
  />
);
