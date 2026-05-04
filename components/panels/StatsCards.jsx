// components/panels/StatsCards.jsx
'use client';
// EDUCATIONAL: count-up animation usando Intl.NumberFormat + framer-motion.
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, Plus, Pencil, Trash2, AlertOctagon } from 'lucide-react';
import { useGameStore } from '@/lib/store';

function CountUp({ value, duration = 600 }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const n = Math.round(from + (to - from) * eased);
      setDisplay(n);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span>{display}</span>;
}

const CARDS = [
  { key: 'reads', label: 'READ', icon: Eye, color: 'cyan', op: 'GET' },
  { key: 'writes', label: 'CREATE', icon: Plus, color: 'emerald', op: 'POST' },
  { key: 'updates', label: 'UPDATE', icon: Pencil, color: 'amber', op: 'PUT' },
  { key: 'deletes', label: 'DELETE', icon: Trash2, color: 'rose', op: 'DELETE' },
];

const COLORS = {
  cyan:    { ring: 'border-cyan-400/30',    bg: 'from-cyan-500/10',    fg: 'text-cyan-300',    glow: 'shadow-[0_0_24px_rgba(34,211,238,0.18)]' },
  emerald: { ring: 'border-emerald-400/30', bg: 'from-emerald-500/10', fg: 'text-emerald-300', glow: 'shadow-[0_0_24px_rgba(16,185,129,0.18)]' },
  amber:   { ring: 'border-amber-400/30',   bg: 'from-amber-500/10',   fg: 'text-amber-300',   glow: 'shadow-[0_0_24px_rgba(251,191,36,0.18)]' },
  rose:    { ring: 'border-rose-400/30',    bg: 'from-rose-500/10',    fg: 'text-rose-300',    glow: 'shadow-[0_0_24px_rgba(244,63,94,0.18)]' },
};

export default function StatsCards() {
  const stats = useGameStore((s) => s.stats);

  return (
    <div className="p-3 grid grid-cols-2 gap-2">
      {CARDS.map(({ key, label, icon: Icon, color, op }) => {
        const c = COLORS[color];
        return (
          <motion.div
            key={key}
            whileHover={{ y: -2, scale: 1.02 }}
            className={`relative rounded-xl border ${c.ring} bg-gradient-to-br ${c.bg} to-transparent p-3 ${c.glow}`}
          >
            <div className="flex items-center justify-between">
              <Icon className={`w-4 h-4 ${c.fg}`} />
              <span className={`text-[10px] font-mono ${c.fg}`}>{op}</span>
            </div>
            <div className={`mt-2 text-3xl font-mono font-bold ${c.fg}`}>
              <CountUp value={stats[key] || 0} />
            </div>
            <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
              {label}
            </div>
          </motion.div>
        );
      })}

      <motion.div
        className="col-span-2 rounded-xl border border-white/5 bg-white/[0.02] p-3 flex items-center gap-3"
        whileHover={{ scale: 1.01 }}
      >
        <AlertOctagon className="w-4 h-4 text-slate-500" />
        <div className="flex-1">
          <div className="text-[10px] text-slate-500 font-mono uppercase">errors</div>
          <div className="text-xl font-mono text-slate-200">
            <CountUp value={stats.errors || 0} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
