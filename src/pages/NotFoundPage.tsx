import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useLanguage } from '../context/LanguageContext';

export const NotFoundPage: React.FC = () => {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="font-mono text-5xl font-black text-slate-700">404</p>
      <h1 className="text-lg font-bold text-white">{t('notFound.title')}</h1>
      <Link to="/">
        <Button variant="primary">{t('notFound.action')}</Button>
      </Link>
    </div>
  );
};
