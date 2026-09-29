import React from 'react';

interface CardProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ title, description, actions, className = '', children }) => (
  <section className={`rounded-xl border border-slate-800 bg-slate-900/60 ${className}`}>
    {(title || actions) && (
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-3.5">
        <div>
          {title && <h2 className="text-sm font-bold text-white">{title}</h2>}
          {description && <p className="mt-0.5 text-xs text-slate-400">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
    )}
    <div className="p-5">{children}</div>
  </section>
);

export const StatCard: React.FC<{ label: string; value: React.ReactNode; icon: React.ElementType }> = ({
  label,
  value,
  icon: Icon,
}) => (
  <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-300">
      <Icon className="h-5 w-5" />
    </span>
    <div className="min-w-0">
      <p className="truncate text-xs text-slate-400">{label}</p>
      <p className="font-mono text-xl font-bold text-white">{value}</p>
    </div>
  </div>
);
