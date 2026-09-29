import React from 'react';

type Tone = 'neutral' | 'accent' | 'success' | 'warning';

const TONES: Record<Tone, string> = {
  neutral: 'border-slate-700 bg-slate-800/60 text-slate-300',
  accent: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
};

export const Badge: React.FC<{ tone?: Tone; children: React.ReactNode }> = ({
  tone = 'neutral',
  children,
}) => (
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONES[tone]}`}>
    {children}
  </span>
);
