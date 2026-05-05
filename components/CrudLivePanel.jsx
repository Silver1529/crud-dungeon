// components/CrudLivePanel.jsx
'use client';
// EDUCATIONAL: painel flutuante (HUD overlay). Activity é a aba padrão (visual,
// PT-BR, fácil); SQL/DB/NETWORK são "advanced views" pra detalhe técnico.
// Colapsável: clicando no header, o painel encolhe pra um chip pequeno no canto.
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Tabs } from './ui/Tabs';
import ActivityLog from './panels/ActivityLog';
import SqlConsole from './panels/SqlConsole';
import DatabaseView from './panels/DatabaseView';
import NetworkLog from './panels/NetworkLog';
import StatsCards from './panels/StatsCards';
import { useGameStore } from '@/lib/store';
import { Activity, Terminal, Database, Network, BarChart3 } from 'lucide-react';

export default function CrudLivePanel() {
  const [collapsed, setCollapsed] = useState(false);
  const sqlCount = useGameStore((s) => s.sqlLog.length);
  const netCount = useGameStore((s) => s.networkLog.length);
  const rows = useGameStore((s) => s.objetos.filter((o) => !String(o.id).startsWith('tmp-')).length);

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
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="rounded-xl border border-white/10 bg-slate-950/80 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.55)] overflow-hidden"
    >
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full px-3 py-2 border-b border-white/5 flex items-center gap-2 hover:bg-white/[0.03] transition-colors"
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
  );
}
