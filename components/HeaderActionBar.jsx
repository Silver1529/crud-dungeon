// components/HeaderActionBar.jsx
'use client';
// EDUCATIONAL: barra de ações no header — 4 botões CRUD + seletor de tipo
// (só aparece quando BUILD está selecionado, pra não poluir).
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useGameStore } from '@/lib/store';
import { TOOL_META, TIPO_META, COLOR_MAP } from '@/lib/game/constants';

export default function HeaderActionBar() {
  const tool = useGameStore((s) => s.tool);
  const tipo = useGameStore((s) => s.tipo);
  const setTool = useGameStore((s) => s.setTool);
  const setTipo = useGameStore((s) => s.setTipo);
  const [tipoOpen, setTipoOpen] = useState(false);

  const tipoMeta = TIPO_META[tipo];
  const TipoIcon = tipoMeta.icon;

  return (
    <div className="flex items-center gap-1.5">
      {/* 4 action buttons no estilo [BUILD] / [UPGRADE] / [DELETE] / [INSPECT] */}
      <div className="flex items-center gap-1 glass rounded-lg p-1">
        {Object.keys(TOOL_META).map((id, i) => {
          const meta = TOOL_META[id];
          const Icon = meta.icon;
          const active = tool === id;
          const cm = COLOR_MAP[meta.color];
          const shortcut = i + 1;
          return (
            <motion.button
              key={id}
              onClick={() => setTool(id)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              title={`${meta.hint} · atalho: ${shortcut}`}
              className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 border font-mono text-[11px] transition-colors ${
                active
                  ? `${cm.ring} ${cm.bg} ${cm.fg} shadow-[0_0_18px_rgba(34,211,238,0.15)]`
                  : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-bold">[{meta.label}]</span>
              <kbd className={`hidden md:inline-block px-1 text-[9px] rounded ${active ? 'bg-white/10' : 'bg-white/5'} text-slate-400`}>
                {shortcut}
              </kbd>
            </motion.button>
          );
        })}
      </div>

      {/* TIPO selector — só relevante quando BUILD está ativo */}
      {tool === 'build' && (
        <div className="relative">
          <button
            onClick={() => setTipoOpen((v) => !v)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md glass border border-white/10 hover:border-white/30 font-mono text-[11px] text-slate-300"
            title={`Tipo da próxima casa: ${tipoMeta.label}`}
          >
            <TipoIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{tipo}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${tipoOpen ? 'rotate-180' : ''}`} />
          </button>
          {tipoOpen && (
            <div className="absolute right-0 top-full mt-1 z-30 glass rounded-md border border-white/10 p-1 min-w-[140px] shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
              {Object.keys(TIPO_META).map((id) => {
                const m = TIPO_META[id];
                const Icon = m.icon;
                const isActive = tipo === id;
                return (
                  <button
                    key={id}
                    onClick={() => { setTipo(id); setTipoOpen(false); }}
                    className={`w-full px-2 py-1.5 rounded flex items-center gap-2 font-mono text-[11px] transition-colors ${
                      isActive ? 'bg-cyan-400/10 text-cyan-200' : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {id}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
