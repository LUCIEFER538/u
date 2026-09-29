import React from 'react';

const CONTROL =
  'w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 transition-colors focus:border-sky-500 focus:outline-none disabled:opacity-60';

interface FieldWrapperProps {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldWrapperProps> = ({ label, hint, htmlFor, children }) => (
  <div className="space-y-1.5">
    <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-300">
      {label}
    </label>
    {children}
    {hint && <p className="text-[11px] leading-relaxed text-slate-500">{hint}</p>}
  </div>
);

export const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  className = '',
  ...props
}) => <input {...props} className={`${CONTROL} ${className}`} />;

export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({
  className = '',
  ...props
}) => <textarea {...props} className={`${CONTROL} min-h-24 resize-y ${className}`} />;

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <select {...props} className={`${CONTROL} ${className}`}>
    {children}
  </select>
);
