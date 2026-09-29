import React from 'react';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: React.ElementType;
  count?: number;
}

interface TabsProps<T extends string> {
  items: readonly TabItem<NoInfer<T>>[];
  active: T;
  onChange: (id: NoInfer<T>) => void;
}

export function Tabs<T extends string>({ items, active, onChange }: TabsProps<T>) {
  return (
    <div role="tablist" className="flex items-center gap-1 overflow-x-auto border-b border-slate-800">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              isActive
                ? 'border-sky-400 text-white'
                : 'border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {item.label}
            {item.count !== undefined && (
              <span className="rounded-full bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
