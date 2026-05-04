// components/panels/DatabaseView.jsx
'use client';
// EDUCATIONAL: Database View moderno — header em estilo schema, linhas
// destacam ao mudar (highlight pulsante), badges coloridos por tipo+status.
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/lib/store';
import { Database, Server, Zap, Network, Hash } from 'lucide-react';

const TIPO = {
  servidor: { color: 'text-cyan-300',    bg: 'bg-cyan-400/10',    ring: 'ring-cyan-400/20',    icon: Server },
  banco:    { color: 'text-violet-300',  bg: 'bg-violet-400/10',  ring: 'ring-violet-400/20',  icon: Database },
  cache:    { color: 'text-amber-300',   bg: 'bg-amber-400/10',   ring: 'ring-amber-400/20',   icon: Zap },
  router:   { color: 'text-emerald-300', bg: 'bg-emerald-400/10', ring: 'ring-emerald-400/20', icon: Network },
};

const STATUS = {
  novo:    { dot: 'bg-slate-400',   text: 'text-slate-300' },
  ativo:   { dot: 'bg-emerald-400', text: 'text-emerald-300' },
  upgrade: { dot: 'bg-amber-400',   text: 'text-amber-300' },
  critico: { dot: 'bg-rose-400 animate-pulse', text: 'text-rose-300' },
};

// EDUCATIONAL: detecta linha modificada (status mudou) e dispara highlight.
function useChangedRows(rows) {
  const lastRef = useRef(new Map());
  const [changed, setChanged] = useState(new Set());
  useEffect(() => {
    const next = new Map();
    const newlyChanged = new Set();
    for (const r of rows) {
      const prev = lastRef.current.get(r.id);
      if (prev && prev.status !== r.status) newlyChanged.add(r.id);
      next.set(r.id, r);
    }
    lastRef.current = next;
    if (newlyChanged.size > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChanged(newlyChanged);
      const t = setTimeout(() => setChanged(new Set()), 800);
      return () => clearTimeout(t);
    }
  }, [rows]);
  return changed;
}

export default function DatabaseView() {
  const objetos = useGameStore((s) => s.objetos);
  const real = objetos.filter((o) => !String(o.id).startsWith('tmp-'));
  const changed = useChangedRows(real);

  return (
    <div className="font-mono text-xs">
      {/* schema header */}
      <div className="px-3 py-2 border-b border-white/5 bg-white/[0.02] sticky top-0 backdrop-blur z-10">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-violet-300" />
          <code className="text-violet-200 font-bold">cruddungeon</code>
          <span className="text-slate-500">.</span>
          <code className="text-cyan-300 font-bold">game_objects</code>
          <span className="ml-auto text-[10px] text-slate-400">
            <span className="text-cyan-300 font-bold">{real.length}</span>
            <span className="ml-1">linha{real.length === 1 ? '' : 's'}</span>
          </span>
        </div>
        <div className="text-[9px] text-slate-500 mt-0.5">
          5 colunas · id INT PK · tipo VARCHAR · status VARCHAR · pos_x INT · pos_y INT
        </div>
      </div>

      <div className="p-2">
        {real.length === 0 ? (
          <div className="text-center text-slate-500 py-12 text-[11px]">
            <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
            tabela vazia · plante um objeto no jogo
          </div>
        ) : (
          <div className="space-y-1.5">
            <AnimatePresence initial={false}>
              {real.map((o) => {
                const t = TIPO[o.tipo] || TIPO.servidor;
                const s = STATUS[o.status] || STATUS.novo;
                const Icon = t.icon;
                const isChanged = changed.has(o.id);
                return (
                  <motion.div
                    key={o.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96, x: -8 }}
                    animate={{
                      opacity: 1, scale: 1, x: 0,
                      backgroundColor: isChanged ? 'rgba(251, 191, 36, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    }}
                    exit={{ opacity: 0, scale: 0.95, x: 8, backgroundColor: 'rgba(244, 63, 94, 0.18)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    className={`rounded-lg border border-white/5 p-2 flex items-center gap-2 ${t.ring} ring-1`}
                  >
                    {/* id */}
                    <div className="flex items-center gap-1 text-slate-500 text-[10px] w-10 shrink-0">
                      <Hash className="w-2.5 h-2.5" />
                      <span className="text-slate-300 font-bold">{o.id}</span>
                    </div>
                    {/* tipo badge */}
                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${t.bg} ${t.color} text-[10px]`}>
                      <Icon className="w-2.5 h-2.5" />
                      {o.tipo}
                    </div>
                    {/* status pill */}
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                      <span className={`text-[10px] ${s.text}`}>{o.status}</span>
                    </div>
                    {/* coords */}
                    <code className="ml-auto text-[10px] text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">
                      ({o.pos_x}, {o.pos_y})
                    </code>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
