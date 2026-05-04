// components/CrudLivePanel.jsx
'use client';
// EDUCATIONAL: orquestra as 4 abas educacionais. Mostra contadores ao vivo nos badges.
import { Tabs } from './ui/Tabs';
import SqlConsole from './panels/SqlConsole';
import DatabaseView from './panels/DatabaseView';
import NetworkLog from './panels/NetworkLog';
import StatsCards from './panels/StatsCards';
import { useGameStore } from '@/lib/store';
import { Terminal, Database, Network, BarChart3 } from 'lucide-react';

export default function CrudLivePanel() {
  const sqlCount = useGameStore((s) => s.sqlLog.length);
  const netCount = useGameStore((s) => s.networkLog.length);
  const rows = useGameStore((s) => s.objetos.filter((o) => !String(o.id).startsWith('tmp-')).length);

  const tabs = [
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
      label: 'NETWORK',
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
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-950 to-slate-950/60">
      <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-mono text-[11px] uppercase tracking-widest text-slate-300">
          CRUD Live
        </span>
        <span className="text-[10px] text-slate-500 ml-auto font-mono">
          tempo real · {process.env.NODE_ENV === 'production' ? 'prod' : 'dev'}
        </span>
      </div>
      <Tabs tabs={tabs} defaultValue="sql" className="flex-1 min-h-0" />
    </div>
  );
}
