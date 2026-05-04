// components/panels/DatabaseView.jsx
'use client';
// EDUCATIONAL: tabela viva do banco. Layout animation do framer-motion
// produz reordenação suave quando linhas entram/saem.
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/lib/store';
import { Database } from 'lucide-react';

const TIPO_COLOR = {
  servidor: 'text-cyan-300',
  banco: 'text-violet-300',
  cache: 'text-amber-300',
  router: 'text-emerald-300',
};

const STATUS_DOT = {
  novo: 'bg-slate-400',
  ativo: 'bg-emerald-400',
  upgrade: 'bg-amber-400',
  critico: 'bg-rose-400',
};

export default function DatabaseView() {
  const objetos = useGameStore((s) => s.objetos);
  const real = objetos.filter((o) => !String(o.id).startsWith('tmp-'));

  return (
    <div className="p-3 font-mono text-xs">
      <div className="flex items-center gap-2 mb-3 text-slate-400">
        <Database className="w-3.5 h-3.5" />
        <code className="text-slate-300">game_objects</code>
        <span className="text-slate-500">({real.length} rows)</span>
      </div>
      <div className="rounded-lg overflow-hidden border border-white/5">
        <table className="w-full text-[11px]">
          <thead className="bg-white/5 text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="text-left px-2 py-2">id</th>
              <th className="text-left px-2 py-2">tipo</th>
              <th className="text-left px-2 py-2">status</th>
              <th className="text-center px-2 py-2">x</th>
              <th className="text-center px-2 py-2">y</th>
            </tr>
          </thead>
          <motion.tbody layout>
            <AnimatePresence initial={false}>
              {real.length === 0 && (
                <motion.tr
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  layout
                >
                  <td colSpan={5} className="text-center text-slate-500 py-6">
                    (vazio — plante um objeto no jogo)
                  </td>
                </motion.tr>
              )}
              {real.map((o) => (
                <motion.tr
                  key={o.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8, backgroundColor: 'rgba(244,63,94,0.15)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  className="border-t border-white/5 hover:bg-white/[0.03]"
                >
                  <td className="px-2 py-1.5 text-slate-300">{o.id}</td>
                  <td className={`px-2 py-1.5 ${TIPO_COLOR[o.tipo] || 'text-slate-300'}`}>
                    {o.tipo}
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="inline-flex items-center gap-1.5 text-slate-300">
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[o.status] || 'bg-slate-500'}`} />
                      {o.status}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center text-slate-400">{o.pos_x}</td>
                  <td className="px-2 py-1.5 text-center text-slate-400">{o.pos_y}</td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </motion.tbody>
        </table>
      </div>
    </div>
  );
}
