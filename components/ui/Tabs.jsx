// components/ui/Tabs.jsx
'use client';
// EDUCATIONAL: Tabs reutilizáveis com indicador animado (framer-motion layoutId).
import { useState } from 'react';
import { motion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';

export function Tabs({ tabs, defaultValue, className }) {
  const [active, setActive] = useState(defaultValue ?? tabs[0]?.value);
  const current = tabs.find((t) => t.value === active);

  return (
    <div className={twMerge('flex flex-col h-full min-h-0', className)}>
      <div className="flex gap-1 p-1 border-b border-white/5 bg-white/[0.02]">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setActive(t.value)}
            className={twMerge(
              'relative px-3 py-2 text-xs font-mono rounded-md transition-colors flex items-center gap-1.5',
              active === t.value ? 'text-cyan-300' : 'text-slate-400 hover:text-slate-200'
            )}
          >
            {active === t.value && (
              <motion.span
                layoutId="tab-active"
                className="absolute inset-0 bg-cyan-400/10 border border-cyan-400/30 rounded-md"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {t.icon}
              {t.label}
              {typeof t.badge === 'number' && (
                <span className="bg-white/10 text-[10px] px-1.5 py-0.5 rounded">{t.badge}</span>
              )}
            </span>
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto min-h-0">{current?.content}</div>
    </div>
  );
}
