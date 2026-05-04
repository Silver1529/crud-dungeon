// components/panels/SqlConsole.jsx
'use client';
// EDUCATIONAL: SQL Console reformulado — terminal moderno com cursor piscando,
// status colorido por keyword e timestamp em estilo monitor de logs.
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/lib/store';
import { Terminal, CheckCircle2, XCircle } from 'lucide-react';

const KEYWORDS = /\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|ORDER|BY|ASC|DESC|AND|OR|LIMIT)\b/g;

function highlight(sql) {
  if (!sql) return null;
  const lines = sql.split('\n');
  return lines.map((line, li) => (
    <span key={li} className="block">
      {line.split(KEYWORDS).map((part, i) => {
        if (KEYWORDS.test(part)) {
          KEYWORDS.lastIndex = 0;
          return <span key={i} className="text-violet-300 font-bold">{part}</span>;
        }
        // strings em aspas simples
        const sub = part.split(/('[^']*')/g);
        return sub.map((sp, j) => {
          if (sp.startsWith("'") && sp.endsWith("'")) {
            return <span key={`${i}-${j}`} className="text-amber-300">{sp}</span>;
          }
          // numbers
          return sp.split(/(\b\d+\b)/g).map((np, k) => (
            /^\d+$/.test(np)
              ? <span key={`${i}-${j}-${k}`} className="text-cyan-300">{np}</span>
              : <span key={`${i}-${j}-${k}`}>{np}</span>
          ));
        });
      })}
    </span>
  ));
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour12: false });
}

function firstKeyword(sql) {
  if (!sql) return 'SQL';
  const m = sql.match(/^[\s-]*(SELECT|INSERT|UPDATE|DELETE)/i);
  return m ? m[1].toUpperCase() : 'SQL';
}

const KW_COLOR = {
  SELECT: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300',
  INSERT: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  UPDATE: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  DELETE: 'border-rose-400/40 bg-rose-400/10 text-rose-300',
  SQL:    'border-slate-400/40 bg-slate-400/10 text-slate-300',
};

export default function SqlConsole() {
  const sqlLog = useGameStore((s) => s.sqlLog);

  return (
    <div className="font-mono text-xs bg-gradient-to-b from-slate-950 to-slate-950/40 min-h-full">
      {/* Header em estilo terminal */}
      <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2 text-[10px] text-slate-500 sticky top-0 bg-slate-950/80 backdrop-blur z-10">
        <span className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-500/60" />
          <span className="w-2 h-2 rounded-full bg-amber-500/60" />
          <span className="w-2 h-2 rounded-full bg-emerald-500/60" />
        </span>
        <Terminal className="w-3 h-3 ml-1" />
        <span>mysql@cruddungeon</span>
        <span className="ml-auto text-emerald-400 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          LIVE
        </span>
      </div>

      <div className="p-3 space-y-2">
        {sqlLog.length === 0 && (
          <div className="text-slate-500 flex items-center gap-2 py-12 justify-center">
            <span className="text-cyan-400">$</span>
            aguardando queries
            <span className="inline-block w-1.5 h-3 bg-cyan-400/70 animate-pulse" />
          </div>
        )}
        <AnimatePresence initial={false}>
          {sqlLog.map((entry) => {
            const kw = firstKeyword(entry.sql);
            const ok = entry.status < 400;
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -12, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="rounded-lg border border-white/5 bg-white/[0.02] overflow-hidden"
              >
                {/* meta row */}
                <div className="flex items-center gap-2 px-2 py-1 bg-white/[0.03] border-b border-white/5 text-[10px]">
                  <span className={`px-1.5 py-0.5 rounded border font-bold ${KW_COLOR[kw] || KW_COLOR.SQL}`}>
                    {kw}
                  </span>
                  <span className="text-slate-500">{fmtTime(entry.ts)}</span>
                  <span className="ml-auto flex items-center gap-1.5">
                    {ok
                      ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      : <XCircle className="w-3 h-3 text-rose-400" />
                    }
                    <span className={ok ? 'text-emerald-400' : 'text-rose-400'}>{entry.status}</span>
                    {entry.affected != null && (
                      <span className="text-slate-400">· {entry.affected} row{entry.affected === 1 ? '' : 's'}</span>
                    )}
                  </span>
                </div>
                <pre className="px-2 py-1.5 whitespace-pre-wrap break-all text-slate-200 leading-relaxed">
                  {highlight(entry.sql)}
                </pre>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
