// components/panels/NetworkLog.jsx
'use client';
// EDUCATIONAL: NetworkLog estilo waterfall — barra horizontal pra cada request,
// com largura proporcional ao tempo de resposta. Igual DevTools mas mini.
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Network } from 'lucide-react';
import { useGameStore } from '@/lib/store';

const METHOD_COLOR = {
  GET:    { ring: 'border-cyan-400/40',    bar: 'from-cyan-400/70 to-cyan-400/30',    text: 'text-cyan-300' },
  POST:   { ring: 'border-emerald-400/40', bar: 'from-emerald-400/70 to-emerald-400/30', text: 'text-emerald-300' },
  PUT:    { ring: 'border-amber-400/40',   bar: 'from-amber-400/70 to-amber-400/30',  text: 'text-amber-300' },
  DELETE: { ring: 'border-rose-400/40',    bar: 'from-rose-400/70 to-rose-400/30',    text: 'text-rose-300' },
};

function statusColor(s) {
  if (s >= 500) return 'text-rose-400';
  if (s >= 400) return 'text-amber-400';
  if (s >= 200) return 'text-emerald-400';
  return 'text-slate-400';
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour12: false });
}

function Item({ entry, maxMs }) {
  const [open, setOpen] = useState(false);
  const m = METHOD_COLOR[entry.method] || METHOD_COLOR.GET;
  const widthPct = Math.max(4, Math.min(100, (entry.ms / Math.max(1, maxMs)) * 100));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`border ${m.ring} bg-white/[0.02] rounded-lg overflow-hidden`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/[0.04] text-left"
      >
        <motion.span animate={{ rotate: open ? 90 : 0 }} className="text-slate-500 shrink-0">
          <ChevronRight className="w-3 h-3" />
        </motion.span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${m.ring} ${m.text} bg-white/5 shrink-0`}>
          {entry.method}
        </span>
        <code className="text-[10px] text-slate-300 truncate flex-1">{entry.url}</code>
        <span className={`text-[10px] font-mono ${statusColor(entry.status)} shrink-0`}>
          {entry.status}
        </span>
      </button>
      {/* waterfall bar */}
      <div className="px-2 pb-1.5 flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${widthPct}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className={`h-full bg-gradient-to-r ${m.bar} rounded-full`}
          />
        </div>
        <span className="text-[10px] text-slate-400 font-mono w-10 text-right shrink-0">{entry.ms}ms</span>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="p-2 space-y-1 text-[10px] font-mono">
              <div className="text-slate-500">
                <span className="text-slate-400">ts</span> <span className="text-slate-300">{fmtTime(entry.ts)}</span>
                <span className="ml-3 text-slate-400">x-request-id</span> <span className="text-slate-300">{entry.requestId}</span>
              </div>
              <pre className="bg-slate-950/60 rounded p-2 text-slate-300 whitespace-pre-wrap break-all overflow-auto max-h-40 border border-white/5">
                {JSON.stringify(entry.payload, null, 2)}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function NetworkLog() {
  const log = useGameStore((s) => s.networkLog);
  // EDUCATIONAL: maxMs serve de escala pra barras waterfall — todas comparáveis.
  const maxMs = useMemo(() => Math.max(50, ...log.map((e) => e.ms || 0)), [log]);

  return (
    <div className="p-3 space-y-1.5 font-mono">
      {log.length === 0 && (
        <div className="text-slate-500 flex items-center gap-2 py-12 justify-center text-xs">
          <Network className="w-4 h-4" />
          nenhuma request ainda
        </div>
      )}
      {log.length > 0 && (
        <div className="text-[9px] text-slate-500 mb-1 flex items-center gap-2">
          <span>waterfall · escala: 0–{maxMs}ms</span>
        </div>
      )}
      <AnimatePresence initial={false}>
        {log.map((entry) => (
          <Item key={entry.id} entry={entry} maxMs={maxMs} />
        ))}
      </AnimatePresence>
    </div>
  );
}
