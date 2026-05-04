// components/panels/SqlConsole.jsx
'use client';
// EDUCATIONAL: mostra cada SQL executado. Syntax highlight feito à mão (sem libs pesadas).
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/lib/store';
import { Terminal } from 'lucide-react';

const KEYWORDS = /\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|ORDER|BY|ASC|DESC|AND|OR|LIMIT)\b/g;

function highlight(sql) {
  if (!sql) return null;
  const parts = [];
  let last = 0;
  let m;
  const regex = new RegExp(KEYWORDS);
  while ((m = regex.exec(sql)) !== null) {
    if (m.index > last) parts.push({ type: 'text', value: sql.slice(last, m.index) });
    parts.push({ type: 'kw', value: m[0] });
    last = regex.lastIndex;
  }
  if (last < sql.length) parts.push({ type: 'text', value: sql.slice(last) });

  return parts.map((p, i) => {
    if (p.type === 'kw') return <span key={i} className="text-violet-300 font-bold">{p.value}</span>;
    // strings
    const subParts = p.value.split(/('[^']*')/g);
    return subParts.map((sp, j) => {
      if (sp.startsWith("'") && sp.endsWith("'")) {
        return <span key={`${i}-${j}`} className="text-amber-300">{sp}</span>;
      }
      return <span key={`${i}-${j}`}>{sp}</span>;
    });
  });
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour12: false });
}

export default function SqlConsole() {
  const sqlLog = useGameStore((s) => s.sqlLog);

  return (
    <div className="p-3 font-mono text-xs space-y-2 bg-slate-950/50">
      {sqlLog.length === 0 && (
        <div className="text-slate-500 flex items-center gap-2 py-8 justify-center">
          <Terminal className="w-4 h-4" />
          aguardando queries...
        </div>
      )}
      <AnimatePresence initial={false}>
        {sqlLog.map((entry) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="border-l-2 border-cyan-400/40 pl-2 py-1"
          >
            <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-1">
              <span>[{fmtTime(entry.ts)}]</span>
              <span className={entry.status >= 400 ? 'text-rose-400' : 'text-emerald-400'}>
                {entry.status >= 400 ? '✗' : '✓'} status {entry.status}
              </span>
              {entry.affected != null && (
                <span className="text-slate-400">{entry.affected} row(s)</span>
              )}
            </div>
            <pre className="whitespace-pre-wrap break-all text-slate-200 leading-relaxed">
              {highlight(entry.sql)}
            </pre>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
