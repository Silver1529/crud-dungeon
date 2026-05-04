// components/panels/StatsCards.jsx
'use client';
// EDUCATIONAL: Stats com mini-bar comparativa entre as 4 operações + countup
// e sparkline simples de últimas N operações por timestamp.
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, Plus, Pencil, Trash2, AlertOctagon, Activity } from 'lucide-react';
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
  { key: 'reads',   label: 'READ',   icon: Eye,    color: 'cyan',    op: 'GET',    method: 'GET' },
  { key: 'writes',  label: 'CREATE', icon: Plus,   color: 'emerald', op: 'POST',   method: 'POST' },
  { key: 'updates', label: 'UPDATE', icon: Pencil, color: 'amber',   op: 'PUT',    method: 'PUT' },
  { key: 'deletes', label: 'DELETE', icon: Trash2, color: 'rose',    op: 'DELETE', method: 'DELETE' },
];

const COLORS = {
  cyan:    { ring: 'border-cyan-400/30',    bg: 'from-cyan-500/15',    fg: 'text-cyan-300',    bar: 'bg-cyan-400',    glow: 'shadow-[0_0_30px_rgba(34,211,238,0.2)]' },
  emerald: { ring: 'border-emerald-400/30', bg: 'from-emerald-500/15', fg: 'text-emerald-300', bar: 'bg-emerald-400', glow: 'shadow-[0_0_30px_rgba(16,185,129,0.2)]' },
  amber:   { ring: 'border-amber-400/30',   bg: 'from-amber-500/15',   fg: 'text-amber-300',   bar: 'bg-amber-400',   glow: 'shadow-[0_0_30px_rgba(251,191,36,0.2)]' },
  rose:    { ring: 'border-rose-400/30',    bg: 'from-rose-500/15',    fg: 'text-rose-300',    bar: 'bg-rose-400',    glow: 'shadow-[0_0_30px_rgba(244,63,94,0.2)]' },
};

// EDUCATIONAL: sparkline mini — distribui timestamps em buckets relativos ao
// timestamp mais recente recebido (não usa Date.now em render — pureza React 19).
function Sparkline({ timestamps, color, buckets = 12 }) {
  const data = new Array(buckets).fill(0);
  if (timestamps.length > 0) {
    const max_ts = Math.max(...timestamps);
    const span = 60_000;
    const start = max_ts - span;
    for (const ts of timestamps) {
      if (ts < start) continue;
      const idx = Math.min(buckets - 1, Math.floor(((ts - start) / span) * buckets));
      data[idx]++;
    }
  }
  const max = Math.max(1, ...data);
  return (
    <div className="flex items-end gap-0.5 h-4 mt-1">
      {data.map((v, i) => (
        <div
          key={i}
          className={`flex-1 ${color} rounded-sm transition-all`}
          style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? '15%' : '5%', opacity: v > 0 ? 0.9 : 0.2 }}
        />
      ))}
    </div>
  );
}

export default function StatsCards() {
  const stats = useGameStore((s) => s.stats);
  const networkLog = useGameStore((s) => s.networkLog);

  // total pra calcular % por operação
  const total = (stats.reads || 0) + (stats.writes || 0) + (stats.updates || 0) + (stats.deletes || 0);

  return (
    <div className="p-3 space-y-3">
      {/* total banner */}
      <div className="rounded-xl border border-white/5 bg-gradient-to-r from-cyan-500/5 via-violet-500/5 to-emerald-500/5 p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
          <Activity className="w-5 h-5 text-cyan-300" />
        </div>
        <div className="flex-1">
          <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Total operations</div>
          <div className="text-2xl font-mono text-cyan-300 font-bold">
            <CountUp value={total} />
          </div>
        </div>
        <div className="text-[10px] text-slate-500 font-mono text-right">
          <div>erros</div>
          <div className="text-rose-400 text-base font-bold"><CountUp value={stats.errors || 0} /></div>
        </div>
      </div>

      {/* 4 op cards com sparkline */}
      <div className="grid grid-cols-2 gap-2">
        {CARDS.map(({ key, label, icon: Icon, color, op, method }) => {
          const c = COLORS[color];
          const value = stats[key] || 0;
          const pct = total > 0 ? Math.round((value / total) * 100) : 0;
          // timestamps de requests dessa op (pro sparkline)
          const tsForOp = networkLog.filter((e) => e.method === method).map((e) => e.ts);
          return (
            <motion.div
              key={key}
              whileHover={{ y: -2, scale: 1.02 }}
              className={`relative rounded-xl border ${c.ring} bg-gradient-to-br ${c.bg} to-transparent p-2.5 ${c.glow} overflow-hidden`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`w-3.5 h-3.5 ${c.fg}`} />
                <span className={`text-[9px] font-mono ${c.fg}`}>{op}</span>
              </div>
              <div className={`mt-1 text-2xl font-mono font-bold ${c.fg}`}>
                <CountUp value={value} />
              </div>
              <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono">
                <span className="uppercase tracking-wider">{label}</span>
                <span>{pct}%</span>
              </div>
              <Sparkline timestamps={tsForOp} color={c.bar} />
            </motion.div>
          );
        })}
      </div>

      {/* mini-summary de erros */}
      {(stats.errors || 0) > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 flex items-center gap-3"
        >
          <AlertOctagon className="w-4 h-4 text-rose-400" />
          <div className="flex-1 text-[11px] font-mono text-rose-200">
            {stats.errors} request{stats.errors === 1 ? '' : 's'} com erro. Veja o painel Network pra detalhes.
          </div>
        </motion.div>
      )}
    </div>
  );
}
