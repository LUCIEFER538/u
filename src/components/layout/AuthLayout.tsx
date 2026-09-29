import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { Button } from '../ui/Button';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ title, subtitle, footer, children }) => {
  const { t, toggleLanguage } = useLanguage();

  return (
    <div className="grid min-h-screen bg-[#0b0f16] lg:grid-cols-2">
      <aside className="hidden flex-col justify-between border-slate-800 bg-slate-950/60 p-10 lg:flex ltr:border-r rtl:border-l">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 text-lg font-black text-slate-950">
            G
          </span>
          <div className="leading-tight">
            <p className="text-base font-bold text-white">{t('app.name')}</p>
            <p className="text-xs text-slate-500">{t('app.tagline')}</p>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold leading-snug text-white">{t('auth.signUpSubtitle')}</h2>
          <p className="flex items-start gap-2 text-sm leading-relaxed text-slate-400">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
            {t('auth.securityNote')}
          </p>
        </div>

        <ul className="flex flex-wrap gap-2 font-mono text-[11px] text-slate-500">
          {['Rust · Axum', 'Go gateway', 'PostgreSQL', 'React · TypeScript'].map((item) => (
            <li key={item} className="rounded-full border border-slate-800 px-3 py-1">
              {item}
            </li>
          ))}
        </ul>
      </aside>

      <main className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-bold text-white lg:hidden">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 font-black text-slate-950">
                G
              </span>
              {t('app.name')}
            </span>
            <Button variant="ghost" size="sm" onClick={toggleLanguage} className="ltr:ml-auto rtl:mr-auto">
              {t('common.language')}
            </Button>
          </div>

          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-400">{subtitle}</p>

          <div className="mt-7 rounded-xl border border-slate-800 bg-slate-900/60 p-6">{children}</div>

          <p className="mt-5 text-center text-xs text-slate-400">{footer}</p>
        </div>
      </main>
    </div>
  );
};
