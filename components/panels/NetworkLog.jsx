// components/panels/NetworkLog.jsx
'use client';
// EDUCATIONAL: cards expansíveis com método (cor), URL, payload, status, ms.
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Network } from 'lucide-react';
import { useGameStore } from '@/lib/store';

const METHOD_BADGE = {
  GET: 'bg-cyan-400/15 text-cyan-300 border-cyan-400/30',
  POST: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30',
  PUT: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
  DELETE: 'bg-rose-400/15 text-rose-300 border-rose-400/30',
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

function Item({ entry }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="border border-white/5 rounded-lg overflow-hidden bg-white/[0.02]"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/[0.04] text-left"
      >
        <motion.span animate={{ rotate: open ? 90 : 0 }} className="text-slate-500">
          <ChevronRight className="w-3.5 h-3.5" />
        </motion.span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${METHOD_BADGE[entry.method]}`}>
          {entry.method}
        </span>
        <code className="text-[10px] text-slate-300 truncate flex-1">{entry.url}</code>
        <span className={`text-[10px] font-mono ${statusColor(entry.status)}`}>
          {entry.status}
        </span>
        <span className="text-[10px] text-slate-500 font-mono">{entry.ms}ms</span>
      </button>
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
                ts <span className="text-slate-300">{fmtTime(entry.ts)}</span>
                <span className="ml-3">x-request-id</span>{' '}
                <span className="text-slate-300">{entry.requestId}</span>
              </div>
              <pre className="bg-slate-950/60 rounded p-2 text-slate-300 whitespace-pre-wrap break-all overflow-auto max-h-40">
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
  return (
    <div className="p-3 space-y-1.5 font-mono">
      {log.length === 0 && (
        <div className="text-slate-500 flex items-center gap-2 py-8 justify-center text-xs">
          <Network className="w-4 h-4" />
          nenhuma request ainda...
        </div>
      )}
      <AnimatePresence initial={false}>
        {log.map((entry) => (
          <Item key={entry.id} entry={entry} />
        ))}
      </AnimatePresence>
    </div>
  );
}
