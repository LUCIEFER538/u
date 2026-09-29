import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Activity,
  FolderGit2,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import type { TranslationKey } from '../../lib/i18n';
import { Button } from '../ui/Button';

const NAV_ITEMS: { to: string; labelKey: TranslationKey; icon: React.ElementType }[] = [
  { to: '/', labelKey: 'nav.overview', icon: LayoutDashboard },
  { to: '/repositories', labelKey: 'nav.repositories', icon: FolderGit2 },
  { to: '/activity', labelKey: 'nav.activity', icon: Activity },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings },
];

export const AppLayout: React.FC = () => {
  const { t, toggleLanguage } = useLanguage();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const navigation = (
    <nav className="space-y-1">
      {NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={() => setMobileNavOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              isActive
                ? 'bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/30'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
            }`
          }
        >
          <Icon className="h-4 w-4" />
          {t(labelKey)}
        </NavLink>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500 font-black text-slate-950">
        G
      </span>
      <div className="leading-tight">
        <p className="text-sm font-bold text-white">{t('app.name')}</p>
        <p className="text-[11px] text-slate-500">{t('app.tagline')}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0b0f16]">
      <aside className="fixed inset-y-0 hidden w-64 flex-col justify-between border-slate-800 bg-slate-950/70 p-4 lg:flex ltr:left-0 ltr:border-r rtl:right-0 rtl:border-l">
        <div className="space-y-6">
          {brand}
          {navigation}
        </div>
        <div className="space-y-3 border-t border-slate-800 pt-4">
          <div className="truncate rounded-lg bg-slate-900/70 px-3 py-2">
            <p className="truncate text-xs font-semibold text-white">{user?.display_name}</p>
            <p className="truncate font-mono text-[11px] text-slate-500">@{user?.username}</p>
          </div>
          <Button variant="ghost" size="sm" icon={LogOut} onClick={handleSignOut} className="w-full">
            {t('nav.signOut')}
          </Button>
        </div>
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute inset-y-0 w-64 border-slate-800 bg-slate-950 p-4 ltr:left-0 ltr:border-r rtl:right-0 rtl:border-l">
            <div className="mb-6 flex items-center justify-between">
              {brand}
              <Button variant="ghost" size="sm" icon={X} onClick={() => setMobileNavOpen(false)} />
            </div>
            {navigation}
          </div>
        </div>
      )}

      <div className="lg:ltr:pl-64 lg:rtl:pr-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-800 bg-[#0b0f16]/90 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={Menu}
              className="lg:hidden"
              aria-label={t('nav.menu')}
              onClick={() => setMobileNavOpen(true)}
            />
            <span className="text-sm font-semibold text-slate-300 lg:hidden">{t('app.name')}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleLanguage}>
              {t('common.language')}
            </Button>
            <NavLink
              to="/settings"
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-700"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-500/20 font-bold text-sky-300">
                {user?.display_name.charAt(0).toUpperCase()}
              </span>
              <span className="hidden sm:inline">{user?.display_name}</span>
            </NavLink>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
