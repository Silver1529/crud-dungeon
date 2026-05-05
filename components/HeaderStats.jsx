// components/HeaderStats.jsx
'use client';
// EDUCATIONAL: barra de stats no estilo "tactical HUD" — Latency / DB Load / Storage / Time / FPS.
// Cada métrica tem um significado real e ensina algo sobre observabilidade.
import { useEffect, useState } from 'react';
import { useGameStore } from '@/lib/store';
import { COLS, ROWS } from '@/lib/game/constants';

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function Stat({ label, value, hint, accent = 'text-slate-100' }) {
  return (
    <div title={hint} className="flex flex-col items-center justify-center px-2 min-w-[58px]">
      <div className="text-[8.5px] font-mono uppercase tracking-[0.18em] text-slate-500 leading-tight">
        {label}
      </div>
      <div className={`font-mono text-[12px] font-bold ${accent} leading-tight tabular-nums`}>
        {value}
      </div>
    </div>
  );
}

const MOUNT_TS = typeof performance !== 'undefined' ? performance.now() : 0;
const MAX_TILES = COLS * ROWS;

export default function HeaderStats() {
  const networkLog = useGameStore((s) => s.networkLog);
  const stats = useGameStore((s) => s.stats);
  const fps = useGameStore((s) => s.fps);
  const rows = useGameStore((s) =>
    s.objetos.filter((o) => !String(o.id).startsWith('tmp-')).length
  );

  // EDUCATIONAL: tempo desde o load (sobe a cada segundo). Reflete um "uptime" do tab.
  const [uptime, setUptime] = useState(0);
  useEffect(() => {
    const tid = setInterval(() => {
      setUptime(Math.floor((performance.now() - MOUNT_TS) / 1000));
    }, 1000);
    return () => clearInterval(tid);
  }, []);

  // EDUCATIONAL: latência média das últimas 10 requests reais.
  const recent = networkLog.slice(0, 10).filter((e) => e.ms != null);
  const avgMs = recent.length
    ? Math.round(recent.reduce((a, e) => a + (e.ms || 0), 0) / recent.length)
    : 0;
  const latencyAccent =
    avgMs === 0 ? 'text-slate-400' : avgMs < 80 ? 'text-emerald-300' : avgMs < 200 ? 'text-amber-300' : 'text-rose-300';

  // EDUCATIONAL: "DB Load" = % de erros nas requests recentes (proxy de saúde do backend).
  const total = stats.reads + stats.writes + stats.updates + stats.deletes + stats.errors;
  const loadPct = total === 0 ? 0 : Math.round((stats.errors / total) * 1000) / 10;
  const loadAccent = loadPct === 0 ? 'text-emerald-300' : loadPct < 5 ? 'text-amber-300' : 'text-rose-300';

  // EDUCATIONAL: "Storage" = quantas linhas existem no banco vs. máximo possível (300 tiles).
  const storagePct = Math.round((rows / MAX_TILES) * 100);

  const fpsAccent = fps >= 55 ? 'text-emerald-300' : fps >= 30 ? 'text-amber-300' : 'text-rose-300';

  return (
    <div className="flex items-center divide-x divide-white/5 glass rounded-lg py-1">
      <Stat
        label="Latency"
        value={`${avgMs}ms`}
        hint={`Latência média das últimas ${recent.length || 0} requests reais (round-trip browser↔AWS).`}
        accent={latencyAccent}
      />
      <Stat
        label="DB Load"
        value={`${loadPct}%`}
        hint="Proxy de saúde: % de requests que falharam no banco."
        accent={loadAccent}
      />
      <Stat
        label="Storage"
        value={`${rows}/${MAX_TILES}`}
        hint={`${rows} casa${rows === 1 ? '' : 's'} no banco · ${storagePct}% do mapa ocupado`}
        accent="text-cyan-300"
      />
      <Stat
        label="Time"
        value={fmtTime(uptime)}
        hint="Tempo desde que você abriu a aba."
        accent="text-slate-300"
      />
      <Stat
        label="FPS"
        value={fps}
        hint="Frames por segundo do canvas (kaplay)."
        accent={fpsAccent}
      />
    </div>
  );
}
