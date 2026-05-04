// components/ui/Card.jsx
'use client';
import { twMerge } from 'tailwind-merge';

export function Card({ className, children, ...rest }) {
  return (
    <div
      className={twMerge(
        'glass rounded-lg p-3 shadow-[0_8px_32px_rgba(0,0,0,0.35)]',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, hint, icon, className }) {
  return (
    <div className={twMerge('flex items-center justify-between mb-2', className)}>
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-mono text-xs text-slate-300 uppercase tracking-wider">{title}</h3>
      </div>
      {hint && <span className="text-[10px] font-mono text-slate-500">{hint}</span>}
    </div>
  );
}
