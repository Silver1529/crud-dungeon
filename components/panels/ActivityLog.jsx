// components/panels/ActivityLog.jsx
'use client';
// EDUCATIONAL: Activity Log — feed cronológico de operações CRUD com cards
// coloridos por op, timestamp [hh:mm:ss], descrição PT-BR e ícone temático.
// Versão "simples e visual" — pra quem ainda não está confortável com SQL puro.
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useGameStore } from '@/lib/store';
import { Activity, Hammer, Wrench, Trash2, Search, RefreshCw } from 'lucide-react';
import { humanizeSql, SQL_KEYWORD_THEME } from '@/lib/game/sql';

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour12: false });
}

function firstKeyword(sql) {
  if (!sql) return 'SQL';
  const m = sql.match(/^[\s-]*(SELECT|INSERT|UPDATE|DELETE)/i);
  return m ? m[1].toUpperCase() : 'SQL';
}

const KW_ICON = {
  INSERT: Hammer,
  UPDATE: Wrench,
  DELETE: Trash2,
  SELECT: Search,
  SQL: Activity,
};

export default function ActivityLog() {
  const sqlLog = useGameStore((s) => s.sqlLog);
  const qc = useQueryClient();

  // EDUCATIONAL: dispara um SELECT * manual — re-busca a lista de objetos
  // do banco e empurra a query pro log. É o equivalente em UI ao "?" antigo.
  const onRefresh = () => {
    qc.invalidateQueries({ queryKey: ['objetos'] });
  };

  return (
    <div className="font-mono text-xs bg-gradient-to-b from-slate-950 to-slate-950/40 min-h-full">
      {/* Header estilo "Activity Log" do mockup */}
      <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2 sticky top-0 bg-slate-950 z-10">
        <Activity className="w-3.5 h-3.5 text-cyan-300" />
        <span className="text-cyan-200 font-mono text-[11px] tracking-wider">Activity Log</span>
        <button
          onClick={onRefresh}
          title="SELECT * FROM game_objects (re-fetch manual)"
          className="ml-1 p-1 rounded text-slate-400 hover:text-cyan-200 hover:bg-cyan-400/10 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
        <span className="ml-auto text-[10px] text-slate-500 font-mono flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          ao vivo
        </span>
      </div>

      <div className="p-2 space-y-1.5">
        {sqlLog.length === 0 && (
          <div className="text-center text-slate-500 py-12 text-[11px]">
            <Activity className="w-7 h-7 mx-auto mb-2 opacity-30" />
            sem ações ainda · construa sua primeira casa
          </div>
        )}
        <AnimatePresence initial={false}>
          {sqlLog.map((entry) => {
            const kw = firstKeyword(entry.sql);
            const theme = SQL_KEYWORD_THEME[kw] || SQL_KEYWORD_THEME.SQL;
            const Icon = KW_ICON[kw] || Activity;
            const ok = entry.status < 400;
            const human = humanizeSql(entry.sql);
            return (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, x: -10, scale: 0.97 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                className={`relative rounded-lg border ${theme.ring} bg-white/[0.025] overflow-hidden`}
              >
                {/* faixa lateral colorida — identidade da op */}
                <div className={`absolute top-0 bottom-0 left-0 w-1 ${theme.bg}`} />
                <div className="pl-3 pr-2 py-1.5 flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    {/* meta linha: [12:00:01] BUILD: ... */}
                    <div className="flex items-center gap-1.5 text-[10px] mb-0.5">
                      <code className="text-slate-500">[{fmtTime(entry.ts)}]</code>
                      <span className={`font-bold ${theme.fg}`}>{theme.label}:</span>
                      {!ok && (
                        <span className="text-rose-400 text-[9px] font-mono">
                          ERR · {entry.status}
                        </span>
                      )}
                      {ok && entry.affected != null && (
                        <span className="text-slate-500 text-[9px] ml-auto">
                          {entry.affected} row{entry.affected === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    {/* descrição em PT-BR — o que aconteceu, sem jargão */}
                    <p className="text-slate-200 text-[11px] leading-snug break-words">
                      {human}
                    </p>
                  </div>
                  {/* ícone à direita estilo "patente" */}
                  <div className={`shrink-0 w-7 h-7 rounded ${theme.bg} border ${theme.ring} flex items-center justify-center`}>
                    <Icon className={`w-3.5 h-3.5 ${theme.fg}`} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
