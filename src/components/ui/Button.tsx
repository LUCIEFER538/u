import React from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-sky-500 text-slate-950 hover:bg-sky-400 border border-sky-400/60 shadow-sm shadow-sky-500/20',
  secondary:
    'bg-slate-800/70 text-slate-100 hover:bg-slate-700/80 border border-slate-700',
  ghost: 'bg-transparent text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent',
  danger: 'bg-rose-600/90 text-white hover:bg-rose-500 border border-rose-500/60',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ElementType;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon: Icon,
  className = '',
  children,
  disabled,
  ...props
}) => (
  <button
    {...props}
    disabled={disabled || loading}
    className={`inline-flex items-center justify-center rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
  >
    {loading ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : (
      Icon && <Icon className="h-4 w-4" />
    )}
    {children}
  </button>
);
