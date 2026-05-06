// components/CrudLivePanel.jsx
'use client';
// EDUCATIONAL: painel flutuante (HUD overlay), arrastável e colapsável.
//   Activity é a aba padrão (visual, PT-BR);
//   SQL/DB/NETWORK são "advanced views" pra detalhe técnico.
// Drag: handle de grip (esquerda do header) — segura e arrasta pra qualquer canto.
// Posição persistida em sessionStorage. Usamos useMotionValue (não animate)
// pra evitar spring-back: framer faz tween de volta ao `animate` após drag end,
// o que fazia o painel "voltar pro topo" toda vez que era movido.
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useDragControls, useMotionValue } from 'framer-motion';
import { ChevronDown, ChevronUp, GripVertical, Activity, Terminal, Database, Network, BarChart3 } from 'lucide-react';
import { Tabs } from './ui/Tabs';
import ActivityLog from './panels/ActivityLog';
import SqlConsole from './panels/SqlConsole';
import DatabaseView from './panels/DatabaseView';
import NetworkLog from './panels/NetworkLog';
import StatsCards from './panels/StatsCards';
import { useGameStore } from '@/lib/store';

const POS_KEY = 'crud_dungeon_panel_pos_v1';

export default function CrudLivePanel() {
  const [collapsed, setCollapsed] = useState(false);
  const dragControls = useDragControls();
  const constraintsRef = useRef(null);

  // Posição como motion values — não dispara re-render, evita spring-back.
  const mvX = useMotionValue(0);
  const mvY = useMotionValue(0);

  const sqlCount = useGameStore((s) => s.sqlLog.length);
  const netCount = useGameStore((s) => s.networkLog.length);
  const rows = useGameStore((s) => s.objetos.filter((o) => !String(o.id).startsWith('tmp-')).length);

  // Carrega posição salva (uma vez no mount).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(POS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          mvX.set(parsed.x);
          mvY.set(parsed.y);
        }
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDragEnd = () => {
    try {
      sessionStorage.setItem(POS_KEY, JSON.stringify({ x: mvX.get(), y: mvY.get() }));
    } catch { /* ignore */ }
  };

  const tabs = [
    {
      value: 'activity',
      label: 'ACTIVITY',
      icon: <Activity className="w-3.5 h-3.5" />,
      badge: sqlCount,
      content: <ActivityLog />,
    },
    {
      value: 'sql',
      label: 'SQL',
      icon: <Terminal className="w-3.5 h-3.5" />,
      badge: sqlCount,
      content: <SqlConsole />,
    },
    {
      value: 'db',
      label: 'DB',
      icon: <Database className="w-3.5 h-3.5" />,
      badge: rows,
      content: <DatabaseView />,
    },
    {
      value: 'net',
      label: 'NET',
      icon: <Network className="w-3.5 h-3.5" />,
      badge: netCount,
      content: <NetworkLog />,
    },
    {
      value: 'stats',
      label: 'STATS',
      icon: <BarChart3 className="w-3.5 h-3.5" />,
      content: <StatsCards />,
    },
  ];

  return (
    <>
      {/* área "viewport" — limita pra não sumir da tela. fixed inset-0 = janela inteira */}
      <div ref={constraintsRef} className="fixed inset-0 pointer-events-none" />

      <motion.div
        drag
        dragControls={dragControls}
        dragListener={false}     // só inicia via grip handle (onPointerDown abaixo)
        dragMomentum={false}
        dragConstraints={constraintsRef}
        dragElastic={0}
        onDragEnd={onDragEnd}
        style={{ x: mvX, y: mvY }} // motion values = fonte da verdade, sem animate brigar
        className="rounded-xl border border-white/10 bg-slate-950/95 shadow-[0_20px_60px_rgba(0,0,0,0.55)] overflow-hidden touch-none"
      >
        <div className="border-b border-white/5 flex items-stretch">
          {/* Grip — pega aqui pra arrastar */}
          <button
            onPointerDown={(e) => dragControls.start(e)}
            title="arraste pra mover"
            className="px-2 flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-200 hover:bg-white/[0.04] transition-colors"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>

          {/* Título + collapse toggle */}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="flex-1 px-2 py-2 flex items-center gap-2 hover:bg-white/[0.03] transition-colors"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-slate-300">
              CRUD Live
            </span>
            {collapsed && sqlCount > 0 && (
              <span className="font-mono text-[10px] text-slate-500 ml-2">
                {sqlCount} ação{sqlCount === 1 ? '' : 'es'}
              </span>
            )}
            <span className="ml-auto flex items-center gap-2">
              <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                {process.env.NODE_ENV === 'production' ? 'prod' : 'dev'}
              </span>
              {collapsed
                ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              }
            </span>
          </button>
        </div>

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="max-h-[70vh] flex flex-col">
                <Tabs tabs={tabs} defaultValue="activity" className="flex-1 min-h-0" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
