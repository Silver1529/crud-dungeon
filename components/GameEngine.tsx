// components/GameEngine.tsx
'use client';
// EDUCATIONAL: engine 2D real (Kaplay) com tema "Data Center" e camada didática.
// Para quem nunca mexeu em código: cada AÇÃO aqui dispara um SQL real no banco.
// Você vê o SQL antes (preview) e depois (no painel CRUD Live à direita).
import { Fragment, useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, BookOpen, ChevronRight, Keyboard, Search, MapPin, Hash, X } from 'lucide-react';
import { useGameStore } from '@/lib/store';
import {
  useObjetos,
  useCreateObjeto,
  useUpdateObjeto,
  useDeleteObjeto,
  useInspectObjeto,
} from '@/lib/queries';
import { notifyApi } from './ui/Toast';
import QuizModal from './QuizModal';
import {
  type Tipo, type Tool, type Status, type Direction, type Objeto, type FacingTile, type K,
  type Level, type PlayerCustom, type ShirtKey, type HatKey, type SkinKey,
  type TutStep, type ActiveTutStep,
  TILE, COLS, ROWS, W, H, SPAWN_X, SPAWN_Y, CAM_SCALE,
  TIPO_META, STATUS_META, LEVEL_META, TOOL_META, COLOR_MAP, PLAYER_PRESETS,
  USER_NAME_KEY, TUTORIAL_DONE_KEY, PLAYER_CUSTOM_KEY, QUIZ_DONE_KEY,
  clampLevel,
} from '@/lib/game/constants';
import { buildSqlPreview, highlightSql } from '@/lib/game/sql';
import { sfx } from '@/lib/game/sounds';

// ============================================================================
// Welcome flow + tutorial guiado
// ============================================================================
const CRUD_CARDS = [
  { letter: 'C', name: 'CREATE', verb: 'POST',   sql: 'INSERT INTO ...', color: 'emerald' as const, desc: 'Construir uma casa nova no mapa. Cada casa = uma linha nova na tabela.' },
  { letter: 'R', name: 'READ',   verb: 'GET',    sql: 'SELECT * FROM ...', color: 'cyan'    as const, desc: 'Ler dados. Use o "?" pra ver TODAS, ou INSPECT pra ver uma casa específica.' },
  { letter: 'U', name: 'UPDATE', verb: 'PUT',    sql: 'UPDATE ... SET ...', color: 'amber'   as const, desc: 'Evoluir a casa nível 1 → 2 → 3. Cada UPDATE deixa a casa mais bonita.' },
  { letter: 'D', name: 'DELETE', verb: 'DELETE', sql: 'DELETE FROM ...', color: 'rose'    as const, desc: 'Demolir a casa. Apaga PERMANENTE — a linha some do banco.' },
];

const TUTORIAL_STEPS: Record<ActiveTutStep, {
  num: number; total: number; title: string; body: (name: string) => string;
  color: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet';
}> = {
  move: {
    num: 1, total: 5, title: '1. Mover · achar o tile alvo', color: 'cyan',
    body: (n) =>
      `Olá, ${n}! Use as setas ↑↓←→ ou WASD pra andar. O quadradinho ` +
      `CYAN na sua frente é o "tile alvo" — toda ação vai rodar EM CIMA dele, ` +
      `nunca onde o boneco está parado. Anda um pouco pra liberar o próximo passo.`,
  },
  create: {
    num: 2, total: 5, title: '2. CREATE · construa uma casa (INSERT)', color: 'emerald',
    body: (n) =>
      `Beleza ${n}, agora aperta a tecla 1 (ou clica em [BUILD] no topo) e ` +
      `encara um quadrado VAZIO. Quando bater Espaço, roda este SQL real no MySQL:\n` +
      `   INSERT INTO game_objects (tipo, status, pos_x, pos_y, level)\n` +
      `   VALUES ('servidor', 'novo', X, Y, 1);\n` +
      `Isso cria UMA linha nova na tabela. O 'id' o banco gera sozinho (AUTO_INCREMENT). ` +
      `Sua primeira 🏠 casa nível 1 vai aparecer onde você apontou.`,
  },
  read: {
    num: 3, total: 5, title: '3. READ · inspecione a casa (SELECT WHERE)', color: 'cyan',
    body: (n) =>
      `Mandou bem ${n}! Agora aperta a tecla 4 (ou [INSPECT] no topo) e encara ` +
      `a sua casa. Espaço dispara este SQL:\n` +
      `   SELECT id, tipo, status, pos_x, pos_y, level\n` +
      `   FROM game_objects WHERE id = X;\n` +
      `O modal mostra a LINHA crua do banco — exatamente como ela está armazenada. ` +
      `READ-detalhe é o que acontece quando você clica num produto numa loja online.`,
  },
  update: {
    num: 4, total: 5, title: '4. UPDATE · evolua sua casa (UPDATE WHERE)', color: 'amber',
    body: (n) =>
      `Boa ${n}! Tecla 2 (ou [UPGRADE]), encara sua casa, Espaço. Roda:\n` +
      `   UPDATE game_objects SET level = level + 1\n` +
      `   WHERE id = X;\n` +
      `Sua 🏠 vira 🏡 e depois 🏛️ (cap nível 3). ATENÇÃO: o WHERE é o que ` +
      `protege — sem ele, esse SQL atualizaria TODAS as casas do banco. ` +
      `UPDATE sem WHERE = bug clássico que já demitiu gente.`,
  },
  delete: {
    num: 5, total: 5, title: '5. DELETE · demolir (DELETE WHERE)', color: 'rose',
    body: (n) =>
      `Reta final ${n}! Tecla 3 (ou [DELETE]), encara uma casa, Espaço:\n` +
      `   DELETE FROM game_objects WHERE id = X;\n` +
      `A casa SOME do banco — apagado é apagado, sem lixeira. Em produção ` +
      `isso é IRREVERSÍVEL: sempre confira o WHERE 2x antes. ` +
      `DELETE sem WHERE limparia a tabela inteira.`,
  },
  done: {
    num: 5, total: 5, title: '🎉 Mestre do CRUD', color: 'violet',
    body: (n) =>
      `Parabéns ${n}! Você rodou as 4 operações que TODO sistema com banco usa: ` +
      `CREATE, READ, UPDATE, DELETE — cada uma virou SQL real numa Aurora MySQL na AWS. ` +
      `Já já abre um quiz rapidinho pra fixar; depois é sandbox livre.`,
  },
};

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-block px-1.5 border border-slate-400/30 rounded bg-slate-400/10 text-slate-300 text-[10px] font-mono">
      {children}
    </kbd>
  );
}

function FlowNode({ emoji, label, sub, color }: { emoji: string; label: string; sub: string; color: 'cyan' | 'violet' | 'amber' }) {
  const cm = COLOR_MAP[color];
  return (
    <div className={`flex-1 flex flex-col items-center text-center px-2 py-2 rounded-lg border ${cm.ring} ${cm.bg}`}>
      <div className="text-2xl leading-none mb-1">{emoji}</div>
      <div className={`font-mono text-[11px] font-bold ${cm.fg}`}>{label}</div>
      <div className="text-[9px] font-mono text-slate-500">{sub}</div>
    </div>
  );
}

function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center text-slate-500 text-[8px] font-mono shrink-0 px-0.5">
      <div>{label}</div>
      <div className="text-cyan-400 text-base leading-none">→</div>
    </div>
  );
}

function ModalShell({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        className="glass rounded-2xl p-5 sm:p-6 max-w-xl w-full max-h-[90vh] overflow-auto shadow-[0_30px_120px_rgba(0,0,0,0.6)]"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function ColorPicker<K extends string>({
  label, options, value, onChange,
}: {
  label: string;
  options: { key: K; bg: string }[];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider w-12">{label}</span>
      <div className="flex gap-1.5 flex-wrap">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`w-6 h-6 rounded-md ${o.bg} transition-all border-2 ${value === o.key
              ? 'border-cyan-400 scale-110 shadow-[0_0_12px_rgba(34,211,238,0.5)]'
              : 'border-white/10 hover:border-white/30'
              }`}
            aria-label={`${label} ${o.key}`}
          />
        ))}
      </div>
    </div>
  );
}

function PlayerPreview({ custom }: { custom: PlayerCustom }) {
  // Preview SVG procedural (mesma silhueta do kaplay) com as cores escolhidas.
  const shirt = PLAYER_PRESETS.shirt[custom.shirt];
  const hat = PLAYER_PRESETS.hat[custom.hat];
  const skin = PLAYER_PRESETS.skin[custom.skin];
  const rgbStr = (c: readonly [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`;
  return (
    <svg viewBox="-20 -22 40 44" width="96" height="96" className="drop-shadow-[0_8px_24px_rgba(34,211,238,0.3)]">
      <ellipse cx="0" cy="14" rx="9" ry="2.5" fill="rgba(0,0,0,0.4)" />
      <rect x="-5" y="7" width="4" height="7" rx="1" fill="rgb(15,23,42)" />
      <rect x="1" y="7" width="4" height="7" rx="1" fill="rgb(15,23,42)" />
      <rect x="-7" y="-3" width="14" height="11" rx="2" fill={rgbStr(shirt.rgb)} />
      <rect x="-1" y="0" width="2" height="5" fill={rgbStr(shirt.accent)} opacity="0.85" />
      <rect x="-9" y="-2" width="3" height="8" rx="1" fill={rgbStr(shirt.rgb)} />
      <rect x="6" y="-2" width="3" height="8" rx="1" fill={rgbStr(shirt.rgb)} />
      <rect x="-5" y="-12" width="10" height="9" rx="2" fill={rgbStr(skin.rgb)} />
      <rect x="-3" y="-8" width="1.6" height="1.6" fill="rgb(15,23,42)" />
      <rect x="2" y="-8" width="1.6" height="1.6" fill="rgb(15,23,42)" />
      {hat.rgb && <>
        <rect x="-6" y="-16" width="12" height="5" rx="3" fill={rgbStr(hat.rgb)} />
        <rect x="-7" y="-12" width="14" height="1.5" fill={hat.shade ? rgbStr(hat.shade) : '#000'} />
        <rect x="-3" y="-15" width="3" height="1" fill="white" opacity="0.6" />
      </>}
    </svg>
  );
}

// EDUCATIONAL: cores de tipo em hex pra UI (espelha TIPO_META mas em formato CSS).
const TIPO_HEX: Record<Tipo, { hex: string; label: string }> = {
  servidor: { hex: '#22d3ee', label: 'cyan' },
  banco:    { hex: '#a78bfa', label: 'violet' },
  cache:    { hex: '#fbbf24', label: 'âmbar' },
  router:   { hex: '#10b981', label: 'emerald' },
};

const STATUS_HEX: Record<Status, { hex: string; label: string; meaning: string }> = {
  novo:    { hex: '#94a3b8', label: 'cinza',  meaning: 'recém-criada (level 1)' },
  ativo:   { hex: '#22c55e', label: 'verde',  meaning: 'evoluída (level 2)' },
  upgrade: { hex: '#eab308', label: 'âmbar',  meaning: 'avançada (level 3)' },
  critico: { hex: '#ef4444', label: 'rosa',   meaning: 'estado crítico (raro)' },
};

// EDUCATIONAL: modal exibido após INSPECT (GET /api/objetos/:id).
// Layout: hero com progression bar de níveis + legenda de cores + tabela + SQL anotado.
function InspectModal({ data, onClose }: { data: Objeto; onClose: () => void }) {
  const lvl = clampLevel(data.level);
  const lm = LEVEL_META[lvl];
  const tipoMeta = TIPO_META[data.tipo];
  const TipoIcon = tipoMeta.icon;
  const tipoH = TIPO_HEX[data.tipo];
  const statusH = STATUS_HEX[data.status] ?? STATUS_HEX.novo;

  return (
    <ModalShell>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-cyan-400/15 border border-cyan-400/40 flex items-center justify-center shrink-0">
          <Search className="w-4 h-4 text-cyan-300" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-mono text-base text-cyan-200">INSPECT · casa #{data.id}</h2>
          <p className="text-[11px] text-slate-400 font-mono leading-tight">
            <code className="text-violet-300">SELECT</code> ... <code className="text-violet-300">WHERE</code> id = {data.id} · 1 linha lida
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-200 p-1 rounded shrink-0"
          aria-label="fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* HERO — sprite grande + level + progression bar */}
      <div
        className="relative rounded-xl border p-4 mb-4 overflow-hidden"
        style={{
          borderColor: `${tipoH.hex}33`,
          background: `linear-gradient(135deg, ${tipoH.hex}10, ${statusH.hex}08)`,
        }}
      >
        <div
          className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ backgroundColor: tipoH.hex }}
        />
        <div className="relative flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lm.sprite}
            alt={`Casa nível ${lvl}`}
            width={80}
            height={80}
            className="rounded-lg shrink-0"
            style={{ imageRendering: 'pixelated', filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.5))' }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-2xl">{lm.emoji}</span>
              <span className="font-mono text-base text-slate-100">casa nível {lvl}</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              {lm.label} · {lvl} de 3 evoluções
            </p>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] font-mono">
              <span style={{ color: tipoH.hex }} className="inline-flex">
                <TipoIcon className="w-3.5 h-3.5" />
              </span>
              <span style={{ color: tipoH.hex }}>{data.tipo}</span>
              <span className="text-slate-600">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusH.hex }} />
                <span style={{ color: statusH.hex }}>{data.status}</span>
              </span>
            </div>
          </div>
        </div>

        {/* PROGRESSION BAR — 3 sprites em sequência com a atual destacada */}
        <div className="relative mt-4 pt-3 border-t border-white/5">
          <div className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.18em] mb-2">
            evolução
          </div>
          <div className="flex items-center gap-2">
            {([1, 2, 3] as const).map((L, i) => {
              const lm2 = LEVEL_META[L];
              const isCurrent = L === lvl;
              const isPast = L < lvl;
              return (
                <Fragment key={L}>
                  <div
                    className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg border transition-all ${
                      isCurrent
                        ? 'border-cyan-400/60 bg-cyan-400/10 shadow-[0_0_20px_rgba(34,211,238,0.25)] scale-105'
                        : isPast
                        ? 'border-emerald-400/30 bg-emerald-400/5'
                        : 'border-white/5 bg-white/[0.02] opacity-45'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={lm2.sprite}
                      alt={`nv${L}`}
                      width={28}
                      height={28}
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <div className="text-[9px] font-mono text-slate-300 leading-none">
                      nv{L}
                    </div>
                  </div>
                  {i < 2 && (
                    <div className={`text-base ${L < lvl ? 'text-emerald-400' : 'text-slate-600'}`}>→</div>
                  )}
                </Fragment>
              );
            })}
            <div className="ml-auto text-[10px] font-mono text-slate-500 leading-tight text-right">
              {lvl < 3
                ? `${3 - lvl} UPDATE${3 - lvl === 1 ? '' : 's'}\nrestante${3 - lvl === 1 ? '' : 's'}`
                : 'nível MÁXIMO'}
            </div>
          </div>
        </div>
      </div>

      {/* COLOR LEGEND — explica o que cada cor significa nessa casa */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tipoH.hex }} />
            cor por tipo
          </div>
          <div className="text-[11px] font-mono text-slate-200">
            <span style={{ color: tipoH.hex }}>{data.tipo}</span> = {tipoH.label}
          </div>
          <div className="text-[10px] text-slate-500 leading-snug mt-0.5">
            os 4 tipos: servidor·cyan, banco·violet, cache·âmbar, router·emerald
          </div>
        </div>
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusH.hex }} />
            cor por status
          </div>
          <div className="text-[11px] font-mono text-slate-200">
            <span style={{ color: statusH.hex }}>{data.status}</span> = {statusH.label}
          </div>
          <div className="text-[10px] text-slate-500 leading-snug mt-0.5">
            {statusH.meaning}
          </div>
        </div>
      </div>

      {/* DATA TABLE — campos com explicação curta de cada um */}
      <div className="rounded-lg border border-white/5 bg-white/[0.02] overflow-hidden mb-4">
        <div className="px-3 py-1.5 bg-white/[0.03] border-b border-white/5 text-[10px] font-mono text-slate-400">
          <code className="text-violet-200 font-bold">cruddungeon</code>
          <span className="text-slate-500">.</span>
          <code className="text-cyan-300 font-bold">game_objects</code>
          <span className="ml-2 text-slate-500">· 1 linha · 6 colunas</span>
        </div>
        <div className="divide-y divide-white/[0.04]">
          <InspectField icon={<Hash className="w-3 h-3" />} label="id" value={String(data.id)} hint="AUTO_INCREMENT — o banco gera, nunca reusa" />
          <InspectField label="tipo" value={data.tipo} hint="categoria visual (cor do badge)" valueColor={tipoH.hex} />
          <InspectField label="status" value={data.status} hint="estado lógico (dot colorido)" valueColor={statusH.hex} />
          <InspectField label="level" value={`${lvl} / 3`} hint="quantos UPDATEs já rodaram nessa linha" valueColor="#22d3ee" />
          <InspectField icon={<MapPin className="w-3 h-3" />} label="pos" value={`(${data.pos_x}, ${data.pos_y})`} hint="coordenadas no grid 28×20" />
        </div>
      </div>

      {/* SQL ANOTADO — cada linha com comentário explicativo */}
      <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 overflow-hidden mb-4">
        <div className="px-3 py-1.5 bg-cyan-400/10 border-b border-cyan-400/20 text-[10px] font-mono text-cyan-200 uppercase tracking-wider flex items-center gap-2">
          <Search className="w-3 h-3" />
          SQL executado · anotado
        </div>
        <div className="px-3 py-2 text-[11px] font-mono space-y-1">
          <div className="flex items-baseline gap-3">
            <code className="text-slate-200 flex-1"><span className="text-violet-300 font-bold">SELECT</span> id, tipo, status, pos_x, pos_y, level</code>
            <span className="text-[9px] text-slate-500 italic shrink-0">// 6 colunas escolhidas</span>
          </div>
          <div className="flex items-baseline gap-3">
            <code className="text-slate-200 flex-1"><span className="text-violet-300 font-bold">FROM</span> game_objects</code>
            <span className="text-[9px] text-slate-500 italic shrink-0">// tabela alvo</span>
          </div>
          <div className="flex items-baseline gap-3">
            <code className="text-slate-200 flex-1"><span className="text-violet-300 font-bold">WHERE</span> id = <span className="text-cyan-300">{data.id}</span>;</code>
            <span className="text-[9px] text-slate-500 italic shrink-0">// filtro pelo PK</span>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
        <strong className="text-cyan-200">READ-detalhe</strong> é o GET mais comum em apps reais — buscar UMA linha
        pelo id, sem trazer a tabela inteira. É o que acontece quando você clica num produto e a página carrega só ele.
        Sem o <code className="text-violet-300">WHERE</code>, viria a tabela TODA — devastador em prod.
      </p>

      <button
        onClick={onClose}
        className="w-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/30 transition-colors rounded-lg py-2.5 font-mono text-sm flex items-center justify-center gap-2"
      >
        fechar
      </button>
    </ModalShell>
  );
}

// EDUCATIONAL: linha de dado com label + valor + hint educacional. Reuso interno do InspectModal.
function InspectField({
  icon, label, value, hint, valueColor,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  valueColor?: string;
}) {
  return (
    <div className="px-3 py-2 grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] gap-2 items-baseline text-[11px] font-mono">
      <div className="flex items-center gap-1.5 text-slate-500 shrink-0">
        {icon}
        <span>{label}</span>
      </div>
      <div className="min-w-0">
        <div className="text-slate-100 font-bold" style={valueColor ? { color: valueColor } : undefined}>
          {value}
        </div>
        <div className="text-[10px] text-slate-500 leading-snug mt-0.5">{hint}</div>
      </div>
    </div>
  );
}

// EDUCATIONAL: portrait SVG do NPC — espelha o sprite procedural do canvas
// (corpo + cabeça + chapéu opcional), só que pixel-perfeito em SVG pro modal.
function NpcPortrait({
  shirt, hat, size = 96,
}: {
  shirt: [number, number, number];
  hat: [number, number, number] | null;
  size?: number;
}) {
  const rgbStr = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`;
  return (
    <svg viewBox="-15 -20 30 38" width={size} height={size}>
      {/* sombra */}
      <ellipse cx="0" cy="14" rx="7" ry="2" fill="rgba(0,0,0,0.45)" />
      {/* pernas */}
      <rect x="-4" y="6" width="3" height="6" rx="1" fill="rgb(15,23,42)" />
      <rect x="1" y="6" width="3" height="6" rx="1" fill="rgb(15,23,42)" />
      {/* corpo */}
      <rect x="-6" y="-2" width="12" height="9" rx="2" fill={rgbStr(shirt)} />
      {/* cabeça */}
      <rect x="-4" y="-10" width="8" height="7" rx="1.5" fill="rgb(252,211,170)" />
      {/* olhos */}
      <rect x="-3" y="-8" width="1.4" height="0.8" fill="rgb(15,23,42)" />
      <rect x="2" y="-8" width="1.4" height="0.8" fill="rgb(15,23,42)" />
      {/* chapéu opcional */}
      {hat && <rect x="-5" y="-13" width="10" height="4" rx="2" fill={rgbStr(hat)} />}
    </svg>
  );
}

const NPC_ROLE_DESC: Record<string, { tagline: string; theme: 'cyan' | 'violet' | 'amber' | 'rose' | 'emerald' }> = {
  'DBA': { tagline: 'Database Administrator — schemas, índices, queries pesadas', theme: 'violet' },
  'SecOps': { tagline: 'Security Ops — defende contra injection, leaks, brute-force', theme: 'rose' },
  'Cloud': { tagline: 'Cloud Engineer — AWS, RDS, deploy, escalabilidade', theme: 'cyan' },
  'Engineer': { tagline: 'Software Engineer — escreve o código que vira CRUD', theme: 'amber' },
  'Backend': { tagline: 'Backend Dev — APIs HTTP, lógica de negócio, validação', theme: 'emerald' },
  'Architect': { tagline: 'System Architect — desenha como o sistema escala', theme: 'violet' },
  'SQL Wizard': { tagline: 'SQL Specialist — sabe cada canto obscuro do SELECT', theme: 'amber' },
  'DevOps': { tagline: 'DevOps Engineer — pipelines, monitoring, deploys', theme: 'cyan' },
};

// EDUCATIONAL: hook de tipografia animada (typewriter). Char-by-char, com skip.
// Reseta automaticamente quando o `text` muda (ex: usuário clica "próxima dica").
function useTypewriter(text: string, speed = 9) {
  const [shown, setShown] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setShown('');
    setDone(false);
    if (!text) {
      setDone(true);
      return;
    }
    // Typewriter usa rAF (não setInterval): browsers throttlam setInterval quando
    // a main thread tá ocupada (ex: kaplay rodando em 28fps), e cada tick disparava
    // um re-render React que competia com o canvas. rAF roda no MESMO tick do
    // frame, e rendemos múltiplos chars por frame se o tempo permitir — assim a
    // velocidade percebida não cai com o FPS.
    let i = 0;
    let last = performance.now();
    let rafId = 0;
    const tick = (now: number) => {
      const elapsed = now - last;
      // Quantos chars cabem no frame atual (ex: 16ms / 9ms = 1-2 chars).
      const stepChars = Math.max(1, Math.floor(elapsed / speed));
      if (stepChars > 0) {
        i = Math.min(text.length, i + stepChars);
        setShown(text.slice(0, i));
        last = now;
      }
      if (i < text.length) {
        rafId = requestAnimationFrame(tick);
      } else {
        setDone(true);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [text, speed]);

  const skip = useCallback(() => {
    setShown(text);
    setDone(true);
  }, [text]);

  return { shown, done, skip };
}

// EDUCATIONAL: modal aberto quando jogador faz INSPECT (atalho 4) num NPC,
// ou tenta BUILD em cima de um. Mostra portrait + role + curiosidade rotativa
// com animação de tipografia (estilo "diálogo de RPG") e detalhe expandido.
function NpcModal({ data, onClose }: { data: NpcPreset; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const total = data.curiosities.length;
  const cur = data.curiosities[idx];
  const meta = NPC_ROLE_DESC[data.role] || { tagline: '', theme: 'cyan' as const };
  const cm = COLOR_MAP[meta.theme];
  const { shown: shownShort, done: doneShort, skip } = useTypewriter(cur.short, 9);

  const next = () => setIdx((i) => (i + 1) % total);
  const prev = () => setIdx((i) => (i - 1 + total) % total);

  return (
    <ModalShell>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-9 h-9 rounded-lg ${cm.bg} ${cm.ring} border ${cm.fg} flex items-center justify-center font-mono font-bold`}>
          NPC
        </div>
        <div className="min-w-0 flex-1">
          <h2 className={`font-mono text-base ${cm.fg} truncate`}>{data.role}</h2>
          <p className="text-[11px] text-slate-400 font-mono leading-tight">{meta.tagline}</p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-200 p-1 rounded shrink-0"
          aria-label="fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Portrait + dialog box estilo RPG */}
      <div className={`rounded-xl border ${cm.ring} bg-gradient-to-br from-slate-950/80 to-slate-900/40 p-4 mb-3 flex items-start gap-4`}>
        <div className={`shrink-0 rounded-lg ${cm.bg} p-2 shadow-[0_0_30px_rgba(34,211,238,0.15)]`}>
          <NpcPortrait shirt={data.shirt} hat={data.hat} size={88} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
            <span className={`w-1.5 h-1.5 rounded-full ${cm.bg.replace('/10', '/80')} animate-pulse`} />
            falando agora · {idx + 1}/{total}
          </div>
          {/* Caixa de diálogo com tipografia animada — clique pra skip pro fim */}
          <div
            onClick={!doneShort ? skip : undefined}
            className={`text-slate-100 text-sm leading-relaxed font-mono ${!doneShort ? 'cursor-pointer' : ''}`}
            title={!doneShort ? 'clique pra revelar tudo' : ''}
          >
            {shownShort}
            {!doneShort && (
              <span className={`inline-block w-1.5 h-3.5 ml-0.5 align-middle ${cm.bg.replace('/10', '/70')} animate-pulse`} />
            )}
          </div>
        </div>
      </div>

      {/* Detalhe — só aparece após terminar de digitar a frase curta. Fade-in suave. */}
      <motion.div
        initial={false}
        animate={{ opacity: doneShort ? 1 : 0, height: doneShort ? 'auto' : 0 }}
        transition={{ duration: 0.25 }}
        className="overflow-hidden mb-3"
      >
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">
            entender melhor
          </div>
          <p className="text-[12px] text-slate-300 leading-relaxed">
            {cur.detail}
          </p>
        </div>
      </motion.div>

      {/* Outras dicas que esse NPC sabe — clica pra pular */}
      <div className="mb-4">
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">
          outras dicas de {data.role.toLowerCase()}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {data.curiosities.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`text-[10px] font-mono w-7 h-7 rounded border transition-colors ${
                i === idx
                  ? `${cm.ring} ${cm.bg} ${cm.fg}`
                  : 'border-white/10 bg-white/[0.03] text-slate-500 hover:text-slate-200 hover:border-white/30'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={prev}
          className="px-3 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] font-mono text-xs"
        >
          ← anterior
        </button>
        <button
          onClick={next}
          className={`flex-1 px-3 py-2 rounded-lg border ${cm.ring} ${cm.bg} ${cm.fg} hover:bg-white/[0.06] font-mono text-xs flex items-center justify-center gap-2`}
        >
          próxima dica →
        </button>
        <button
          onClick={onClose}
          className="px-3 py-2 rounded-lg text-slate-400 hover:text-slate-200 font-mono text-xs"
        >
          fechar
        </button>
      </div>
    </ModalShell>
  );
}

// EDUCATIONAL: PropModal — modal pra itens decorativos do mapa (árvore, café, estante,
// servidor, papagaio, fonte). Estrutura igual ao NpcModal mas portrait é o emoji do prop
// num círculo grande, sem precisar de SVG procedural.
function PropModal({ data, onClose }: { data: PropPreset; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const total = data.curiosities.length;
  const cur = data.curiosities[idx];
  const cm = COLOR_MAP[data.theme];
  const { shown: shownShort, done: doneShort, skip } = useTypewriter(cur.short, 9);

  const next = () => setIdx((i) => (i + 1) % total);
  const prev = () => setIdx((i) => (i - 1 + total) % total);

  return (
    <ModalShell>
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`w-9 h-9 rounded-lg ${cm.bg} ${cm.ring} border ${cm.fg} flex items-center justify-center font-mono font-bold text-base`}
        >
          {data.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className={`font-mono text-base ${cm.fg} truncate`}>{data.role}</h2>
          <p className="text-[11px] text-slate-400 font-mono leading-tight">
            item interativo do mapa · INSPECT pra ler curiosidades
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-200 p-1 rounded shrink-0"
          aria-label="fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Hero card com emoji grande + dialog com typewriter */}
      <div className={`rounded-xl border ${cm.ring} bg-gradient-to-br from-slate-950/80 to-slate-900/40 p-4 mb-3 flex items-start gap-4`}>
        <div
          className={`shrink-0 rounded-lg ${cm.bg} flex items-center justify-center text-5xl shadow-[0_0_30px_rgba(34,211,238,0.15)]`}
          style={{ width: 88, height: 88 }}
        >
          {data.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
            <span className={`w-1.5 h-1.5 rounded-full ${cm.bg.replace('/10', '/80')} animate-pulse`} />
            curiosidade · {idx + 1}/{total}
          </div>
          <div
            onClick={!doneShort ? skip : undefined}
            className={`text-slate-100 text-sm leading-relaxed font-mono ${!doneShort ? 'cursor-pointer' : ''}`}
            title={!doneShort ? 'clique pra revelar tudo' : ''}
          >
            {shownShort}
            {!doneShort && (
              <span className={`inline-block w-1.5 h-3.5 ml-0.5 align-middle ${cm.bg.replace('/10', '/70')} animate-pulse`} />
            )}
          </div>
        </div>
      </div>

      {/* Detalhe — fade-in suave após terminar de digitar a frase curta */}
      <motion.div
        initial={false}
        animate={{ opacity: doneShort ? 1 : 0, height: doneShort ? 'auto' : 0 }}
        transition={{ duration: 0.25 }}
        className="overflow-hidden mb-3"
      >
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">
            entender melhor
          </div>
          <p className="text-[12px] text-slate-300 leading-relaxed">
            {cur.detail}
          </p>
        </div>
      </motion.div>

      {/* Pagination dots */}
      <div className="mb-4">
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">
          mais sobre {data.role.toLowerCase()}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {data.curiosities.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`text-[10px] font-mono w-7 h-7 rounded border transition-colors ${
                i === idx
                  ? `${cm.ring} ${cm.bg} ${cm.fg}`
                  : 'border-white/10 bg-white/[0.03] text-slate-500 hover:text-slate-200 hover:border-white/30'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={prev}
          className="px-3 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] font-mono text-xs"
        >
          ← anterior
        </button>
        <button
          onClick={next}
          className={`flex-1 px-3 py-2 rounded-lg border ${cm.ring} ${cm.bg} ${cm.fg} hover:bg-white/[0.06] font-mono text-xs flex items-center justify-center gap-2`}
        >
          próxima →
        </button>
        <button
          onClick={onClose}
          className="px-3 py-2 rounded-lg text-slate-400 hover:text-slate-200 font-mono text-xs"
        >
          fechar
        </button>
      </div>
    </ModalShell>
  );
}

function NameStep({
  onSubmit, onSkip,
}: {
  onSubmit: (name: string, custom: PlayerCustom) => void;
  onSkip: () => void;
}) {
  const [value, setValue] = useState('');
  const [custom, setCustom] = useState<PlayerCustom>({ shirt: 'teal', hat: 'cyan', skin: 'tan' });
  const trimmed = value.replace(/[<>]/g, '').trim().slice(0, 20);
  return (
    <ModalShell>
      <div className="flex flex-col items-center text-center mb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="CRUD Dungeon"
          width={180}
          height={180}
          className="rounded-2xl mb-3 shadow-[0_0_60px_rgba(34,211,238,0.4)] ring-2 ring-cyan-400/30 object-contain bg-slate-950/40"
        />
        <div className="flex items-center gap-3 -mt-2">
          <PlayerPreview custom={custom} />
          <div className="text-left">
            <h2 className="font-mono text-xl text-cyan-300 flex items-center gap-2">
              <Sparkles className="w-5 h-5" /> Personalize seu herói
            </h2>
            <p className="text-[11px] text-slate-400 font-mono mt-1">customize as cores ↓</p>
          </div>
        </div>
      </div>
      <p className="text-slate-300 text-sm leading-relaxed mb-4 text-center">
        Escolhe um nome e o visual do seu personagem. Vou te guiar pelas 4 operações de CRUD, uma por vez.
      </p>

      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 mb-3 space-y-2">
        <ColorPicker
          label="camisa"
          value={custom.shirt}
          options={(Object.keys(PLAYER_PRESETS.shirt) as ShirtKey[]).map((k) => ({ key: k, bg: PLAYER_PRESETS.shirt[k].bg }))}
          onChange={(k) => setCustom((c) => ({ ...c, shirt: k }))}
        />
        <ColorPicker
          label="capacete"
          value={custom.hat}
          options={(Object.keys(PLAYER_PRESETS.hat) as HatKey[]).map((k) => ({ key: k, bg: PLAYER_PRESETS.hat[k].bg }))}
          onChange={(k) => setCustom((c) => ({ ...c, hat: k }))}
        />
        <ColorPicker
          label="pele"
          value={custom.skin}
          options={(Object.keys(PLAYER_PRESETS.skin) as SkinKey[]).map((k) => ({ key: k, bg: PLAYER_PRESETS.skin[k].bg }))}
          onChange={(k) => setCustom((c) => ({ ...c, skin: k }))}
        />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (trimmed) onSubmit(trimmed, custom); }}>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={20}
          placeholder="Seu primeiro nome"
          className="w-full bg-slate-950/60 border border-cyan-400/30 rounded-lg px-3 py-2.5 text-slate-100 font-mono focus:outline-none focus:border-cyan-400 mb-2"
        />
        <p className="text-[10px] font-mono text-slate-500 mb-4">salvo só no seu navegador (localStorage), não vai pro servidor</p>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!trimmed}
            className="flex-1 bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/30 transition-colors rounded-lg py-2.5 font-mono text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" /> Continuar
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="px-4 text-slate-400 hover:text-slate-200 font-mono text-xs"
          >
            pular tudo
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function IntroStep({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <ModalShell>
      <div className="flex items-center gap-3 mb-3">
        <BookOpen className="w-5 h-5 text-cyan-300" />
        <h2 className="font-mono text-lg text-cyan-300">Olá, {name}! 👋</h2>
      </div>
      <p className="text-slate-300 text-sm leading-relaxed mb-4">
        <strong>CRUD</strong> são as 4 operações que <em>todo</em> banco de dados sabe fazer.
        Cada ação que você fizer aqui dispara um SQL <strong>de verdade</strong>.
      </p>

      {/* EDUCATIONAL: diagrama de fluxo AWS — explicação visual de "onde está o banco". */}
      <div className="rounded-xl border border-white/5 bg-gradient-to-br from-cyan-500/5 to-violet-500/5 p-3 mb-5">
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2">
          Como funciona
        </div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <FlowNode emoji="🧑" label="Você" sub="browser" color="cyan" />
          <FlowArrow label="HTTP" />
          <FlowNode emoji="⚡" label="Next.js" sub="este app" color="violet" />
          <FlowArrow label="SQL" />
          <FlowNode emoji="☁️" label="AWS" sub="banco MySQL" color="amber" />
        </div>
        <p className="text-[11px] text-slate-300 leading-relaxed">
          <strong className="text-amber-300">AWS</strong> = <strong>Amazon Web Services</strong>. É um aluguel de
          computadores na nuvem. Esse banco está num servidor da Amazon nos <strong>EUA</strong> 🇺🇸 — toda vez que você
          aperta Espaço, sua linha viaja até lá e volta.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {CRUD_CARDS.map((c) => {
          const cm = COLOR_MAP[c.color];
          return (
            <div key={c.letter} className={`relative rounded-xl border ${cm.ring} ${cm.bg} p-3`}>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center font-mono font-bold text-lg ${cm.fg}`}>{c.letter}</div>
                <div>
                  <div className={`font-mono text-sm ${cm.fg}`}>{c.name}</div>
                  <div className="text-[10px] font-mono text-slate-500">{c.verb} · {c.sql}</div>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{c.desc}</p>
            </div>
          );
        })}
      </div>
      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Keyboard className="w-4 h-4 text-slate-400" />
          <span className="font-mono text-xs uppercase tracking-wider text-slate-300">Controles</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
          <div><Kbd>W</Kbd> <Kbd>A</Kbd> <Kbd>S</Kbd> <Kbd>D</Kbd> ou <Kbd>↑↓←→</Kbd> mover</div>
          <div><Kbd>Espaço</Kbd> ou <Kbd>Enter</Kbd> agir</div>
        </div>
      </div>
      <button
        onClick={onClose}
        className="w-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/30 transition-colors rounded-lg py-2.5 font-mono text-sm flex items-center justify-center gap-2"
      >
        <Sparkles className="w-4 h-4" /> Vamos lá, {name}!
      </button>
    </ModalShell>
  );
}

function TutorialBanner({
  name, step, onSkip, onClose,
}: {
  name: string;
  step: ActiveTutStep;
  onSkip: () => void;
  onClose: () => void;
}) {
  const info = TUTORIAL_STEPS[step];
  const cm = COLOR_MAP[info.color];
  const [collapsed, setCollapsed] = useState(false);
  const stepIdx = info.num - 1;
  const total = info.total;
  const isDone = step === 'done';
  // EDUCATIONAL: progresso real — dones contam como total.
  const progress = isDone ? 1 : stepIdx / total;

  return (
    <motion.div
      key={step}
      layout
      initial={{ y: -16, opacity: 0, scale: 0.96 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -16, opacity: 0, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className={`max-w-2xl mx-auto rounded-xl border ${cm.ring} bg-slate-950/95 shadow-[0_16px_50px_rgba(0,0,0,0.5)] overflow-hidden`}
    >
      {/* progress bar — preenche conforme avança nos steps */}
      <div className="h-0.5 bg-white/5 relative">
        <motion.div
          className={`h-full ${cm.bg.replace('/10', '/60')}`}
          initial={false}
          animate={{ width: `${progress * 100}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 30 }}
        />
      </div>

      <div className="px-3 py-2 flex items-start gap-3">
        {/* "número grande" + dots */}
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <div
            className={`w-9 h-9 rounded-lg ${cm.bg} ${cm.ring} border ${cm.fg} flex items-center justify-center font-mono font-bold text-base shadow-[0_0_18px_rgba(34,211,238,0.18)]`}
          >
            {isDone ? '✓' : info.num}
          </div>
          <div className="flex gap-0.5">
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className={`w-1 h-1 rounded-full transition-colors ${
                  isDone || i < stepIdx ? cm.bg.replace('/10', '/80') : i === stepIdx ? cm.fg.replace('text-', 'bg-') : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <div className={`font-mono text-[10px] ${cm.fg} uppercase tracking-[0.18em] truncate font-bold`}>
              {info.title}
            </div>
            <span className="text-[9px] font-mono text-slate-500 ml-auto shrink-0">
              {isDone ? 'concluído' : `${info.num} / ${total}`}
            </span>
          </div>
          {!collapsed && (
            // EDUCATIONAL: split em linhas — linhas que começam com 3+ espaços viram code block.
            // Isso permite copy didático com SQL embutido sem MD parser.
            <div className="text-[12px] text-slate-200 leading-relaxed space-y-1">
              {info.body(name).split('\n').map((line, i) => {
                const isCode = /^\s{3,}/.test(line);
                return isCode ? (
                  <code
                    key={i}
                    className="block font-mono text-[11px] text-cyan-200 bg-cyan-400/10 border-l-2 border-cyan-400/40 pl-2 py-0.5 rounded-r"
                  >
                    {line.replace(/^\s{3,}/, '')}
                  </code>
                ) : (
                  <p key={i}>{line}</p>
                );
              })}
            </div>
          )}
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              className="text-[10px] font-mono text-slate-500 hover:text-slate-200"
            >
              ler dica →
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="text-[9px] font-mono text-slate-500 hover:text-slate-200 px-1.5 py-0.5 rounded hover:bg-white/5"
            title={collapsed ? 'expandir' : 'minimizar'}
          >
            {collapsed ? '▼' : '▲'}
          </button>
          {isDone ? (
            <button
              onClick={onClose}
              className={`text-[10px] font-mono ${cm.fg} px-2 py-1 hover:bg-white/5 rounded`}
            >
              fechar
            </button>
          ) : (
            <button
              onClick={onSkip}
              className="text-[9px] font-mono text-slate-500 hover:text-slate-300 px-2 py-0.5"
              title="Pular tutorial"
            >
              pular
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// SQL preview bar — sempre visível, mostra o que vai rodar se você apertar Espaço
// (highlightSql está em lib/game/sql.tsx)
// ============================================================================

interface SqlPreviewBarProps {
  tool: Tool;
  tipo: Tipo;
  facing: FacingTile;
  target: Objeto | null;
}

function SqlPreviewBar({ tool, tipo, facing, target }: SqlPreviewBarProps) {
  // EDUCATIONAL: holograma "in-world" sobre o canvas — estilo do mockup tactical.
  // Mostra a próxima ação E o SQL que vai rodar, antes de você apertar Espaço.
  const meta = {
    verb: TOOL_META[tool].verb,
    color: TOOL_META[tool].color,
    label: TOOL_META[tool].label,
    shortLetter: TOOL_META[tool].label.charAt(0),
  };
  const cm = COLOR_MAP[meta.color];
  const sql = buildSqlPreview(tool, tipo, facing.x, facing.y, target);
  const nodeRef = target?.id ? `Node ${target.id}` : `Tile (${facing.x}, ${facing.y})`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className={`relative font-mono text-[11px] rounded-lg border ${cm.ring} bg-slate-950/95 shadow-[0_0_30px_rgba(34,211,238,0.15)] overflow-hidden`}
    >
      {/* faixa lateral colorida — identidade visual da operação */}
      <div className={`absolute top-0 bottom-0 left-0 w-1 ${cm.bg}`} />

      <div className="px-3 py-2 pl-4">
        {/* linha 1: ACTION VISUALIZATION */}
        <div className={`text-[9px] uppercase tracking-[0.18em] ${cm.fg} opacity-70 mb-1`}>
          &gt; ACTION VISUALIZATION REQUEST
        </div>
        {/* linha 2: ACTION + node + tile */}
        <div className={`flex flex-wrap items-center gap-1.5 mb-1`}>
          <span className={`text-[10px] ${cm.fg}`}>&gt; ACTION:</span>
          <span className={`px-1 rounded border ${cm.ring} ${cm.bg} ${cm.fg} font-bold text-[10px]`}>
            [{meta.shortLetter}] {meta.label}
          </span>
          <code className="text-slate-400 text-[10px]">({nodeRef}, x:{facing.x}, y:{facing.y})</code>
          <span className="text-slate-500 ml-auto hidden sm:inline text-[10px]">
            <kbd className="px-1 border border-white/10 rounded bg-white/5">Espaço</kbd>
          </span>
        </div>
        {/* linha 3+: SQL real */}
        <div className={`text-[9px] uppercase tracking-[0.18em] ${cm.fg} opacity-70 mt-1.5`}>
          &gt; SQL COMMAND GENERATION
        </div>
        <pre className="hidden sm:block whitespace-pre-wrap break-words text-slate-200 leading-tight mt-0.5">
          {highlightSql(sql)}
        </pre>
      </div>
    </motion.div>
  );
}

// ============================================================================
// D-Pad mobile
// ============================================================================
interface DpadBtnProps { children: React.ReactNode; onClick: () => void; className?: string }

function DpadBtn({ children, onClick, className = '' }: DpadBtnProps) {
  const handleTouch = (e: React.TouchEvent) => {
    e.preventDefault();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(8); } catch { }
    }
    onClick();
  };
  return (
    <button
      onTouchStart={handleTouch}
      onClick={onClick}
      className={`glass active:scale-95 active:bg-white/10 text-slate-200 w-12 h-12 rounded-lg font-mono text-lg transition-transform ${className}`}
    >
      {children}
    </button>
  );
}

function DPad({
  onMove, onAction, tool, setTool,
}: {
  onMove: (d: Direction) => void;
  onAction: () => void;
  tool: Tool;
  setTool: (t: Tool) => void;
}) {
  // EDUCATIONAL: switcher de tool inline com os controles, pra mobile não precisar
  // rolar até o toolbar lá em cima toda vez que quiser trocar BUILD/UPGRADE/DELETE.
  const handleToolTap = (t: Tool) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(6); } catch { }
    }
    setTool(t);
  };
  return (
    <div className="flex flex-col gap-2 lg:hidden">
      <div className="flex items-center justify-center gap-1.5">
        {(Object.keys(TOOL_META) as Tool[]).map((id) => {
          const meta = TOOL_META[id];
          const Icon = meta.icon;
          const active = tool === id;
          const cm = COLOR_MAP[meta.color];
          return (
            <button
              key={id}
              onTouchStart={(e) => { e.preventDefault(); handleToolTap(id); }}
              onClick={() => handleToolTap(id)}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1 border font-mono text-[11px] active:scale-95 transition-transform ${active ? `${cm.ring} ${cm.bg} ${cm.fg}` : 'border-white/10 bg-white/[0.03] text-slate-400'
                }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {meta.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="grid grid-cols-3 gap-1">
          <div />
          <DpadBtn onClick={() => onMove('up')}>↑</DpadBtn>
          <div />
          <DpadBtn onClick={() => onMove('left')}>←</DpadBtn>
          <DpadBtn onClick={() => onMove('down')}>↓</DpadBtn>
          <DpadBtn onClick={() => onMove('right')}>→</DpadBtn>
        </div>
        <DpadBtn
          onClick={onAction}
          className="!w-16 !h-16 !rounded-full !bg-amber-400/20 !border-amber-400/40 !text-amber-300"
        >
          A
        </DpadBtn>
      </div>
    </div>
  );
}

// ============================================================================
// Main component
// ============================================================================
export default function GameEngine() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const kRef = useRef<K | null>(null);
  const stateRef = useRef<{
    objetos: Objeto[];
    tipo: Tipo;
    tool: Tool;
    facing: FacingTile;
    custom: PlayerCustom;
  }>({
    objetos: [],
    tipo: 'servidor',
    tool: 'build',
    facing: { x: SPAWN_X, y: SPAWN_Y },
    custom: { shirt: 'teal', hat: 'cyan', skin: 'tan' },
  });
  const cbRef = useRef<{
    create?: (x: number, y: number) => void;
    update?: (o: Objeto) => void;
    del?: (o: Objeto) => void;
    inspect?: (o: Objeto) => void;
  }>({});

  // EDUCATIONAL: store é JS sem types — anotamos o param e fazemos cast no retorno.
  const objetos = useGameStore((s: any) => s.objetos as Objeto[]);
  const userName = useGameStore((s: any) => s.userName as string | null);
  const tutorialStep = useGameStore((s: any) => s.tutorialStep as TutStep);
  const playerCustom = useGameStore((s: any) => s.playerCustom as PlayerCustom);
  const setUserName = useGameStore((s: any) => s.setUserName as (n: string) => void);
  const setTutorialStep = useGameStore((s: any) => s.setTutorialStep as (st: TutStep) => void);
  const setPlayerCustom = useGameStore((s: any) => s.setPlayerCustom as (c: PlayerCustom) => void);
  // EDUCATIONAL: tool/tipo agora vêm do store (header também os controla).
  const tipo = useGameStore((s: any) => s.tipo as Tipo);
  const tool = useGameStore((s: any) => s.tool as Tool);
  // setTipo é usado pelo HeaderActionBar; aqui só lemos.
  const setTool = useGameStore((s: any) => s.setTool as (t: Tool) => void);
  const setFps = useGameStore((s: any) => s.setFps as (n: number) => void);

  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState<FacingTile>({ x: SPAWN_X, y: SPAWN_Y });

  useObjetos();
  // EDUCATIONAL: hooks vêm de queries.js (JS). TS infere `void` por falta de
  // tipos lá — usamos um shim local com a tipagem certa do payload.
  type Mutate<P> = (p: P, opts?: { onSuccess?: (d: unknown) => void; onError?: (e: { status?: number; message?: string }) => void }) => void;
  const createMut = useCreateObjeto() as unknown as { mutate: Mutate<{ tipo: Tipo; pos_x: number; pos_y: number }> };
  const updateMut = useUpdateObjeto() as unknown as { mutate: Mutate<{ id: number | string }> };
  const deleteMut = useDeleteObjeto() as unknown as { mutate: Mutate<number | string> };
  const inspect = useInspectObjeto() as unknown as (id: number | string) => Promise<Objeto>;

  // EDUCATIONAL: dados do INSPECT (modal). Quando preenchido, mostra a casa lida.
  const [inspectData, setInspectData] = useState<Objeto | null>(null);
  // INSPECT em NPC abre modal específico (curiosidade + portrait).
  const [npcModalData, setNpcModalData] = useState<NpcPreset | null>(null);
  // INSPECT em prop (árvore, café, estante, etc) abre PropModal.
  const [propModalData, setPropModalData] = useState<PropPreset | null>(null);
  // Quiz pós-tutorial (1 vez na vida).
  const [quizOpen, setQuizOpen] = useState(false);

  // Carrega nome + progresso do tutorial + customização do sessionStorage.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedName = sessionStorage.getItem(USER_NAME_KEY);
      const tutDone = sessionStorage.getItem(TUTORIAL_DONE_KEY) === '1';
      const savedCustom = sessionStorage.getItem(PLAYER_CUSTOM_KEY);
      if (savedCustom) {
        try { setPlayerCustom(JSON.parse(savedCustom)); } catch { }
      }
      if (savedName) {
        setUserName(savedName);
        setTutorialStep(tutDone ? 'off' : 'intro');
      }
    } catch { }
  }, [setUserName, setTutorialStep, setPlayerCustom]);

  const onNameSubmit = useCallback((name: string, custom: PlayerCustom) => {
    try {
      sessionStorage.setItem(USER_NAME_KEY, name);
      sessionStorage.setItem(PLAYER_CUSTOM_KEY, JSON.stringify(custom));
    } catch { }
    setUserName(name);
    setPlayerCustom(custom);
    setTutorialStep('intro');
  }, [setUserName, setPlayerCustom, setTutorialStep]);

  const onSkipAll = useCallback(() => {
    try {
      sessionStorage.setItem(USER_NAME_KEY, 'jogador');
      sessionStorage.setItem(TUTORIAL_DONE_KEY, '1');
    } catch { }
    setUserName('jogador');
    setTutorialStep('off');
  }, [setUserName, setTutorialStep]);

  const startTutorial = useCallback(() => setTutorialStep('move'), [setTutorialStep]);

  const finishTutorial = useCallback(() => {
    try { sessionStorage.setItem(TUTORIAL_DONE_KEY, '1'); } catch { }
    setTutorialStep('off');
  }, [setTutorialStep]);

  // EDUCATIONAL: kaplay escuta input no canvas. Quando modal abre, foco vai pro
  // botão do modal — kaplay fica "surdo". Ao fechar, devolvemos o foco pro canvas
  // pra WASD/setas voltarem a funcionar sem precisar clicar no jogo.
  const refocusCanvas = useCallback(() => {
    requestAnimationFrame(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      canvasRef.current?.focus();
    });
  }, []);

  // EDUCATIONAL: assim que chega em 'done', marca o tutorial como concluído E
  // dispara o quiz (1× — gated por QUIZ_DONE_KEY). NÃO usamos cleanup com clearTimeout
  // aqui de propósito: se o usuário fecha o banner em <1.8s, o cleanup mataria o quiz.
  // Em vez disso, guardamos o id num ref pra evitar agendar duas vezes.
  const quizScheduledRef = useRef(false);
  useEffect(() => {
    if (tutorialStep === 'done') {
      try { sessionStorage.setItem(TUTORIAL_DONE_KEY, '1'); } catch { }
      if (quizScheduledRef.current) return;
      try {
        const quizDone = sessionStorage.getItem(QUIZ_DONE_KEY) === '1';
        if (!quizDone) {
          quizScheduledRef.current = true;
          // pequeno delay para o usuário ler o "Mestre do CRUD" antes do quiz
          setTimeout(() => setQuizOpen(true), 1500);
        }
      } catch { }
    }
  }, [tutorialStep]);

  // EDUCATIONAL: atalhos de teclado pra trocar tool sem usar mouse.
  // 1=BUILD, 2=UPGRADE, 3=DELETE, 4=INSPECT, Tab cicla (Shift+Tab cicla pra trás).
  // Pula se foco está num input (welcome modal por exemplo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === '1') { e.preventDefault(); setTool('build'); }
      else if (e.key === '2') { e.preventDefault(); setTool('upgrade'); }
      else if (e.key === '3') { e.preventDefault(); setTool('delete'); }
      else if (e.key === '4') { e.preventDefault(); setTool('inspect'); }
      else if (e.key === 'Tab') {
        e.preventDefault();
        const order: Tool[] = ['build', 'upgrade', 'delete', 'inspect'];
        const idx = order.indexOf(stateRef.current.tool);
        const dir = e.shiftKey ? -1 : 1;
        setTool(order[(idx + dir + order.length) % order.length]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Sincroniza refs com state (kaplay lê os refs sem causar re-init)
  useEffect(() => { stateRef.current.objetos = objetos; }, [objetos]);
  useEffect(() => { stateRef.current.tipo = tipo; }, [tipo]);
  useEffect(() => { stateRef.current.tool = tool; }, [tool]);
  useEffect(() => { stateRef.current.custom = playerCustom; }, [playerCustom]);

  const tileOcupado = useCallback(
    (x: number, y: number): Objeto | undefined =>
      stateRef.current.objetos.find((o) => o.pos_x === x && o.pos_y === y),
    []
  );

  // Target sob o tile que o player encara (deriva do state reativo, não do ref)
  const target: Objeto | null = objetos.find((o: Objeto) => o.pos_x === facing.x && o.pos_y === facing.y) ?? null;

  // facing → React state, com batch via rAF para evitar re-render por frame
  const facingRef = useRef<FacingTile>({ x: SPAWN_X, y: SPAWN_Y });
  const setFacingDeferred = useCallback((f: FacingTile) => {
    requestAnimationFrame(() => setFacing(f));
  }, []);

  // Atualiza handlers num ref via useEffect (refs não devem ser escritos durante render)
  useEffect(() => {
    // EDUCATIONAL: helper p/ avançar tutorial só se estamos no step esperado.
    const advanceIf = (from: TutStep, to: TutStep) => {
      const cur = useGameStore.getState().tutorialStep;
      if (cur === from) useGameStore.getState().setTutorialStep(to);
    };

    cbRef.current.create = (x, y) => {
      if (tileOcupado(x, y)) {
        sfx.blocked();
        return notifyApi({ method: 'POST', status: 409, ms: 0 });
      }
      sfx.build();
      const start = performance.now();
      const tipo = stateRef.current.tipo;
      createMut.mutate(
        { tipo, pos_x: x, pos_y: y },
        {
          onSuccess: (created) => {
            notifyApi({ method: 'POST', status: 201, ms: Math.round(performance.now() - start) });
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              try { navigator.vibrate(10); } catch { }
            }
            spawnSqlBubble(kRef.current, `INSERT id=${(created as Objeto).id}`, x, y, [16, 185, 129]);
            spawnFloatingText(kRef.current, `+1 ${tipo}`, x, y - 1, [16, 185, 129], 11);
            const p = kRef.current?.__player;
            if (p) spawnPlayerActionSpeech(kRef.current, 'build', p.pos.x, p.pos.y);
            cameraShake(kRef.current, 1.5, 0.18);
            advanceIf('create', 'read');
          },
          onError: (e: any) =>
            notifyApi({ method: 'POST', status: e.status || 500, ms: Math.round(performance.now() - start) }),
        }
      );
    };
    cbRef.current.update = (obj) => {
      sfx.update();
      const start = performance.now();
      const fromLevel = clampLevel(obj.level);
      const nextLevel = clampLevel(fromLevel + 1);
      const maxed = fromLevel === 3;
      updateMut.mutate(
        { id: obj.id as number },
        {
          onSuccess: () => {
            notifyApi({ method: 'PUT', status: 200, ms: Math.round(performance.now() - start) });
            if (maxed) {
              spawnSqlBubble(kRef.current, `nivel max`, obj.pos_x, obj.pos_y, [167, 139, 250]);
              spawnFloatingText(kRef.current, `máx (3)`, obj.pos_x, obj.pos_y - 1, [167, 139, 250], 10);
            } else {
              // EDUCATIONAL: feedback de level-up bem mais dramático. O usuário precisa
              // VER que a casa evoluiu — antes era sutil e dava impressão de "não rolou".
              spawnSqlBubble(kRef.current, `level=${nextLevel}`, obj.pos_x, obj.pos_y, [251, 191, 36]);
              spawnFloatingText(kRef.current, `LEVEL UP! nv ${fromLevel} → ${nextLevel}`, obj.pos_x, obj.pos_y - 1, [251, 191, 36], 12);
              spawnLevelUpStars(kRef.current, obj.pos_x * TILE + TILE / 2, obj.pos_y * TILE + TILE / 2, [251, 191, 36]);
              // Flash dourado piscando + onda concêntrica
              flashTile(kRef.current, obj.pos_x, obj.pos_y, [253, 224, 71]);
              spawnUpdateRing(kRef.current, obj.pos_x * TILE + TILE / 2, obj.pos_y * TILE + TILE / 2);
              // Camada extra de partículas douradas
              spawnLevelUpBurst(kRef.current, obj.pos_x * TILE + TILE / 2, obj.pos_y * TILE + TILE / 2);
              const p = kRef.current?.__player;
              if (p) spawnPlayerActionSpeech(kRef.current, 'update', p.pos.x, p.pos.y);
              cameraShake(kRef.current, 2.5, 0.22);
            }
            advanceIf('update', 'delete');
          },
          onError: (e: any) =>
            notifyApi({ method: 'PUT', status: e.status || 500, ms: Math.round(performance.now() - start) }),
        }
      );
    };
    cbRef.current.del = (obj) => {
      sfx.delete();
      const start = performance.now();
      deleteMut.mutate(obj.id as number, {
        onSuccess: () => {
          notifyApi({ method: 'DELETE', status: 200, ms: Math.round(performance.now() - start) });
          spawnSqlBubble(kRef.current, `DELETE id=${obj.id}`, obj.pos_x, obj.pos_y, [244, 63, 94]);
          spawnFloatingText(kRef.current, `-1`, obj.pos_x, obj.pos_y - 1, [244, 63, 94], 12);
          const p = kRef.current?.__player;
          if (p) spawnPlayerActionSpeech(kRef.current, 'delete', p.pos.x, p.pos.y);
          cameraShake(kRef.current, 3, 0.25);
          advanceIf('delete', 'done');
        },
        onError: (e: any) =>
          notifyApi({ method: 'DELETE', status: e.status || 500, ms: Math.round(performance.now() - start) }),
      });
    };
    cbRef.current.inspect = (obj) => {
      // EDUCATIONAL: GET /api/objetos/:id — lê SÓ esta linha. Mostra modal didático.
      sfx.read();
      const start = performance.now();
      // efeito visual no canvas: scan de ondas + texto
      spawnReadWaves(kRef.current, obj.pos_x * TILE + TILE / 2, obj.pos_y * TILE + TILE / 2);
      spawnSqlBubble(kRef.current, `SELECT id=${obj.id}`, obj.pos_x, obj.pos_y, [34, 211, 238]);
      spawnFloatingText(kRef.current, `READ #${obj.id}`, obj.pos_x, obj.pos_y - 1, [34, 211, 238], 10);
      const p = kRef.current?.__player;
      if (p) spawnPlayerActionSpeech(kRef.current, 'inspect', p.pos.x, p.pos.y);
      inspect(obj.id)
        .then((data) => {
          notifyApi({ method: 'GET', status: 200, ms: Math.round(performance.now() - start) });
          setInspectData(data);
          advanceIf('read', 'update');
        })
        .catch((e: any) => {
          notifyApi({ method: 'GET', status: e?.status || 500, ms: Math.round(performance.now() - start) });
        });
    };
  });

  // ===== Kaplay init =====
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let k: K | null = null;

    (async () => {
      const mod = await import('kaplay');
      if (cancelled) return;
      const kaplay = (mod as any).default;

      k = kaplay({
        canvas,
        width: W,
        height: H,
        background: [8, 14, 28, 1],
        // crisp:true desliga texture filtering (interpolação bilinear).
        // Pra rect/circle primitivas isso costuma ser ~10-20% mais rápido.
        crisp: true,
        global: false,
        debug: false,
        touchToMouse: true,
        // pixelDensity:1 trava o canvas em 1×; sem isso, kaplay multiplica por
        // window.devicePixelRatio (até 3× em monitores HiDPI/Windows scaling),
        // o que com 40×28 tiles + zoom 1.5 explode o GPU e derruba o FPS.
        pixelDensity: 1,
      });
      kRef.current = k;
      const K_ = k as K;

      // EDUCATIONAL: zoom da câmera. Sprites parecem maiores; área visível encolhe.
      // Mais imersivo + sprites pixel-art ficam legíveis.
      try { K_.setCamScale?.(CAM_SCALE); } catch { /* fallback: sem zoom, ainda funciona */ }

      // EDUCATIONAL: pré-carrega os 3 sprites de casa (níveis 1/2/3).
      // loadSprite é assíncrono — esperamos antes de spawnar qualquer obj-node,
      // senão drawSprite('casa1') falha em silêncio até o asset chegar.
      // Note: 'casa%20v3.png' tem espaço no nome do arquivo no /public.
      try {
        await Promise.all([
          K_.loadSprite('casa1', '/casa.png'),
          K_.loadSprite('casa2', '/casav2.png'),
          K_.loadSprite('casa3', '/casa%20v3.png'),
        ]);
      } catch (err) {
        // sprites são best-effort — se falhar, drawHouseByLevel cai num fallback procedural.
        console.warn('[CRUD Dungeon] sprite load falhou, usando fallback procedural', err);
      }
      if (cancelled) return;

      // Tiles do data center
      drawDataCenterFloor(K_);

      // EDUCATIONAL: NPC ambiente ("data clerk") + signs interativas dão vida ao mapa,
      // sem competir com o gameplay. Tudo procedural, sem assets externos.
      // npcMap: tile-key → fn de fala (usada pelo INSPECT).
      // signTiles: Set de tile-keys (NPCs e signs bloqueiam movimento + BUILD).
      const npcMap = spawnNpcs(K_);
      const signTiles = spawnSigns(K_);
      const propsMap = spawnProps(K_);
      // Cachorro errante perto do spawn — anda a cada 3-6s.
      // Não bloqueia tiles (player atravessa, é fofo). INSPECT abre carinho.
      const dogNode = spawnDog(K_, SPAWN_X - 3, SPAWN_Y + 1);
      // Estações de PC ambiente — decoração + NPC sentado codando.
      spawnPcStations(K_);
      const tileBlocked = (x: number, y: number): boolean => {
        const key = `${x},${y}`;
        return npcMap.has(key) || signTiles.has(key) || propsMap.has(key);
      };

      // EDUCATIONAL: data packets viajam entre NPCs aleatórios a cada ~5s.
      // Sugere "rede ativa" — o cenário fica vivo sem competir com gameplay.
      const npcCenters = NPC_PRESETS.map((n) => ({
        x: n.tileX * TILE + TILE / 2,
        y: n.tileY * TILE + TILE / 2,
      }));
      K_.loop(4.5, () => {
        if (npcCenters.length < 2) return;
        const a = npcCenters[Math.floor(Math.random() * npcCenters.length)];
        let b = npcCenters[Math.floor(Math.random() * npcCenters.length)];
        if (b === a) b = npcCenters[(npcCenters.indexOf(a) + 1) % npcCenters.length];
        spawnDataPacketBeam(K_, a.x, a.y, b.x, b.y);
      });

      // Partículas ambiente — pontos lentos como pacotes de dados
      spawnAmbientParticles(K_);

      // Player com sistema de "action" pra animações contextuais.
      // EDUCATIONAL: action='idle'|'build'|'update'|'delete'|'happy'.
      // Quando o jogador interage, action vira o tipo da ação por X segundos
      // e o draw reflete (martelando, deletando, comemorando).
      const player = K_.add([
        K_.pos(SPAWN_X * TILE + TILE / 2, SPAWN_Y * TILE + TILE / 2),
        K_.anchor('center'),
        K_.scale(1.7),
        K_.z(5),
        {
          targetPos: K_.vec2(SPAWN_X * TILE + TILE / 2, SPAWN_Y * TILE + TILE / 2),
          tileX: SPAWN_X,
          tileY: SPAWN_Y,
          dir: 'down' as Direction,
          frame: 0,
          frameTime: 0,
          moving: false,
          bobble: 0,
          action: 'idle' as 'idle' | 'build' | 'update' | 'delete' | 'happy',
          actionT: 0,
          happyT: 0,
          idleT: 0,
          nextIdleAt: 12 + Math.random() * 8,
          update() {
            this.pos.x = K_.lerp(this.pos.x, this.targetPos.x, 0.22);
            this.pos.y = K_.lerp(this.pos.y, this.targetPos.y, 0.22);
            this.frameTime += K_.dt();
            this.bobble += K_.dt() * 4;
            // timer da ação atual
            if (this.action !== 'idle' && this.action !== 'happy') {
              this.actionT += K_.dt();
              if (this.actionT > 0.4) { this.action = 'idle'; this.actionT = 0; }
            }
            // estado happy: ativa enquanto tutorialStep === 'done'
            if (useGameStore.getState().tutorialStep === 'done') {
              if (this.action !== 'happy') sfx.happy();
              this.action = 'happy';
              this.happyT += K_.dt();
            } else if (this.action === 'happy') {
              this.action = 'idle';
              this.happyT = 0;
            }
            if (this.frameTime > 0.13) {
              this.frameTime = 0;
              this.frame = this.moving ? (this.frame + 1) % 4 : 0;
            }
            // Idle quotes — só quando ocioso (não andando, não em ação, não happy)
            if (!this.moving && this.action === 'idle') {
              this.idleT += K_.dt();
              if (this.idleT > this.nextIdleAt) {
                spawnPlayerIdleSpeech(K_, this.pos.x, this.pos.y);
                this.idleT = 0;
                this.nextIdleAt = 14 + Math.random() * 10;
              }
            } else {
              this.idleT = 0;
            }
            this.moving = false;
            const dx = this.dir === 'right' ? 1 : this.dir === 'left' ? -1 : 0;
            const dy = this.dir === 'down' ? 1 : this.dir === 'up' ? -1 : 0;
            const fx = Math.max(0, Math.min(COLS - 1, this.tileX + dx));
            const fy = Math.max(0, Math.min(ROWS - 1, this.tileY + dy));
            stateRef.current.facing = { x: fx, y: fy };
          },
          draw() {
            drawDevopsSprite(K_, this.frame, this.dir, this.bobble, stateRef.current.custom, this.action, this.actionT, this.happyT, stateRef.current.tool);
          },
        },
      ]);
      // expor pra interact() poder setar action
      kRef.current.__player = player;

      // Indicador da tile à frente — anel pulsante cyan + cantos animados
      K_.add([
        K_.pos(0, 0),
        K_.z(2),
        {
          t: 0,
          update() {
            this.t += K_.dt() * 2.4;
          },
          draw() {
            const f = stateRef.current.facing;
            const pulse = 0.5 + 0.5 * Math.sin(this.t);
            const expand = pulse * 4;
            // outer pulsing rect
            K_.drawRect({
              pos: K_.vec2(f.x * TILE - expand, f.y * TILE - expand),
              width: TILE + expand * 2,
              height: TILE + expand * 2,
              color: K_.rgb(34, 211, 238),
              opacity: 0.15 - pulse * 0.1,
              outline: { width: 1, color: K_.rgb(34, 211, 238) },
              radius: 6,
            });
            // crisp inner outline
            K_.drawRect({
              pos: K_.vec2(f.x * TILE + 2, f.y * TILE + 2),
              width: TILE - 4,
              height: TILE - 4,
              fill: false,
              outline: { width: 2, color: K_.rgb(34, 211, 238), opacity: 0.85 },
              radius: 4,
            });
            // 4 cantos
            const corner = 5;
            const cx = f.x * TILE;
            const cy = f.y * TILE;
            const drawCorner = (px: number, py: number, dx: number, dy: number) => {
              K_.drawLine({
                p1: K_.vec2(px, py),
                p2: K_.vec2(px + corner * dx, py),
                color: K_.rgb(34, 211, 238),
                width: 2,
              });
              K_.drawLine({
                p1: K_.vec2(px, py),
                p2: K_.vec2(px, py + corner * dy),
                color: K_.rgb(34, 211, 238),
                width: 2,
              });
            };
            drawCorner(cx + 2, cy + 2, 1, 1);
            drawCorner(cx + TILE - 2, cy + 2, -1, 1);
            drawCorner(cx + 2, cy + TILE - 2, 1, -1);
            drawCorner(cx + TILE - 2, cy + TILE - 2, -1, -1);
          },
        },
      ]);

      // Sincronização de objetos
      const objNodes = new Map<string | number, K>();
      // EDUCATIONAL: recebe `objs` direto do subscriber (state fresco). Se lesse de
      // stateRef.current.objetos aqui, ficaria 1 render atrasado — bug clássico de
      // off-by-one que fazia level 2 mostrar sprite do nv1, level 3 mostrar do nv2.
      // stateRef só é atualizado pelo useEffect que roda DEPOIS do commit do React.
      const syncObjects = (objs: Objeto[]) => {
        const ids = new Set(objs.map((o) => o.id));

        // EDUCATIONAL: pass 1 — remove o que sumiu. MAS: se sumiu um id "tmp-..."
        // e existe um id real no mesmo tile sem nó, é a confirmação do servidor
        // (POST 201 trocou o id temporário pelo real). Aí transferimos o nó em
        // vez de destruir+recriar (evita flicker delete+create animation).
        for (const [id, node] of objNodes) {
          if (ids.has(id)) continue;
          const isTmp = String(id).startsWith('tmp-');
          const replacement = isTmp
            ? objs.find((o) => o.pos_x === node.tileX && o.pos_y === node.tileY && !objNodes.has(o.id))
            : null;
          if (replacement) {
            objNodes.delete(id);
            objNodes.set(replacement.id, node);
            node.objStatus = replacement.status;
            node.objTipo = replacement.tipo;
            node.objLevel = clampLevel(replacement.level);
          } else {
            spawnDeleteParticles(K_, node.pos.x, node.pos.y);
            node.destroy();
            objNodes.delete(id);
          }
        }

        // Pass 2 — adiciona ou atualiza
        for (const o of objs) {
          const existing = objNodes.get(o.id);
          const newLvl = clampLevel(o.level);
          if (!existing) {
            const node = makeObjectNode(K_, o);
            objNodes.set(o.id, node);
          } else if (existing.objStatus !== o.status || existing.objTipo !== o.tipo || existing.objLevel !== newLvl) {
            const leveledUp = existing.objLevel != null && newLvl > existing.objLevel;
            existing.objStatus = o.status;
            existing.objTipo = o.tipo;
            existing.objLevel = newLvl;
            // pop visual maior quando sobe de nível (evolui sprite)
            const overshoot = leveledUp ? 1.35 : 1.18;
            K_.tween(overshoot, 1, 0.32, (v: number) => (existing.scale = K_.vec2(v, v)), K_.easings.easeOutQuad);
          }
        }
      };
      let lastObjs = useGameStore.getState().objetos;
      const unsub = useGameStore.subscribe((state: { objetos: Objeto[] }) => {
        const next = state.objetos;
        if (next !== lastObjs) {
          lastObjs = next;
          syncObjects(next);
        }
      });
      syncObjects(lastObjs);

      // Câmera segue o player com smooth-follow.
      // EDUCATIONAL: com camScale > 1, a área VISÍVEL em world space = canvas / scale.
      // Por isso o clamp usa halfW/halfH ajustados (senão veríamos vazio na borda).
      K_.onUpdate(() => {
        const cur = K_.getCamPos();
        const cx = K_.lerp(cur.x, player.pos.x, 0.06);
        const cy = K_.lerp(cur.y, player.pos.y, 0.06);
        const halfW = (K_.width() / 2) / CAM_SCALE;
        const halfH = (K_.height() / 2) / CAM_SCALE;
        K_.setCamPos(K_.vec2(
          Math.max(halfW, Math.min(W - halfW, cx)),
          Math.max(halfH, Math.min(H - halfH, cy))
        ));
        // Sincronizar facing → React (para SQL preview)
        const f = stateRef.current.facing;
        if (f.x !== facingRef.current.x || f.y !== facingRef.current.y) {
          facingRef.current = f;
          setFacingDeferred(f);
        }
      });

      // Input
      const tryMove = (dir: Direction) => {
        player.dir = dir;
        const dx = dir === 'right' ? 1 : dir === 'left' ? -1 : 0;
        const dy = dir === 'down' ? 1 : dir === 'up' ? -1 : 0;
        const nx = Math.max(0, Math.min(COLS - 1, player.tileX + dx));
        const ny = Math.max(0, Math.min(ROWS - 1, player.tileY + dy));
        // EDUCATIONAL: NPCs e signs também bloqueiam o passo do player.
        if (tileOcupado(nx, ny) || tileBlocked(nx, ny)) {
          player.moving = true;
          return;
        }
        if (nx === player.tileX && ny === player.tileY) return;
        sfx.move();
        player.tileX = nx;
        player.tileY = ny;
        player.targetPos = K_.vec2(nx * TILE + TILE / 2, ny * TILE + TILE / 2);
        player.moving = true;
        // Tutorial: 'move' avança para 'create' assim que o jogador anda.
        const cur = useGameStore.getState().tutorialStep;
        if (cur === 'move') useGameStore.getState().setTutorialStep('create');
      };

      const setPlayerAction = (a: 'idle' | 'build' | 'update' | 'delete') => {
        if (player.action === 'happy') return; // não interrompe celebração
        player.action = a;
        player.actionT = 0;
      };

      // EDUCATIONAL: cooldown forte contra auto-repeat + race da optimistic update.
      // 400ms é largo o bastante pra propagar React state entre presses, mas curto
      // pra não atrapalhar o jogo (jogador consegue fazer 2.5 ações/seg).
      let lastInteractAt = 0;
      const interact = () => {
        const now = performance.now();
        if (now - lastInteractAt < 400) return;
        lastInteractAt = now;
        const f = stateRef.current.facing;
        const obj = tileOcupado(f.x, f.y);
        const t = stateRef.current.tool;
        if (!obj) {
          // EDUCATIONAL: tile sem casa. Pode ter NPC, prop (item), dog, sign, ou vazio.
          const npc = npcMap.get(`${f.x},${f.y}`);
          const prop = propsMap.get(`${f.x},${f.y}`);
          const dogHere = dogNode && dogNode.tileX === f.x && dogNode.tileY === f.y;

          // 1) Dog: INSPECT faz carinho (latido real + corações + rabo abana + bubble).
          if (dogHere && t === 'inspect') {
            sfx.dogBark();
            spawnReadWaves(K_, dogNode.pos.x, dogNode.pos.y);
            spawnPetHearts(K_, dogNode.pos.x, dogNode.pos.y);
            spawnTalkBubble(K_, 'au au! 🐾', dogNode.pos.x, dogNode.pos.y - 18, [254, 205, 211]);
            dogNode.pettedT = 2.0; // pausa errância por 2s + anima rabo mais
            return;
          }
          // 2) NPC: INSPECT abre modal com curiosidades.
          if (npc && t === 'inspect') {
            flashTile(K_, f.x, f.y, [34, 211, 238]);
            spawnReadWaves(K_, f.x * TILE + TILE / 2, f.y * TILE + TILE / 2);
            sfx.read();
            setNpcModalData(npc);
            return;
          }
          // 3) Prop: INSPECT abre PropModal com curiosidades temáticas.
          if (prop && t === 'inspect') {
            flashTile(K_, f.x, f.y, [34, 211, 238]);
            spawnReadWaves(K_, f.x * TILE + TILE / 2, f.y * TILE + TILE / 2);
            sfx.read();
            setPropModalData(prop);
            return;
          }
          // 4) BUILD num NPC mostra modal (entender porque bloqueia).
          if (npc && t === 'build') {
            sfx.blocked();
            setNpcModalData(npc);
            return;
          }
          // 5) BUILD num prop também mostra modal didático.
          if (prop && t === 'build') {
            sfx.blocked();
            setPropModalData(prop);
            return;
          }
          // 6) Bloqueado por sign/dog/qualquer outro = som mudo.
          if (tileBlocked(f.x, f.y) || dogHere) {
            sfx.blocked();
            return;
          }
          // 7) Tile genuinamente vazio: BUILD constrói; outras tools no-op.
          if (t === 'build') {
            spawnCreateParticles(K_, f.x * TILE + TILE / 2, f.y * TILE + TILE / 2);
            flashTile(K_, f.x, f.y, [16, 185, 129]);
            setPlayerAction('build');
            cbRef.current.create?.(f.x, f.y);
          }
          return;
        }
        if (t === 'inspect') {
          // EDUCATIONAL: READ-detalhe (SELECT WHERE id=X). Modal mostra a linha.
          flashTile(K_, f.x, f.y, [34, 211, 238]);
          cbRef.current.inspect?.(obj as Objeto);
        } else if (t === 'upgrade') {
          flashTile(K_, f.x, f.y, [251, 191, 36]);
          spawnUpdateRing(K_, f.x * TILE + TILE / 2, f.y * TILE + TILE / 2);
          setPlayerAction('update');
          cbRef.current.update?.(obj as Objeto);
        } else if (t === 'delete') {
          // EDUCATIONAL: NÃO deletar tmp- (objeto ainda não confirmado).
          // Se DELETE de tmp falhar no servidor, o store reverte e o tmp volta como fantasma.
          if (String(obj.id).startsWith('tmp-')) {
            notifyApi({ method: 'DELETE', status: 425, ms: 0 });
            return;
          }
          flashTile(K_, f.x, f.y, [244, 63, 94]);
          // SWEEP: destrói TODOS os obj-node no tile facing (não só o do Map).
          // Garante limpeza visual mesmo se o Map estiver dessincronizado.
          const allNodes = K_.get('obj-node') || [];
          for (const n of allNodes) {
            if (n.tileX === f.x && n.tileY === f.y) {
              spawnDeleteParticles(K_, n.pos.x, n.pos.y);
              try { n.destroy(); } catch { }
              if (n.objId !== undefined) objNodes.delete(n.objId);
            }
          }
          setPlayerAction('delete');
          cbRef.current.del?.(obj as Objeto);
        }
      };

      K_.onKeyPress(['up', 'w'], () => tryMove('up'));
      K_.onKeyPress(['down', 's'], () => tryMove('down'));
      K_.onKeyPress(['left', 'a'], () => tryMove('left'));
      K_.onKeyPress(['right', 'd'], () => tryMove('right'));

      // EDUCATIONAL: Espaço/Enter usam edge-detection manual (frame-a-frame).
      // O onKeyPress do kaplay 3001 às vezes refire em auto-repeat do browser
      // (keydown repete a 30Hz quando segura). Aqui só dispara quando vai de
      // SOLTO → APERTADO, garantindo 1 ação por toque físico.
      let spaceWasDown = false;
      let moveRepeatTimer = 0;
      K_.onUpdate(() => {
        const isSpaceDown = K_.isKeyDown('space') || K_.isKeyDown('enter');
        if (isSpaceDown && !spaceWasDown) {
          interact();
        }
        spaceWasDown = isSpaceDown;

        // Repetição de movimento (segurar WASD) — 1 tile a cada 160ms.
        moveRepeatTimer += K_.dt();
        if (moveRepeatTimer < 0.16) return;
        moveRepeatTimer = 0;
        if (K_.isKeyDown('up') || K_.isKeyDown('w')) tryMove('up');
        else if (K_.isKeyDown('down') || K_.isKeyDown('s')) tryMove('down');
        else if (K_.isKeyDown('left') || K_.isKeyDown('a')) tryMove('left');
        else if (K_.isKeyDown('right') || K_.isKeyDown('d')) tryMove('right');
      });

      kRef.current.__moveDir = tryMove;
      kRef.current.__interact = interact;
      kRef.current.__cleanup = unsub;

      // EDUCATIONAL: publica FPS pro store via rAF puro (independente do kaplay).
      // Antes usávamos K_.debug.fps() que pode reportar valor enviesado por
      // janela curta de medição. rAF count num intervalo de 500ms dá o número
      // real de frames pintados pela tela.
      let frameCount = 0;
      let lastFpsTs = performance.now();
      let rafFpsId = 0;
      const tickFps = () => {
        frameCount++;
        const now = performance.now();
        const dt = now - lastFpsTs;
        if (dt >= 500) {
          const fps = Math.round((frameCount * 1000) / dt);
          setFps(fps);
          frameCount = 0;
          lastFpsTs = now;
        }
        rafFpsId = requestAnimationFrame(tickFps);
      };
      rafFpsId = requestAnimationFrame(tickFps);
      const prevCleanup = kRef.current.__cleanup;
      kRef.current.__cleanup = () => {
        cancelAnimationFrame(rafFpsId);
        try { prevCleanup?.(); } catch { }
      };

      setReady(true);
    })();

    return () => {
      cancelled = true;
      try {
        kRef.current?.__cleanup?.();
        kRef.current?.quit?.();
      } catch { }
      kRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDpad = (d: Direction) => kRef.current?.__moveDir?.(d);
  const onAction = () => kRef.current?.__interact?.();

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full p-2 sm:p-3 gap-2">
      <div className="relative flex-1 min-h-0 w-full flex items-center justify-center">
        <div
          className="relative w-full h-full flex items-center justify-center"
        >
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            tabIndex={0}
            // PERF: removidos rounded-xl + shadow blur de 80px + vinheta inset.
            // CSS shadows com blur sobre canvas que muda todo frame = a GPU
            // refaz Gaussian blur a cada frame (assassino de FPS, junto com
            // backdrop-filter). Borda fina mantém o framing visual.
            className="block max-w-full max-h-full border border-cyan-400/15 bg-[#080e1c] touch-none select-none focus:outline-none"
            style={{ aspectRatio: `${COLS}/${ROWS}`, width: 'auto', height: 'auto' }}
          />
          {/* EDUCATIONAL: tutorial banner — topo do canvas, não rouba espaço do layout. */}
          <AnimatePresence mode="wait">
            {userName && tutorialStep !== 'name' && tutorialStep !== 'intro' && tutorialStep !== 'off' && (
              <div key="tut" className="absolute top-2 left-2 right-2 z-10 pointer-events-auto">
                <TutorialBanner
                  key={tutorialStep}
                  name={userName}
                  step={tutorialStep as ActiveTutStep}
                  onSkip={onSkipAll}
                  onClose={finishTutorial}
                />
              </div>
            )}
          </AnimatePresence>
          {/* EDUCATIONAL: holo de preview SQL — flutua na parte inferior do canvas,
              acima do hint, abaixo do tutorial. Dá vibe "tactical visualization". */}
          {ready && (
            <div className="absolute bottom-10 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:max-w-md z-10 pointer-events-none">
              <SqlPreviewBar tool={tool} tipo={tipo} facing={facing} target={target} />
            </div>
          )}
          {!ready && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-slate-900/80">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="CRUD Dungeon"
                width={72}
                height={72}
                className="rounded-xl animate-pulse shadow-[0_0_40px_rgba(34,211,238,0.4)] object-contain"
              />
              <div className="font-mono text-cyan-400 text-sm">inicializando engine...</div>
            </div>
          )}
          {/* Hint canto inferior */}
          {ready && (
            <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1.5 glass rounded px-2 py-1 font-mono text-[10px] text-slate-400">
              <ChevronRight className="w-3 h-3 text-cyan-400" />
              encare e pressione Espaço
            </div>
          )}
        </div>
      </div>

      <DPad onMove={onDpad} onAction={onAction} tool={tool} setTool={setTool} />

      <AnimatePresence>
        {tutorialStep === 'name' && (
          <NameStep key="name" onSubmit={onNameSubmit} onSkip={onSkipAll} />
        )}
        {tutorialStep === 'intro' && userName && (
          <IntroStep key="intro" name={userName} onClose={startTutorial} />
        )}
        {inspectData && (
          <InspectModal
            key="inspect"
            data={inspectData}
            onClose={() => { setInspectData(null); refocusCanvas(); }}
          />
        )}
        {npcModalData && (
          <NpcModal
            key="npc"
            data={npcModalData}
            onClose={() => { setNpcModalData(null); refocusCanvas(); }}
          />
        )}
        {propModalData && (
          <PropModal
            key="prop"
            data={propModalData}
            onClose={() => { setPropModalData(null); refocusCanvas(); }}
          />
        )}
      </AnimatePresence>

      <QuizModal
        open={quizOpen}
        name={userName}
        onClose={() => {
          setQuizOpen(false);
          // Sai do estado 'done' (que mantém o boneco em loop happy/dança).
          // 'off' = sandbox livre — boneco volta pro idle.
          setTutorialStep('off');
          refocusCanvas();
        }}
      />
    </div>
  );
}

// ============================================================================
// Drawing helpers — tema "Data Center"
// ============================================================================
function drawDataCenterFloor(k: K) {
  // EDUCATIONAL — perf: floor "data center / dungeon" otimizado.
  // Antes: 1 retângulo POR TILE (40×28 = 1120) + 132 edges × 3 + 100 doodads de circuito.
  // Cada entidade kaplay paga matrix transform + draw call por frame, mesmo estática.
  // Resultado: ~2000 entidades, FPS travado em 28-30.
  // Agora: 1 base + 4 bandas de borda + 2 strips de path + rivets esparsos. ~50 entidades.
  // Visual praticamente igual; ganho de FPS ~3×.
  const rand = (x: number, y: number) => {
    const s = (x * 73856093) ^ (y * 19349663);
    return ((s % 1000) + 1000) % 1000 / 1000;
  };

  // 1) Background único. Cor é a média das 2 cores do checker antigo (16/12, 24/20, 44/38).
  // O checker era diff de 4-6 por canal — invisível a olho nu, não vale 1120 entidades.
  k.add([
    k.rect(W, H),
    k.pos(0, 0),
    k.color(14, 22, 41),
    k.z(-4),
  ]);

  // 2) Strip de path (orientação visual). Substitui 67 path tiles + sub-rects.
  // Banda escura levemente mais clara cruzando no spawn.
  k.add([
    k.rect(W, TILE),
    k.pos(0, SPAWN_Y * TILE),
    k.color(20, 32, 52),
    k.z(-3),
  ]);
  k.add([
    k.rect(TILE, H),
    k.pos(SPAWN_X * TILE, 0),
    k.color(20, 32, 52),
    k.z(-3),
  ]);
  // Linhas centrais cyan (1 horizontal + 1 vertical, atravessando o mapa inteiro).
  k.add([
    k.rect(W, 2),
    k.pos(0, SPAWN_Y * TILE + TILE / 2 - 1),
    k.color(34, 211, 238),
    k.opacity(0.18),
    k.z(-2),
  ]);
  k.add([
    k.rect(2, H),
    k.pos(SPAWN_X * TILE + TILE / 2 - 1, 0),
    k.color(34, 211, 238),
    k.opacity(0.18),
    k.z(-2),
  ]);
  // Cruzamento — respawn pad.
  k.add([
    k.circle(TILE / 2 - 6),
    k.pos(SPAWN_X * TILE + TILE / 2, SPAWN_Y * TILE + TILE / 2),
    k.color(34, 211, 238),
    k.opacity(0.15),
    k.outline(1, k.rgb(34, 211, 238)),
    k.z(-2),
  ]);

  // 3) Bordas como 4 bandas longas. Antes: 132 tiles × 3 entidades = 396.
  // Agora: 4 bandas + ~20 rivets espaçados = ~24 entidades.
  // banda topo
  k.add([ k.rect(W, TILE), k.pos(0, 0), k.color(28, 38, 70), k.opacity(0.6), k.z(-2) ]);
  // banda baixo
  k.add([ k.rect(W, TILE), k.pos(0, (ROWS - 1) * TILE), k.color(28, 38, 70), k.opacity(0.6), k.z(-2) ]);
  // banda esquerda
  k.add([ k.rect(TILE, H - 2 * TILE), k.pos(0, TILE), k.color(28, 38, 70), k.opacity(0.6), k.z(-2) ]);
  // banda direita
  k.add([ k.rect(TILE, H - 2 * TILE), k.pos((COLS - 1) * TILE, TILE), k.color(28, 38, 70), k.opacity(0.6), k.z(-2) ]);
  // linhas divisoras horizontais nas bandas top/bottom — dá feel de "tijolos"
  k.add([ k.rect(W, 1), k.pos(0, TILE / 2 - 0.5), k.color(50, 70, 120), k.opacity(0.5), k.z(-1) ]);
  k.add([ k.rect(W, 1), k.pos(0, (ROWS - 1) * TILE + TILE / 2 - 0.5), k.color(50, 70, 120), k.opacity(0.5), k.z(-1) ]);
  // rivets violet — só nos cantos pra marcar limite. 4 cantos × 2 rivets cada.
  for (const [rx, ry] of [
    [0, 0], [COLS - 1, 0], [0, ROWS - 1], [COLS - 1, ROWS - 1],
  ] as Array<[number, number]>) {
    k.add([
      k.circle(2),
      k.pos(rx * TILE + TILE / 2, ry * TILE + TILE / 2),
      k.color(167, 139, 250),
      k.opacity(0.7),
      k.z(-1),
    ]);
  }
  // rivets esparsos ao longo das bordas (a cada 4 tiles).
  for (let x = 4; x < COLS - 4; x += 4) {
    k.add([ k.circle(1.4), k.pos(x * TILE + TILE / 2, TILE / 2), k.color(167, 139, 250), k.opacity(0.5), k.z(-1) ]);
    k.add([ k.circle(1.4), k.pos(x * TILE + TILE / 2, (ROWS - 1) * TILE + TILE / 2), k.color(167, 139, 250), k.opacity(0.5), k.z(-1) ]);
  }
  for (let y = 4; y < ROWS - 4; y += 4) {
    k.add([ k.circle(1.4), k.pos(TILE / 2, y * TILE + TILE / 2), k.color(167, 139, 250), k.opacity(0.5), k.z(-1) ]);
    k.add([ k.circle(1.4), k.pos((COLS - 1) * TILE + TILE / 2, y * TILE + TILE / 2), k.color(167, 139, 250), k.opacity(0.5), k.z(-1) ]);
  }

  // 4) Decorações pontuais — densidade reduzida 12% → 7% (longe de paths/edges).
  // Circuit doodads (cyan lines + violet circles em ~14% dos tiles) FORAM REMOVIDOS:
  // somavam ~100 entidades de ruído visual.
  for (let y = 2; y < ROWS - 2; y++) {
    for (let x = 2; x < COLS - 2; x++) {
      if (x === SPAWN_X || y === SPAWN_Y) continue; // path
      const seed = rand(x, y);
      if (seed < 0.07) {
        const kind = Math.floor(seed * 1000) % 5;
        drawFloorDecoration(k, x * TILE + TILE / 2, y * TILE + TILE / 2, kind, seed);
      }
    }
  }

  // 5) Grid lines — onDraw é fine pra draws estáticos (mesmo que rode por frame).
  // ~70 drawLine não é o gargalo (era a contagem de entidades).
  k.onDraw(() => {
    for (let x = 0; x <= COLS; x++) {
      const isMajor = x % 5 === 0;
      k.drawLine({
        p1: k.vec2(x * TILE, 0),
        p2: k.vec2(x * TILE, H),
        color: k.rgb(34, 211, 238),
        opacity: isMajor ? 0.12 : 0.04,
        width: 1,
      });
    }
    for (let y = 0; y <= ROWS; y++) {
      const isMajor = y % 5 === 0;
      k.drawLine({
        p1: k.vec2(0, y * TILE),
        p2: k.vec2(W, y * TILE),
        color: k.rgb(34, 211, 238),
        opacity: isMajor ? 0.12 : 0.04,
        width: 1,
      });
    }
  });
}

// EDUCATIONAL: decorações fixas. 5 tipos. Pulsações foram REMOVIDAS — o
// onUpdate de cada lamp/LED/antena somava ~150 callbacks por frame com Math.sin.
// Agora opacidade fixa derivada do seed (varia entre decorações, mas estática).
// Visual praticamente idêntico, sem CPU por frame.
function drawFloorDecoration(k: K, cx: number, cy: number, kind: number, seed: number) {
  const t = (seed * 6.28) % 6.28;
  // Pseudo-pulse estático: dá variação por decoração sem custo por frame.
  const staticPulse = 0.5 + 0.4 * Math.sin(t);
  if (kind === 0) {
    // Lâmpada (orb cyan suspenso) — opacity estática variando por seed.
    k.add([
      k.circle(4),
      k.pos(cx, cy),
      k.color(34, 211, 238),
      k.opacity(staticPulse),
      k.z(-1),
    ]);
    // halo
    k.add([
      k.circle(8),
      k.pos(cx, cy),
      k.color(34, 211, 238),
      k.opacity(0.12),
      k.z(-2),
    ]);
  } else if (kind === 1) {
    // Painel de servidor pequeno (rect com LEDs estáticos).
    k.add([
      k.rect(14, 18, { radius: 1 }),
      k.pos(cx - 7, cy - 9),
      k.color(20, 30, 55),
      k.outline(1, k.rgb(60, 80, 130)),
      k.z(-1),
    ]);
    for (let i = 0; i < 3; i++) {
      const ledOp = 0.4 + 0.4 * Math.sin(t + i * 0.7);
      k.add([
        k.circle(1),
        k.pos(cx - 4 + i * 3, cy + 4),
        k.color(34, 197, 94),
        k.opacity(ledOp),
        k.z(0),
      ]);
    }
  } else if (kind === 2) {
    // Terminal/monitor (rect com tela cyan)
    k.add([
      k.rect(16, 12, { radius: 1 }),
      k.pos(cx - 8, cy - 8),
      k.color(40, 50, 80),
      k.z(-1),
    ]);
    k.add([
      k.rect(12, 8, { radius: 0.5 }),
      k.pos(cx - 6, cy - 7),
      k.color(34, 211, 238),
      k.opacity(0.3),
      k.z(0),
    ]);
    // base
    k.add([
      k.rect(6, 3),
      k.pos(cx - 3, cy + 4),
      k.color(40, 50, 80),
      k.z(-1),
    ]);
  } else if (kind === 3) {
    // Planta neon (3 circles empilhados)
    k.add([
      k.circle(3),
      k.pos(cx, cy + 5),
      k.color(16, 185, 129),
      k.opacity(0.7),
      k.z(-1),
    ]);
    k.add([
      k.circle(2.5),
      k.pos(cx - 2, cy + 1),
      k.color(16, 185, 129),
      k.opacity(0.6),
      k.z(-1),
    ]);
    k.add([
      k.circle(2),
      k.pos(cx + 2, cy - 2),
      k.color(110, 231, 183),
      k.opacity(0.7),
      k.z(0),
    ]);
  } else {
    // Antena/torre (linha + circle no topo, opacity estática).
    k.add([
      k.rect(1, 14),
      k.pos(cx, cy - 7),
      k.color(167, 139, 250),
      k.opacity(0.6),
      k.z(-1),
    ]);
    k.add([
      k.circle(2.5),
      k.pos(cx, cy - 8),
      k.color(167, 139, 250),
      k.opacity(staticPulse),
      k.z(0),
    ]);
    // base
    k.add([
      k.rect(6, 3),
      k.pos(cx - 3, cy + 5),
      k.color(50, 60, 100),
      k.z(-1),
    ]);
  }
}

function spawnAmbientParticles(k: K) {
  // EDUCATIONAL: pontos lentos atravessam o mapa, sugerindo "dados em trânsito".
  // Densidade reduzida (12 + 1.2s loop) — antes era 18 + 0.6s e o mapa parecia uma chuva.
  for (let i = 0; i < 12; i++) {
    spawnAmbientParticle(k);
  }
  k.loop(1.2, () => spawnAmbientParticle(k));
}

function spawnAmbientParticle(k: K) {
  const fromLeft = Math.random() < 0.5;
  const y = Math.random() * H;
  const speed = 8 + Math.random() * 16;
  const colors = [
    [34, 211, 238],
    [167, 139, 250],
    [16, 185, 129],
  ];
  const c = colors[Math.floor(Math.random() * colors.length)];
  const p = k.add([
    k.circle(1 + Math.random() * 1.2),
    k.pos(fromLeft ? -4 : W + 4, y),
    k.color(c[0], c[1], c[2]),
    k.opacity(0.25 + Math.random() * 0.25),
    k.move(k.vec2(fromLeft ? 1 : -1, 0), speed),
    k.lifespan(W / speed + 1),
    k.z(-1),
  ]);
  return p;
}

// ===== Player (DevOps) =====
type PlayerAction = 'idle' | 'build' | 'update' | 'delete' | 'happy';

// EDUCATIONAL: ícone da ferramenta atual na mão direita do player.
// Sempre visível em idle, ajuda o jogador a saber QUAL operação vai disparar.
function drawToolInHand(k: K, tool: Tool, x: number, y: number) {
  if (tool === 'build') {
    // Martelo de construção: cabo marrom + cabeça cinza
    k.drawRect({ pos: k.vec2(x - 2, y - 2), width: 5, height: 3, color: k.rgb(120, 120, 130), radius: 0.5 });
    k.drawRect({ pos: k.vec2(x + 0.2, y + 1), width: 1.2, height: 4, color: k.rgb(101, 67, 33) });
  } else if (tool === 'upgrade') {
    // Martelo dourado: cabo âmbar + cabeça dourada com brilho
    k.drawRect({ pos: k.vec2(x - 2, y - 2), width: 5, height: 3, color: k.rgb(251, 191, 36), radius: 0.5 });
    k.drawRect({ pos: k.vec2(x + 0.2, y + 1), width: 1.2, height: 4, color: k.rgb(180, 130, 40) });
    // glint
    k.drawRect({ pos: k.vec2(x - 1.4, y - 1.6), width: 1.2, height: 0.6, color: k.rgb(254, 240, 138), opacity: 0.85 });
  } else if (tool === 'delete') {
    // Bomba: esfera escura + pavio + faísca
    k.drawCircle({ pos: k.vec2(x + 0.5, y + 1), radius: 2.4, color: k.rgb(28, 28, 38) });
    k.drawCircle({ pos: k.vec2(x + 0.5, y + 1), radius: 2.4, fill: false, outline: { width: 0.6, color: k.rgb(244, 63, 94) } });
    // pavio
    k.drawRect({ pos: k.vec2(x + 0.2, y - 2), width: 0.8, height: 1.6, color: k.rgb(101, 67, 33) });
    // faísca pulsando levemente
    const sparkSize = 0.7 + 0.3 * Math.abs(Math.sin(k.time() * 8));
    k.drawCircle({ pos: k.vec2(x + 0.6, y - 2.4), radius: sparkSize, color: k.rgb(244, 63, 94) });
  } else if (tool === 'inspect') {
    // Lupa: aro cyan vazio + cabo marrom diagonal
    k.drawCircle({ pos: k.vec2(x, y), radius: 2.2, fill: false, outline: { width: 0.8, color: k.rgb(34, 211, 238) } });
    k.drawCircle({ pos: k.vec2(x, y), radius: 1.8, color: k.rgb(34, 211, 238), opacity: 0.18 });
    // cabo
    k.drawRect({ pos: k.vec2(x + 1.6, y + 1.6), width: 2.4, height: 0.9, color: k.rgb(101, 67, 33), radius: 0.4 });
  }
}

function drawDevopsSprite(
  k: K, frame: number, dir: Direction, bobble: number, custom: PlayerCustom,
  action: PlayerAction = 'idle', actionT: number = 0, happyT: number = 0,
  tool: Tool = 'build',
) {
  // EDUCATIONAL: sprite procedural com 5 modos de ação. Cores customizáveis.
  const shirt = PLAYER_PRESETS.shirt[custom.shirt];
  const hat = PLAYER_PRESETS.hat[custom.hat];
  const skin = PLAYER_PRESETS.skin[custom.skin];

  // happy = pulinhos sin + corações ao redor
  const happyBounce = action === 'happy' ? Math.abs(Math.sin(happyT * 6)) * 5 : 0;
  // build = recuo + braço subindo (martelo). actionT 0..0.4
  const buildPhase = action === 'build' ? Math.sin((actionT / 0.4) * Math.PI) : 0;
  // delete = leve crouch
  const crouch = action === 'delete' ? Math.sin((actionT / 0.4) * Math.PI) * 2 : 0;
  // update = vibração rápida
  const updateVib = action === 'update' ? Math.sin(actionT * 40) * 0.7 : 0;

  // sombra (achata em happy bounce)
  k.drawEllipse({
    pos: k.vec2(0 + updateVib, 14 + happyBounce),
    radiusX: 9 - happyBounce * 0.3, radiusY: 2.5 - happyBounce * 0.15,
    color: k.rgb(0, 0, 0), opacity: 0.5 - happyBounce * 0.04,
  });

  const offY = -happyBounce + crouch; // sobe em happy, desce em delete
  const bob = Math.sin(bobble) * 0.7 + offY;
  const legOffset = [0, 1.5, 0, -1.5][frame] ?? 0;

  // pernas (mais juntas em delete)
  const legSpread = action === 'delete' ? 0 : 0;
  k.drawRect({ pos: k.vec2(-5 - legSpread + updateVib, 7 + legOffset + offY), width: 4, height: 7, color: k.rgb(15, 23, 42), radius: 1 });
  k.drawRect({ pos: k.vec2(1 + legSpread + updateVib, 7 - legOffset + offY), width: 4, height: 7, color: k.rgb(15, 23, 42), radius: 1 });

  // corpo (camisa)
  k.drawRect({ pos: k.vec2(-7 + updateVib, -3 + bob), width: 14, height: 11, color: k.rgb(...shirt.rgb), radius: 2 });
  k.drawRect({ pos: k.vec2(-1 + updateVib, 0 + bob), width: 2, height: 5, color: k.rgb(...shirt.accent), opacity: 0.85 });

  // braços — gestos por action:
  //  build: braço direito sobe alto (martelo)
  //  delete: ambos braços pra baixo (catando)
  //  happy: ambos pra cima (comemorando)
  //  update: tremem
  const armRaise = action === 'build' ? buildPhase * 8 : action === 'happy' ? 6 : 0;
  const armRaiseLeft = action === 'happy' ? 6 : 0;
  k.drawRect({
    pos: k.vec2(-9 + updateVib, -2 + bob + (frame % 2 === 0 ? 0 : 1) - armRaiseLeft),
    width: 3, height: 8, color: k.rgb(...shirt.rgb), radius: 1,
  });
  k.drawRect({
    pos: k.vec2(6 + updateVib, -2 + bob - (frame % 2 === 0 ? 0 : 1) - armRaise),
    width: 3, height: 8, color: k.rgb(...shirt.rgb), radius: 1,
  });

  // martelo na mão direita quando build em ação (animação grande do swing)
  if (action === 'build' && buildPhase > 0.2) {
    const hammerY = -2 + bob - armRaise - 4;
    k.drawRect({ pos: k.vec2(5, hammerY), width: 5, height: 4, color: k.rgb(120, 120, 130), radius: 1 });
    k.drawRect({ pos: k.vec2(7, hammerY + 4), width: 1.5, height: 5, color: k.rgb(101, 67, 33) });
  } else if (action === 'idle') {
    // EDUCATIONAL: ferramenta na mão direita reflete `tool` selecionada.
    // Hammer / Hammer dourado / Bomba / Lupa — referência visual contínua.
    drawToolInHand(k, tool, 7 + updateVib, 2 + bob);
  }

  // cabeça
  k.drawRect({ pos: k.vec2(-5 + updateVib, -12 + bob), width: 10, height: 9, color: k.rgb(...skin.rgb), radius: 2 });

  // olhos — happy = olhos fechados/sorrindo
  const eye = (x: number, y: number, w = 1.6, h = 1.6) =>
    k.drawRect({ pos: k.vec2(x + updateVib, y + bob), width: w, height: h, color: k.rgb(15, 23, 42) });
  if (action === 'happy') {
    // ^ ^ olhos felizes
    k.drawRect({ pos: k.vec2(-4 + updateVib, -8 + bob), width: 3, height: 0.8, color: k.rgb(15, 23, 42) });
    k.drawRect({ pos: k.vec2(1 + updateVib, -8 + bob), width: 3, height: 0.8, color: k.rgb(15, 23, 42) });
    // sorriso
    k.drawRect({ pos: k.vec2(-2 + updateVib, -5 + bob), width: 4, height: 1, color: k.rgb(15, 23, 42), radius: 0.5 });
  } else {
    if (dir === 'down') { eye(-3, -8); eye(2, -8); }
    if (dir === 'up') { eye(-3, -10, 1.6, 1); eye(2, -10, 1.6, 1); }
    if (dir === 'left') { eye(-4, -8, 2, 1.6); }
    if (dir === 'right') { eye(2, -8, 2, 1.6); }
  }

  // hat
  if (hat.rgb) {
    k.drawRect({ pos: k.vec2(-6 + updateVib, -16 + bob), width: 12, height: 5, color: k.rgb(...hat.rgb), radius: 3 });
    if (hat.shade) {
      k.drawRect({ pos: k.vec2(-7 + updateVib, -12 + bob), width: 14, height: 1.5, color: k.rgb(...hat.shade) });
    }
    k.drawRect({ pos: k.vec2(-3 + updateVib, -15 + bob), width: 3, height: 1, color: k.rgb(255, 255, 255), opacity: 0.6 });
  }

  // happy: corações flutuando ao redor
  if (action === 'happy') {
    for (let i = 0; i < 3; i++) {
      const ht = (happyT + i * 0.7) % 2;
      const angle = (i * Math.PI * 2) / 3 + happyT * 0.5;
      const r = 14 + ht * 12;
      const opacity = Math.max(0, 1 - ht / 2);
      k.drawRect({
        pos: k.vec2(Math.cos(angle) * r - 1.5, Math.sin(angle) * r - 18 - 1.5),
        width: 3, height: 3,
        color: k.rgb(244, 63, 94),
        opacity: opacity * 0.9,
        radius: 1.5,
      });
    }
  }
}

// ===== Object node (renderiza casa por nível: casa.png / casav2.png / casa v3.png) =====
function makeObjectNode(k: K, o: Objeto) {
  // EDUCATIONAL: drop-from-sky entrance. Tag 'obj-node' permite varredura
  // por tile no DELETE — garante que NENHUM fantasma sobreviva.
  const cx = o.pos_x * TILE + TILE / 2;
  const cy = o.pos_y * TILE + TILE / 2;
  const node = k.add([
    k.pos(cx, cy - 80),
    k.anchor('center'),
    k.scale(0.3),
    k.opacity(0),
    k.z(0),
    'obj-node',
    {
      objStatus: o.status,
      objTipo: o.tipo,
      objLevel: clampLevel(o.level),
      tileX: o.pos_x,
      tileY: o.pos_y,
      objId: o.id,
      pulseT: 0,
      update() {
        this.pulseT += k.dt() * 2;
      },
      draw() {
        drawHouseByLevel(k, this.objLevel, this.objTipo, this.objStatus, this.pulseT);
      },
    },
  ]);
  // EDUCATIONAL: queda + bounce + scale-up em paralelo. Tudo sincronizado num
  // único hook update do node — assim, ao destruir o nó (DELETE rápido após CREATE)
  // os tweens param junto, sem deixar fantasma cyan no mapa.
  let entranceT = 0;
  const ENTRANCE_DUR = 0.45;
  const startY = cy - 80;
  let shockwaveSpawned = false;
  node.onUpdate(() => {
    if (entranceT >= ENTRANCE_DUR) return;
    entranceT += k.dt();
    const t = Math.min(1, entranceT / ENTRANCE_DUR);
    // bounce easing manual (aproxima easeOutBounce)
    const bounceY = t < 0.7
      ? 1 - Math.pow(1 - t / 0.7, 2)
      : 1 - Math.abs(Math.sin((t - 0.7) * 10)) * 0.08;
    node.pos.y = startY + (cy - startY) * bounceY;
    // scale com overshoot
    const s = t < 0.5
      ? 0.3 + (1.15 - 0.3) * (t / 0.5)
      : 1.15 - (1.15 - 1) * ((t - 0.5) / 0.5);
    node.scale = k.vec2(s, s);
    node.opacity = Math.min(1, t * 4);
    // shockwave dispara quando aterrissa (~70% do entrance)
    if (!shockwaveSpawned && t >= 0.7) {
      shockwaveSpawned = true;
      spawnShockwave(k, node.pos.x, node.pos.y);
    }
  });
  return node;
}

// EDUCATIONAL: shockwave circular expandindo — feedback "objeto aterrissou".
function spawnShockwave(k: K, x: number, y: number) {
  const ring = k.add([
    k.circle(4),
    k.pos(x, y),
    k.color(34, 211, 238),
    k.opacity(0.6),
    k.outline(2, k.rgb(255, 255, 255)),
    k.scale(0.3),
    k.anchor('center'),
    k.lifespan(0.5, { fade: 0.4 }),
    k.z(2),
    { fill: false },
  ]);
  k.tween(0.3, 4, 0.45, (v: number) => (ring.scale = k.vec2(v, v)), k.easings.easeOutQuad);
}

// EDUCATIONAL: texto flutuante estilo RPG (+1 servidor, novo→ativo, etc).
function spawnFloatingText(k: K, label: string, tileX: number, tileY: number, rgb: [number, number, number], size = 10) {
  const x = tileX * TILE + TILE / 2;
  const y = tileY * TILE - 4;
  const txt = k.add([
    k.text(label, { size }),
    k.pos(x, y),
    k.anchor('center'),
    k.color(...rgb),
    k.opacity(1),
    k.move(k.vec2(0, -1), 28),
    k.lifespan(1.4, { fade: 1 }),
    k.z(7),
  ]);
  // pequeno overshoot no scale pra dar destaque
  txt.scale = k.vec2(0.5, 0.5);
  k.tween(0.5, 1.15, 0.18, (v: number) => (txt.scale = k.vec2(v, v)), k.easings.easeOutBack);
  k.wait(0.18, () => k.tween(1.15, 1, 0.12, (v: number) => (txt.scale = k.vec2(v, v))));
}

// EDUCATIONAL: corações flutuantes saindo do dog quando recebe carinho.
// Visual de "amor" — corações rosados subindo + dispersando.
function spawnPetHearts(k: K, x: number, y: number) {
  for (let i = 0; i < 8; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
    const speed = 35 + Math.random() * 30;
    const heartSize = 2 + Math.random() * 1.5;
    const drift = (Math.random() - 0.5) * 30;
    const heart = k.add([
      k.rect(heartSize, heartSize, { radius: heartSize / 3 }),
      k.pos(x + (Math.random() - 0.5) * 12, y - 8),
      k.color(244, 63, 94),
      k.opacity(1),
      k.move(k.vec2(Math.cos(angle), Math.sin(angle)), speed),
      k.lifespan(1.4, { fade: 1.0 }),
      k.z(8),
      { driftX: drift, t: 0 },
    ]);
    heart.onUpdate(() => {
      heart.t += k.dt();
      heart.pos.x += Math.sin(heart.t * 6) * heart.driftX * k.dt() * 0.3;
    });
  }
}

// EDUCATIONAL: explosão dourada — partículas saindo do centro pra fora.
// Usado em level-up junto com as estrelas e o ring pra dar peso visual.
function spawnLevelUpBurst(k: K, x: number, y: number) {
  for (let i = 0; i < 22; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 90 + Math.random() * 110;
    const isGold = Math.random() < 0.65;
    const c: [number, number, number] = isGold ? [253, 224, 71] : [251, 191, 36];
    const p = k.add([
      k.circle(1.5 + Math.random() * 2),
      k.pos(x, y),
      k.color(...c),
      k.opacity(1),
      k.move(k.vec2(Math.cos(angle), Math.sin(angle)), speed),
      k.lifespan(0.7, { fade: 0.5 }),
      k.z(4),
    ]);
    p.onUpdate(() => { p.opacity = Math.max(0, p.opacity - k.dt() * 1.4); });
  }
  // halo expandindo
  const halo = k.add([
    k.circle(8),
    k.pos(x, y),
    k.color(253, 224, 71),
    k.opacity(0.55),
    k.outline(2, k.rgb(254, 240, 138)),
    k.scale(0.4),
    k.anchor('center'),
    k.lifespan(0.55, { fade: 0.4 }),
    k.z(3),
  ]);
  k.tween(0.4, 3.2, 0.5, (v: number) => (halo.scale = k.vec2(v, v)), k.easings.easeOutQuad);
}

// EDUCATIONAL: estrelas rotantes ao redor do objeto — efeito level-up.
function spawnLevelUpStars(k: K, x: number, y: number, rgb: [number, number, number]) {
  for (let i = 0; i < 6; i++) {
    const angle0 = (Math.PI * 2 * i) / 6;
    const star = k.add([
      k.rect(3, 3, { radius: 0.5 }),
      k.pos(x, y),
      k.anchor('center'),
      k.rotate(45),
      k.color(...rgb),
      k.opacity(1),
      k.lifespan(0.7, { fade: 0.5 }),
      k.z(4),
      { t: 0, baseAngle: angle0 },
    ]);
    star.onUpdate(() => {
      star.t += k.dt();
      const r = 6 + star.t * 50;
      star.pos = k.vec2(x + Math.cos(star.baseAngle + star.t * 6) * r, y + Math.sin(star.baseAngle + star.t * 6) * r);
      star.angle = (star.angle ?? 0) + k.dt() * 720;
    });
  }
}

// EDUCATIONAL: camera shake leve. Simples deslocamento decay-exponencial.
function cameraShake(k: K, magnitude: number, durationS: number) {
  const cur = k.getCamPos();
  const baseX = cur.x;
  const baseY = cur.y;
  let t = 0;
  const shaker = k.add([{ update() { /* placeholder, controlled below */ } }]);
  shaker.onUpdate(() => {
    t += k.dt();
    if (t >= durationS) { shaker.destroy(); return; }
    const decay = 1 - t / durationS;
    const dx = (Math.random() - 0.5) * 2 * magnitude * decay;
    const dy = (Math.random() - 0.5) * 2 * magnitude * decay;
    const cp = k.getCamPos();
    k.setCamPos(k.vec2(cp.x + dx, cp.y + dy));
    // restaura no fim
    if (t + k.dt() >= durationS) {
      k.setCamPos(k.vec2(baseX, baseY));
    }
  });
}

// EDUCATIONAL: cada UPDATE evolui visualmente a casa: nv1 → nv2 → nv3.
// Sprites pixel-art em /public (casa.png / casav2.png / casa v3.png).
// O badge do tipo (servidor/banco/cache/router) fica num círculo no canto.
function drawHouseByLevel(k: K, level: Level, tipo: Tipo, status: Status, pulseT: number) {
  const t = TIPO_META[tipo].color;
  const s = STATUS_META[status].color;
  const isMax = level === 3;
  const blink = status === 'critico' ? 0.5 + 0.5 * Math.sin(pulseT * 4) : 1;

  // GLOW base — cor do tipo, atrás de tudo, intensifica com level
  k.drawCircle({
    pos: k.vec2(0, 0),
    radius: (TILE - 4) / 2 * (1 + (level - 1) * 0.06),
    color: k.rgb(...t),
    opacity: (0.05 + (level - 1) * 0.05) * blink,
  });

  // Faíscas ambiente em level >= 2 — orbita dando vida.
  if (level >= 2) {
    const sparkN = isMax ? 4 : 2;
    for (let i = 0; i < sparkN; i++) {
      const ang = pulseT * 1.5 + (i * Math.PI * 2) / sparkN;
      const r = 16 + Math.sin(pulseT * 3 + i) * 3;
      k.drawCircle({
        pos: k.vec2(Math.cos(ang) * r, Math.sin(ang) * r),
        radius: 1 + level * 0.2,
        color: k.rgb(...t),
        opacity: 0.4 + 0.4 * Math.abs(Math.sin(pulseT * 4 + i)),
      });
    }
  }

  // Halo de status (quadrado arredondado por trás da casa)
  const haloW = (TILE - 6) * (1 + (level - 1) * 0.04);
  k.drawRect({
    pos: k.vec2(-haloW / 2, -haloW / 2),
    width: haloW, height: haloW,
    color: k.rgb(s[0], s[1], s[2]),
    opacity: 0.18 * blink + (level - 1) * 0.04,
    radius: 6,
  });
  k.drawRect({
    pos: k.vec2(-haloW / 2, -haloW / 2),
    width: haloW, height: haloW,
    fill: false,
    outline: { width: 2 + (level - 1) * 0.5, color: k.rgb(s[0], s[1], s[2]), opacity: 0.85 * blink },
    radius: 6,
  });

  // ===== Sprite da casa =====
  // O `level` mapeia direto pro sprite ID (casa1/casa2/casa3) carregado no init.
  // Se o sprite ainda não estiver pronto (load assíncrono), drawSprite só não desenha
  // — o halo continua visível, sem crash.
  const spriteId = `casa${level}`;
  try {
    k.drawSprite({
      sprite: spriteId,
      pos: k.vec2(0, 0),
      anchor: 'center',
      width: TILE - 8,
      height: TILE - 8,
    });
  } catch {
    // fallback: bloquinho simples se sprite ainda não carregou
    k.drawRect({
      pos: k.vec2(-(TILE - 14) / 2, -(TILE - 14) / 2),
      width: TILE - 14, height: TILE - 14,
      color: k.rgb(...t),
      radius: 2,
    });
  }

  // ===== Badge do tipo (canto superior direito) =====
  // Identifica QUE tipo de casa é, sem competir com o sprite principal.
  const badgeX = (TILE - 14) / 2;
  const badgeY = -(TILE - 14) / 2;
  k.drawCircle({
    pos: k.vec2(badgeX, badgeY),
    radius: 5,
    color: k.rgb(...t),
    outline: { width: 1, color: k.rgb(15, 23, 42) },
  });
  // letra do tipo dentro do badge — s/b/c/r
  const letter = tipo === 'servidor' ? 'S' : tipo === 'banco' ? 'B' : tipo === 'cache' ? 'C' : 'R';
  k.drawText({
    text: letter,
    pos: k.vec2(badgeX - 2, badgeY - 3),
    size: 7,
    color: k.rgb(15, 23, 42),
  });

  // Glow extra no nível máximo — anel pulsante
  if (isMax) {
    k.drawRect({
      pos: k.vec2(-(TILE - 2) / 2, -(TILE - 2) / 2),
      width: TILE - 2, height: TILE - 2,
      fill: false,
      outline: { width: 1, color: k.rgb(167, 139, 250), opacity: 0.4 + 0.2 * Math.sin(pulseT * 1.5) },
      radius: 8,
    });
  }
}

// ===== Effects =====
function flashTile(k: K, tx: number, ty: number, rgb: [number, number, number]) {
  k.add([
    k.rect(TILE, TILE, { radius: 4 }),
    k.pos(tx * TILE, ty * TILE),
    k.color(rgb[0], rgb[1], rgb[2]),
    k.opacity(0.7),
    k.z(2),
    k.lifespan(0.55, { fade: 0.45 }),
  ]);
}

function spawnCreateParticles(k: K, x: number, y: number) {
  for (let i = 0; i < 14; i++) {
    const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.2;
    const speed = 70 + Math.random() * 70;
    const p = k.add([
      k.circle(2 + Math.random() * 2),
      k.pos(x, y),
      k.color(16, 185, 129),
      k.opacity(1),
      k.move(k.vec2(Math.cos(angle), Math.sin(angle)), speed),
      k.lifespan(0.6, { fade: 0.4 }),
      k.z(3),
    ]);
    p.onUpdate(() => { p.opacity = Math.max(0, p.opacity - k.dt() * 1.4); });
  }
}

function spawnDeleteParticles(k: K, x: number, y: number) {
  for (let i = 0; i < 18; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 100;
    const p = k.add([
      k.rect(2 + Math.random() * 3, 2 + Math.random() * 3),
      k.pos(x, y),
      k.color(244, 63, 94),
      k.opacity(1),
      k.move(k.vec2(Math.cos(angle), Math.sin(angle)), speed),
      k.lifespan(0.7, { fade: 0.5 }),
      k.z(3),
    ]);
    p.onUpdate(() => { p.opacity = Math.max(0, p.opacity - k.dt() * 1.5); });
  }
}

function spawnUpdateRing(k: K, x: number, y: number) {
  for (let i = 0; i < 3; i++) {
    const ring = k.add([
      k.circle(8),
      k.pos(x, y),
      k.color(251, 191, 36),
      k.opacity(0.8),
      k.outline(2, k.rgb(251, 191, 36)),
      k.scale(0.3),
      k.anchor('center'),
      k.lifespan(0.8, { fade: 0.6 }),
      k.z(3),
    ]);
    k.wait(i * 0.1, () => {
      k.tween(0.3, 2.5, 0.6, (v: number) => (ring.scale = k.vec2(v, v)), k.easings.easeOutQuad);
    });
  }
}

function spawnReadWaves(k: K, x: number, y: number) {
  for (let i = 0; i < 3; i++) {
    const wave = k.add([
      k.circle(6),
      k.pos(x, y),
      k.color(34, 211, 238),
      k.opacity(0.7),
      k.outline(2, k.rgb(34, 211, 238)),
      k.scale(0.3),
      k.anchor('center'),
      k.lifespan(1.0, { fade: 0.7 }),
      k.z(3),
    ]);
    k.wait(i * 0.15, () => {
      k.tween(0.3, 4, 0.9, (v: number) => (wave.scale = k.vec2(v, v)), k.easings.easeOutQuad);
    });
  }
}

function spawnSqlBubble(k: K | null, label: string, tileX: number, tileY: number, rgb: [number, number, number]) {
  if (!k) return;
  // EDUCATIONAL: bolha flutuante mostra o que aconteceu, in-world.
  const x = tileX * TILE + TILE / 2;
  const y = tileY * TILE - 2;
  const bubble = k.add([
    k.text(label, { size: 9 }),
    k.pos(x, y),
    k.anchor('center'),
    k.color(rgb[0], rgb[1], rgb[2]),
    k.opacity(1),
    k.move(k.vec2(0, -1), 24),
    k.lifespan(1.4, { fade: 0.9 }),
    k.z(6),
  ]);
  bubble.onUpdate(() => { bubble.opacity = Math.max(0, bubble.opacity - k.dt() * 0.55); });
}

// EDUCATIONAL: pacote de dados viajando entre dois pontos. Visual "rede ativa".
// Disparado em loop a cada ~5s entre 2 NPCs aleatórios pelo init do GameEngine.
function spawnDataPacketBeam(k: K, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const speed = 220; // px/s
  const dur = Math.max(0.3, dist / speed);
  const colors: Array<[number, number, number]> = [
    [34, 211, 238], [167, 139, 250], [16, 185, 129], [251, 191, 36],
  ];
  const c = colors[Math.floor(Math.random() * colors.length)];
  // halo de partida
  k.add([
    k.circle(4),
    k.pos(x1, y1),
    k.color(...c),
    k.opacity(0.7),
    k.lifespan(0.4, { fade: 0.3 }),
    k.z(2),
  ]);
  // pacote em si
  const packet = k.add([
    k.circle(2.5),
    k.pos(x1, y1),
    k.color(...c),
    k.opacity(0.95),
    k.outline(1, k.rgb(255, 255, 255)),
    k.lifespan(dur + 0.1, { fade: 0 }),
    k.z(3),
    {
      vx: dx / dur,
      vy: dy / dur,
      update() {
        this.pos.x += this.vx * k.dt();
        this.pos.y += this.vy * k.dt();
      },
    },
  ]);
  // trail: deixa pequenas circles que somem
  let trailT = 0;
  packet.onUpdate(() => {
    trailT += k.dt();
    if (trailT > 0.04) {
      trailT = 0;
      k.add([
        k.circle(1.6),
        k.pos(packet.pos.x, packet.pos.y),
        k.color(...c),
        k.opacity(0.55),
        k.lifespan(0.4, { fade: 0.3 }),
        k.z(2),
      ]);
    }
  });
  // pulso de chegada
  k.wait(dur, () => {
    k.add([
      k.circle(3),
      k.pos(x2, y2),
      k.color(...c),
      k.opacity(0.8),
      k.outline(1, k.rgb(...c)),
      k.lifespan(0.5, { fade: 0.4 }),
      k.scale(1),
      k.z(2),
    ]);
  });
}

// ============================================================================
// NPCs ambiente — dão vida ao mapa, soltam quotes idle e curiosidades no INSPECT.
// ============================================================================
// EDUCATIONAL: cada curiosidade tem 2 camadas — short (headline 1 linha, animada com
// typewriter no modal) e detail (parágrafo explicativo, aparece embaixo após digitação).
// Conteúdo extraído da lista das 100 curiosidades AWS+SQL, mapeado por tema do role.
type Curiosity = { short: string; detail: string };

type NpcPreset = {
  tileX: number; tileY: number;
  shirt: [number, number, number];
  hat: [number, number, number] | null;
  role: string;
  quotes: string[];          // idle (no canvas, bubble curta)
  curiosities: Curiosity[];  // INSPECT (modal, com tipografia animada)
};

const NPC_PRESETS: NpcPreset[] = [
  {
    tileX: 2, tileY: 2, role: 'DBA',
    shirt: [167, 139, 250], hat: [251, 191, 36],
    quotes: [
      'Minha vida é baseada em ACID: Atomicidade, Consistência, Isolamento e Durabilidade.',
      'Índices salvam vidas (e a performance do banco).',
      'Normalização é a arte de não repetir a mesma coisa dez vezes.',
      'GROUP BY: unindo o que o caos separou.',
    ],
    curiosities: [
      {
        short: 'WHERE filtra: sem ele, UPDATE/DELETE acerta a tabela TODA',
        detail: 'Sem WHERE, o banco aplica em TODAS as linhas. UPDATE users SET active=false sem WHERE? Deslogou todo mundo. DELETE sem WHERE? Não tem lixeira — recovery via backup, se houver. Em produção, isso já demitiu muita gente.',
      },
      {
        short: 'INDEX em col WHERE = SELECT até 100× mais rápido',
        detail: 'Sem índice, o banco lê a tabela inteira (full table scan). Com índice, vai direto pra linha via B-tree. Mas índice tem custo: cada INSERT/UPDATE precisa atualizar o índice também — então crie só nas colunas que você filtra/ordena de verdade.',
      },
      {
        short: 'ACID: Atomic · Consistent · Isolated · Durable',
        detail: 'Atomic: tudo ou nada, sem meio-caminho. Consistent: regras (NOT NULL, FK, etc) nunca são violadas. Isolated: transações concorrentes não veem o meio uma da outra. Durable: depois do COMMIT, os dados sobrevivem mesmo se o servidor cair imediatamente.',
      },
      {
        short: 'PRIMARY KEY é UNIQUE + NOT NULL automático',
        detail: 'PK identifica unicamente uma linha. Pode ser id sintético (AUTO_INCREMENT) ou natural (cpf, email). Cada tabela tem no máximo 1 PK. Outras colunas únicas usam UNIQUE constraint. PK ganha índice grátis.',
      },
      {
        short: 'GROUP BY agrupa · HAVING filtra grupos · ORDER BY ordena',
        detail: 'WHERE filtra antes de agrupar; HAVING filtra depois. Ex: SELECT cidade, COUNT(*) FROM users GROUP BY cidade HAVING COUNT(*) > 100 — só cidades com mais de 100 usuários. ORDER BY no final.',
      },
      {
        short: 'normalização evita redundância · desnormaliza só pra performance',
        detail: 'Normalizar = quebrar dados em tabelas pequenas conectadas via FK. Evita "endereço do user repetido em N pedidos". Mas JOINs custam — em apps de leitura pesada, desnormalize pontualmente (dado duplicado mas leitura rápida).',
      },
    ],
  },
  {
    tileX: COLS - 3, tileY: 2, role: 'SecOps',
    shirt: [225, 29, 72], hat: [16, 185, 129],
    quotes: [
      'SQL Injection não é vacina, cuidado com seus inputs!',
      'IAM: Quem é você e o que pensa que está acessando?',
      'Não esqueça o WHERE no seu DELETE, ou o RH te deleta!',
    ],
    curiosities: [
      {
        short: 'SQL injection já roubou bancos inteiros — use prepared statements',
        detail: 'Concatenar input em query é catastrófico: WHERE id = ${input} pode virar 1; DROP TABLE users. Use placeholders: query("WHERE id = ?", [input]) — o driver escapa caracteres perigosos por você. mysql2 e quase todos os SDKs suportam.',
      },
      {
        short: 'CSRF token previne POST forjado de outro site',
        detail: 'Sem CSRF token, um site malicioso pode fazer seu navegador postar em outro app onde você está logado (ataque de Cross-Site Request Forgery). O token é um valor único por sessão que o servidor exige nas mutações — request de outro site não tem como adivinhar.',
      },
      {
        short: 'rate-limit por IP barra 99% dos brute-force',
        detail: 'Limite a quantidade de requests por IP por minuto. 5 logins falhados em 60s? Bloqueia 10 min. 100 GETs por segundo? Throttle. Não impede ataque distribuído (DDoS), mas barra script kiddie e bot trivial.',
      },
      {
        short: 'TLS criptografa a query no caminho até o RDS',
        detail: 'Sem TLS, qualquer um na rede vê suas queries (e senhas). Com TLS, é túnel cifrado entre browser/server e DB. AWS RDS usa TLS por padrão; o cert vai num bundle (rds-global-bundle.pem) que o driver valida.',
      },
      {
        short: 'AWS Shield protege contra ataques DDoS',
        detail: 'Shield Standard é grátis e bloqueia ataques comuns automaticamente na borda da AWS. Shield Advanced (~$3k/mês) tem proteção contra ataques de aplicação e crédito de bill em caso de spike. SYN flood, UDP flood etc são barrados sem você fazer nada.',
      },
      {
        short: 'AWS Secrets Manager guarda credenciais com rotação automática',
        detail: 'Não hardcode senha no código nem no .env commitado. Secrets Manager guarda criptografado, rotaciona automaticamente (ex: troca senha do RDS toda semana), e os apps puxam via IAM. Sem chave em config = sem leak por descuido.',
      },
    ],
  },
  {
    tileX: 2, tileY: ROWS - 3, role: 'Cloud',
    shirt: [4, 120, 87], hat: [34, 211, 238],
    quotes: [
      'A nuvem nada mais é do que o computador de outra pessoa.',
      'S3: O balde que nunca transborda (mas a conta cresce).',
      'Minha EC2 está mais lenta que segunda-feira de manhã.',
      'Região vs. Zona de Disponibilidade: redundância nunca é demais.',
    ],
    curiosities: [
      {
        short: 'AWS RDS = MySQL gerenciado: backup/patch/replica automáticos',
        detail: 'Você não precisa instalar MySQL nem administrar SO. RDS faz: backup diário (até 35 dias de retenção), patch de segurança, replica de leitura, failover Multi-AZ. Você foca em queries; AWS cuida do servidor.',
      },
      {
        short: 'Aurora é fork do MySQL pela Amazon, até 5× mais rápido',
        detail: 'Aurora reescreve o storage engine pra usar 6 cópias replicadas em 3 AZs. Replicação é quase instantânea (~10ms). Suporta serverless v2 (escala em segundos). Custa um pouco mais que RDS MySQL, mas vale a pena pra workload sério.',
      },
      {
        short: 'Multi-AZ replica DB em 2+ datacenters (uptime 99.99%)',
        detail: 'Multi-AZ mantém uma cópia standby num AZ diferente. Se o AZ primário cai (raio cai no datacenter, sério), failover automático em <60s. Você paga ~2× pelo storage, mas o app não percebe a queda.',
      },
      {
        short: 'EC2 = servidor virtual sob demanda (pay-per-second)',
        detail: 'EC2 é VM na nuvem. Você escolhe CPU/RAM/disco, dá boot, paga só pelo tempo ligado. t3.micro custa ~$8/mês 24/7. Spot Instances chegam a 90% off — mas a AWS pode tomar de volta com 2 min de aviso.',
      },
      {
        short: 'CloudFront reduz latência globalmente via cache de borda',
        detail: 'CloudFront é a CDN da AWS. Sua imagem/HTML/JSON vai pra ~400 pontos de presença pelo mundo. User no Japão pega do servidor no Japão, não da Virginia. Cache de borda + TLS termination + DDoS protection juntos.',
      },
      {
        short: 'Região da AWS em São Paulo (sa-east-1) tem 3 AZs',
        detail: 'A AWS tem regiões pelo mundo, cada uma com 2-6 AZs (datacenters fisicamente separados). sa-east-1 fica em SP. Latência pra SP é ~5ms; pra Virginia, ~120ms. Use a região mais próxima dos usuários.',
      },
    ],
  },
  {
    tileX: COLS - 3, tileY: ROWS - 3, role: 'Engineer',
    shirt: [194, 65, 12], hat: null,
    quotes: [
      'Você é o PRIMARY KEY do meu coração: único e indispensável.',
      'COMMIT ou ROLLBACK? Eis a questão.',
      'DROP TABLE problemas; — Quem dera fosse assim, né?',
    ],
    curiosities: [
      {
        short: 'AUTO_INCREMENT gera ids únicos sequenciais — não reusa apagados',
        detail: 'Você apaga id=5? O próximo INSERT pega 6, não 5. Isso evita confusão (id 5 não "volta a ser" outra coisa amanhã). Em sistema distribuído, AUTO_INCREMENT vira UUID — ids únicos sem coordenação central.',
      },
      {
        short: 'JOIN une tabelas via FK — evita duplicar dados',
        detail: 'Se cada pedido tem nome+endereço do cliente, você duplica nos N pedidos. Normalize: tabela users (id, nome), tabela orders (id, user_id FK). JOIN une no SELECT: SELECT * FROM orders JOIN users ON orders.user_id = users.id.',
      },
      {
        short: 'transaction = grupo de queries atômico (tudo ou nada)',
        detail: 'BEGIN; UPDATE conta SET saldo = saldo - 100 WHERE id = 1; UPDATE conta SET saldo = saldo + 100 WHERE id = 2; COMMIT; — se a 2ª falhar, ROLLBACK desfaz a 1ª. Sem transação, dinheiro evaporava no meio.',
      },
      {
        short: 'INSERT cria · UPDATE altera · DELETE remove · SELECT lê',
        detail: 'São os 4 verbos do SQL DML. Em REST: POST=INSERT, GET=SELECT, PUT/PATCH=UPDATE, DELETE=DELETE. Esse mapeamento é a base de qualquer app web — você acabou de aprender o esqueleto de 90% dos sistemas comerciais.',
      },
      {
        short: 'NOT NULL + DEFAULT garante linhas sempre íntegras',
        detail: 'Coluna NOT NULL não aceita valor ausente. DEFAULT preenche se não der valor. Ex: created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP — toda linha tem hora de criação automática, sem precisar enviar do app.',
      },
      {
        short: 'DELETE sem WHERE remove TUDO (perigo 😅)',
        detail: 'DELETE FROM users; apaga TODA a tabela. Sem confirmação, sem lixeira. Em prod, SEMPRE faça SELECT antes pra ver o que vai sumir. Ou abra transação: BEGIN; DELETE...; verifica COUNT; COMMIT ou ROLLBACK.',
      },
    ],
  },
  {
    tileX: 10, tileY: 4, role: 'Backend',
    shirt: [15, 118, 110], hat: [167, 139, 250],
    quotes: [
      'Lambda: Por que pagar por um servidor se você só precisa de uma função?',
      'Route 53: O GPS que leva seus pacotes para o lugar certo.',
      'O CloudFront entrega rápido, só não entrega a sua felicidade.',
    ],
    curiosities: [
      {
        short: 'POST cria · PUT idempotente · PATCH parcial · DELETE remove',
        detail: 'POST: cria recurso novo (chamar 2× cria 2). PUT: substitui inteiro de forma idempotente (chamar 2× = mesmo estado final). PATCH: altera campos. Idempotência importa pra retry seguro em rede flaky — POST não pode ser retry-ado às cegas.',
      },
      {
        short: 'HTTP 200 OK · 201 Created · 204 No Content · 404 Not Found',
        detail: '200=sucesso com body. 201=POST criou. 204=sucesso sem body (ex: DELETE OK). 4xx=cliente errou. 5xx=server errou. Use os certos: cliente trata diferente cada faixa. Anti-pattern: 200 com {error: "..."} no corpo.',
      },
      {
        short: 'optimistic update mostra UI antes do server confirmar',
        detail: 'Em vez de esperar a request voltar, atualiza a UI imediatamente (assumindo sucesso). Se der erro, reverte. Sensação de instantâneo. React Query faz isso com onMutate — esse jogo aplica em CREATE/UPDATE/DELETE.',
      },
      {
        short: 'AWS Lambda executa código sem servidor (serverless)',
        detail: 'Você sobe uma função (Node/Python/etc), AWS roda quando tem evento (HTTP, S3, SQS, agendamento). Cobra por ms de execução. Cold start: primeira chamada após inatividade leva 100-500ms. Bom pra batch/event-driven; ruim pra request síncrono crítico.',
      },
      {
        short: 'cache invalidation é o problema mais difícil em CS',
        detail: 'Quote famoso: "There are only two hard things in computer science: cache invalidation and naming things." — Phil Karlton. Cachear é fácil. Saber QUANDO invalidar (sem servir dado velho nem invalidar demais) é arte.',
      },
      {
        short: 'API REST usa URLs como recursos: /users/42/orders/100',
        detail: 'Recursos hierárquicos. /users (lista), /users/42 (um user), /users/42/orders (orders desse user). Verbo HTTP define ação (GET/POST/PUT/DELETE). É a convenção que fez REST dominar (vs SOAP, RPC).',
      },
    ],
  },
  {
    tileX: 18, tileY: 4, role: 'Architect',
    shirt: [67, 56, 202], hat: [244, 63, 94],
    quotes: [
      'No mundo NoSQL, o esquema é não ter esquema.',
      'Auto Scaling é tipo mágica: cresce quando precisa e some quando não tem ninguém.',
      'DynamoDB: Rápido, escalável e às vezes imprevisível.',
    ],
    curiosities: [
      {
        short: 'CAP: Consistency, Availability, Partition tolerance — escolha 2',
        detail: 'Em sistema distribuído com partição de rede, você não pode ter consistência forte E disponibilidade simultaneamente. SQL clássico (RDBMS) = CP (consistente, mas indisponível durante particionamento). DynamoDB = AP (sempre disponível, eventualmente consistente).',
      },
      {
        short: '90% das apps são CRUD com lógica de negócio em cima',
        detail: 'A maioria dos apps são: tela de listagem, criar, editar, apagar. As regras de negócio (preço com desconto, validação, fluxo de aprovação) ficam nessa camada acima. Domine CRUD e você cobre 90% das vagas backend.',
      },
      {
        short: 'read-replica escala leitura · sharding escala escrita',
        detail: 'Replicas de leitura aceitam SELECT (eventualmente consistentes). Escrita continua no master. Pra escalar escrita: sharding (particiona por user_id, região, etc). Sharding é caro de implementar — adia o máximo possível, otimize antes.',
      },
      {
        short: 'eventual consistency: rápido mas pode mostrar dado velho',
        detail: 'Sistemas como DynamoDB priorizam disponibilidade. Você grava em SP, lê em VA, e pode ver versão velha por alguns ms. OK pra timeline de feed; ruim pra saldo bancário (use consistent read aí).',
      },
      {
        short: 'Auto Scaling ajusta capacidade automaticamente',
        detail: 'Você define: CPU > 70% por 5 min → adiciona 2 instâncias. CPU < 30% → remove. Reage a tráfego sem você apertar botão. Funciona com EC2, ECS, Lambda concorrência, RDS read replicas.',
      },
      {
        short: 'Pareto: 80% do impacto vem de 20% das mudanças',
        detail: 'Em performance, a maior query lenta domina o tempo total. Em features, 20% das telas têm 80% do uso. Otimize o que importa — métricas reais, não palpite. "Premature optimization is the root of all evil" — Knuth.',
      },
    ],
  },
  {
    tileX: 8, tileY: 16, role: 'SQL Wizard',
    shirt: [180, 83, 9], hat: [251, 191, 36],
    quotes: [
      'SELECT café FROM cozinha WHERE energia < 10;',
      'Um JOIN mal feito e o processador chora...',
    ],
    curiosities: [
      {
        short: 'EXPLAIN mostra como o DB planeja executar sua query',
        detail: 'EXPLAIN SELECT * FROM users WHERE email = "x"; mostra: usa índice? full scan? estimativa de linhas? Custo? É a ferramenta nº 1 pra debugar query lenta. EXPLAIN ANALYZE roda de fato e mede tempo real.',
      },
      {
        short: 'LIMIT 1 + ORDER BY id DESC pega a última linha',
        detail: 'Sem ORDER BY, LIMIT escolhe ARBITRÁRIO — pode trazer qualquer uma. Com ORDER BY, ordena e pega N. Pra performance: ORDER BY na coluna indexada. Sem índice, ele ordena tudo (O(n log n)).',
      },
      {
        short: 'COUNT(*) pode ser lento — cache se for muito chamado',
        detail: 'MyISAM tem contador armazenado: COUNT(*) é instantâneo. InnoDB precisa contar linha a linha respeitando MVCC: pode ser lento em tabelas grandes. Pra contagem aproximada: SHOW TABLE STATUS, ou cache com Redis.',
      },
      {
        short: 'JOIN INNER · LEFT · RIGHT · FULL — diferentes seleções',
        detail: 'INNER: só linhas com match nos dois lados. LEFT: todas da esquerda + match (NULL se não tem). RIGHT: todas da direita. FULL: todas dos dois (MySQL não suporta direto, simula com UNION).',
      },
      {
        short: 'LIKE "%abc%" não usa índice — full scan pesado',
        detail: 'Wildcard no início impede o B-tree. LIKE "abc%" usa índice (prefixo conhecido). LIKE "%abc%" (substring) não. Pra busca de texto livre: full-text index (MATCH...AGAINST) ou Elasticsearch separado.',
      },
      {
        short: 'DISTINCT remove duplicados — útil pós-JOIN',
        detail: 'Após JOIN você pode duplicar linhas (1 user com N orders → N rows do user). DISTINCT desduplica. Mas é caro: ele ordena tudo internamente. Considere reescrever com GROUP BY ou EXISTS pra evitar.',
      },
    ],
  },
  {
    tileX: 20, tileY: 16, role: 'DevOps',
    shirt: [4, 120, 87], hat: [34, 211, 238],
    quotes: [
      `Dê um 'reboot' na sua instância e reze para ela voltar.`,
      'VPC: Criando meu próprio cercadinho digital.',
      'O console da AWS é o maior labirinto que um dev pode enfrentar.',
    ],
    curiosities: [
      {
        short: 'observabilidade: logs (eventos) · metrics (números) · traces (caminhos)',
        detail: 'Logs: "user 42 fez login às 10:00" — timeline de eventos. Metrics: "CPU=75%, requests=1200/min" — agregados numéricos. Traces: "request X passou por A→B→C, B levou 200ms" — pegada distribuída.',
      },
      {
        short: 'CloudWatch monitora RDS · alerta se CPU > 80%',
        detail: 'CloudWatch coleta métricas de quase tudo na AWS automaticamente. Você cria alarmes (CPU > 80% por 5 min, IOPS > 10k) que disparam SNS, SMS, Lambda, escalada. Logs também: cada log do app pode virar alarm.',
      },
      {
        short: 'blue/green deploy = 2 ambientes, switcha sem downtime',
        detail: 'Ambiente azul rodando em prod. Sobe verde (nova versão) ao lado. Smoke test no verde. Se OK, switcha o load balancer pra apontar pro verde — usuários não percebem. Se der ruim, switcha de volta. Deploy seguro.',
      },
      {
        short: 'feature flag liga/desliga código sem novo deploy',
        detail: 'Em vez de deploy pra ativar uma feature, você comita o código com if (flag.enabled). Liga/desliga via dashboard. Permite: rollout gradual (1% → 10% → 100%), A/B test, kill switch em prod sem rebuild.',
      },
      {
        short: 'Infrastructure as Code (Terraform/CloudFormation) evita erros',
        detail: 'Configurar AWS pelo console funciona pra 1 conta. Com 5 ambientes, 10 contas: chaos. IaC versiona infra como código (git). Reproduzível, peer-review, rollback. Ex: terraform apply -target=database.',
      },
      {
        short: 'deploy on Friday? viver pra contar a história',
        detail: 'Old joke: deploy de sexta = ninguém pra apagar incêndio no fim de semana. Equipes maduras: deploy contínuo (qualquer dia, várias vezes por dia, blue/green). Equipes que ainda têm dor: evitam sexta-feira.',
      },
    ],
  },
];

// EDUCATIONAL: spawnNpcs retorna Map<tile, NpcPreset> consultado pelo INSPECT.
// O INSPECT abre um MODAL (não mais bubble), passando o NpcPreset inteiro pro componente.
// Quotes idle continuam aparecendo como bubbles curtas no canvas.
function spawnNpcs(k: K): Map<string, NpcPreset> {
  const map = new Map<string, NpcPreset>();
  for (const npc of NPC_PRESETS) {
    const cx = npc.tileX * TILE + TILE / 2;
    const cy = npc.tileY * TILE + TILE / 2;
    const quoteAt = 10 + Math.random() * 8;
    k.add([
      k.pos(cx, cy),
      k.anchor('center'),
      k.scale(1.5),
      k.z(4),
      'npc',
      {
        bobble: Math.random() * Math.PI * 2,
        quoteT: -3 - Math.random() * 4,
        nextAt: quoteAt,
        update() {
          this.bobble += k.dt() * 3;
          this.quoteT += k.dt();
          if (this.quoteT > this.nextAt) {
            const q = npc.quotes[Math.floor(Math.random() * npc.quotes.length)];
            spawnTalkBubble(k, q, cx, cy - 20, [220, 230, 245]);
            this.quoteT = 0;
            this.nextAt = 14 + Math.random() * 10;
          }
        },
        draw() {
          drawNpcSprite(k, this.bobble, npc.shirt, npc.hat);
        },
      },
    ]);
    map.set(`${npc.tileX},${npc.tileY}`, npc);
  }
  return map;
}

function drawNpcSprite(k: K, bobble: number, shirtRgb: [number, number, number], hatRgb: [number, number, number] | null) {
  const bob = Math.sin(bobble) * 0.6;
  // shadow
  k.drawEllipse({ pos: k.vec2(0, 12), radiusX: 7, radiusY: 2, color: k.rgb(0, 0, 0), opacity: 0.4 });
  // legs
  k.drawRect({ pos: k.vec2(-4, 6 + bob), width: 3, height: 6, color: k.rgb(15, 23, 42), radius: 1 });
  k.drawRect({ pos: k.vec2(1, 6 + bob), width: 3, height: 6, color: k.rgb(15, 23, 42), radius: 1 });
  // body
  k.drawRect({ pos: k.vec2(-6, -2 + bob), width: 12, height: 9, color: k.rgb(...shirtRgb), radius: 2 });
  // head
  k.drawRect({ pos: k.vec2(-4, -10 + bob), width: 8, height: 7, color: k.rgb(252, 211, 170), radius: 1 });
  // eyes (sleepy)
  k.drawRect({ pos: k.vec2(-3, -8 + bob), width: 1.4, height: 0.8, color: k.rgb(15, 23, 42) });
  k.drawRect({ pos: k.vec2(2, -8 + bob), width: 1.4, height: 0.8, color: k.rgb(15, 23, 42) });
  // hat
  if (hatRgb) {
    k.drawRect({ pos: k.vec2(-5, -13 + bob), width: 10, height: 4, color: k.rgb(...hatRgb), radius: 2 });
  }
}

// EDUCATIONAL: kaplay parseia [tag]...[/tag] como styled text. Qualquer "[" no
// conteúdo crasha com "Styled text error: unclosed tags". Sanitizamos antes.
function safeKaplayText(s: string): string {
  return s.replace(/\[/g, '⟦').replace(/\]/g, '⟧');
}

// ============================================================================
// 🌳☕📚🖥️🦜 Props interativos — itens decorativos que o INSPECT abre modal.
// Cada um tem role + emoji + curiosidades temáticas. Bloqueiam movimento.
// ============================================================================
type PropKind = 'tree' | 'coffee' | 'bookshelf' | 'serverrack' | 'parrot' | 'fountain';

type PropPreset = {
  tileX: number; tileY: number;
  kind: PropKind;
  role: string;
  emoji: string;
  theme: 'cyan' | 'violet' | 'amber' | 'rose' | 'emerald';
  curiosities: Curiosity[];
};

const PROP_PRESETS: PropPreset[] = [
  // Árvores espalhadas
  {
    tileX: 6, tileY: 8, kind: 'tree', role: 'Árvore Lógica', emoji: '🌳', theme: 'emerald',
    curiosities: [
      { short: 'B-tree é a estrutura por trás de quase todo INDEX', detail: 'Árvore balanceada onde cada nó tem N filhos. Lookup é O(log n) — buscar entre milhões de linhas custa só ~20 saltos. MySQL InnoDB usa B+tree (variante com folhas linkadas pra range scans rápidos).' },
      { short: 'AVL e Red-Black: árvores que se rebalanceiam sozinhas', detail: 'Sem rebalanceamento, uma árvore pode degenerar em lista (O(n)). AVL e Red-Black detectam desbalanço e rotacionam nós automaticamente. Map/Set do C++ STL usa Red-Black por baixo.' },
      { short: 'JSON é uma árvore: objeto pai → propriedades filhas', detail: 'Toda estrutura aninhada vira árvore. {a: {b: 1}} é a raiz "a" com filho "b". Parsers fazem traversal recursivo. Árvore é o esqueleto de dado mais comum em CS depois do array.' },
      { short: 'Trie acelera busca de prefixo (autocomplete)', detail: 'Trie ("prefix tree") guarda strings letra-por-letra. Autocomplete do Google: digita "pro", desce pela trie até "pro", lista todos os filhos. O(comprimento da palavra) — não depende do total de palavras.' },
    ],
  },
  {
    tileX: 32, tileY: 7, kind: 'tree', role: 'Árvore de Dados', emoji: '🌳', theme: 'emerald',
    curiosities: [
      { short: 'DOM da web é uma árvore — html → body → divs', detail: 'Todo HTML vira árvore. document.querySelector navega ela. React faz "diffing" entre 2 árvores virtuais pra saber o mínimo a re-renderizar — daí a fama de rápido.' },
      { short: 'Heap: árvore onde pai sempre é maior (ou menor) que filhos', detail: 'Estrutura de prioridade. Inserir é O(log n), pegar o maior é O(1). Usado em algoritmos como Dijkstra (rotas mais curtas), schedulers de SO, top-K.' },
      { short: 'Merkle tree: cada nó é hash dos filhos', detail: 'Blockchain (Bitcoin) usa pra verificar integridade. Mudou 1 byte no fundo? O hash da raiz muda. Permite provar "esse dado existe nessa árvore" só com log(n) hashes.' },
    ],
  },
  // Cafeteiras
  {
    tileX: 14, tileY: 7, kind: 'coffee', role: 'Cafeteira do Devs', emoji: '☕', theme: 'amber',
    curiosities: [
      { short: 'Café é o Stack Overflow líquido — o combustível do programador.', detail: 'Pesquisa real (Stanford 2014): cafeína melhora foco em tarefas complexas em até 30%. Mas cuidado: 4 xícaras → ansiedade. 6 → tremores. Equilíbrio é a chave (igual indexação).' },
      { short: '"It works on coffee, my computer needs RAM"', detail: 'Lema do dev. Café faz o cérebro funcionar; RAM faz o computador funcionar. Quando os dois acabam ao mesmo tempo, é hora de café e reiniciar a máquina.' },
      { short: 'Stack Overflow tem 60M+ perguntas. Você não está sozinho.', detail: 'Provavelmente alguém já bateu o seu erro exato. Copiar resposta sem entender = bug futuro. Ler explicação + adaptar = aprendizado real. SO tem 100M visitas/mês.' },
    ],
  },
  {
    tileX: 26, tileY: 19, kind: 'coffee', role: 'Espresso de Produção', emoji: '☕', theme: 'amber',
    curiosities: [
      { short: 'Bug em prod às 3am? Café. Sempre café.', detail: 'Incidentes vêm em horários ruins. Runbook + monitoramento bom + café = você sobrevive. Sem runbook? Você vira o runbook (e jura nunca mais).' },
      { short: 'Log levels: DEBUG, INFO, WARN, ERROR, FATAL', detail: 'DEBUG = só em dev. INFO = eventos normais (login, pedido). WARN = algo errado mas seguiu. ERROR = falhou mas app continua. FATAL = app vai cair. Use os certos pra alarmes funcionarem.' },
    ],
  },
  // Estantes
  {
    tileX: 8, tileY: 20, kind: 'bookshelf', role: 'Biblioteca Clássica', emoji: '📚', theme: 'violet',
    curiosities: [
      { short: '"Clean Code" — Robert Martin: nomes contam tudo', detail: 'Função chamada `process()` é mistério. `parseUserOrders()` se explica. Se você precisa de comentário pra explicar o que o código faz, renomeie. Comentário fala POR QUÊ, código fala O QUÊ.' },
      { short: '"Refactoring" — Fowler: pequenos passos seguros', detail: 'Refactor não é "vou reescrever". É: mude 1 coisa, rode os testes, commite. Repete 100×. No fim, código novo e nada quebrou. Caos é o oposto: 50 mudanças sem teste, semana de bug-hunt.' },
      { short: '"Designing Data-Intensive Applications" é a bíblia de DB', detail: 'Martin Kleppmann explica replicação, consistência, sharding, batch vs stream. Se você for sério sobre backend/DB, leia. Cada capítulo equivale a um curso.' },
      { short: '"Pragmatic Programmer": DRY, ortogonalidade, contratos', detail: 'DRY = Don\'t Repeat Yourself — duplicação é bug futuro. Ortogonalidade = mude 1 coisa, só 1 coisa muda. Contracts = funções têm pré/pós condições claras. Princípios que duram décadas.' },
    ],
  },
  {
    tileX: 30, tileY: 21, kind: 'bookshelf', role: 'Manuais Antigos', emoji: '📖', theme: 'violet',
    curiosities: [
      { short: 'RFC 793 (TCP) é de 1981 e ainda é a base da internet', detail: 'Protocolo escrito em papel há 40+ anos. TCP fornece confiabilidade sobre IP que é não-confiável. Toda chamada HTTP/HTTPS começa com TCP handshake (SYN/SYN-ACK/ACK).' },
      { short: 'O paper original do MapReduce (Google, 2004) iniciou Big Data', detail: '"MapReduce: Simplified Data Processing on Large Clusters" — Google publicou e Hadoop nasceu. Hoje Spark e BigQuery são herdeiros. Idéia: divide trabalho em (map) e junta (reduce).' },
      { short: 'Knuth: "Premature optimization is the root of all evil"', detail: 'Não otimize sem MEDIR. 97% do tempo, gargalo está num lugar inesperado. Profile primeiro, otimize o hotspot, deixa o resto simples. Citação é de "Structured Programming with go to" (1974).' },
    ],
  },
  // Server racks decorativos (não confundir com tipo 'servidor' do CRUD)
  {
    tileX: 12, tileY: 21, kind: 'serverrack', role: 'Rack do Datacenter', emoji: '🖥️', theme: 'cyan',
    curiosities: [
      { short: 'Servidores RDS rodam em hardware compartilhado', detail: 'A AWS aluga "fatias" de máquinas físicas. Sua instância t3.micro divide CPU com vizinhos. Pra performance previsível, paga mais por dedicated instances.' },
      { short: 'Datacenter usa ~1% da eletricidade global', detail: 'Resfriamento + servidores + redes consomem muita energia. AWS tem meta de 100% renovável até 2025. Google já é. Cada query SQL custa watts — agradeça aos engenheiros de eficiência.' },
      { short: 'SSD vs HDD: 100× mais rápido, 10× mais caro', detail: 'HDD tem braço mecânico (5-10ms/seek). SSD é puro silício (0.1ms). DBs modernos assumem SSD. Backups arquivados ainda usam HDD por custo.' },
    ],
  },
  {
    tileX: 28, tileY: 6, kind: 'serverrack', role: 'Storage Bay', emoji: '💾', theme: 'cyan',
    curiosities: [
      { short: 'S3 tem 99.999999999% de durabilidade (11 noves)', detail: 'Em 10 milhões de objetos, a AWS perde estatisticamente 1 objeto a cada 10.000 anos. Replicação tripla automática + checksum. É praticamente impossível perder dado lá.' },
      { short: '"Storage" pode ser block, object, ou file', detail: 'Block = tipo HD bruto (EBS). Object = baldes de chave/valor com metadata (S3). File = sistema de arquivos compartilhado (EFS). Cada um pra seu caso.' },
    ],
  },
  // Papagaios (NPC pequeno, fala SQL)
  {
    tileX: 19, tileY: 5, kind: 'parrot', role: 'Papagaio de Logs', emoji: '🦜', theme: 'rose',
    curiosities: [
      { short: 'SELECT * é vício — peça só as colunas que precisa', detail: 'Cada coluna extra puxa bytes do disco e do network. Numa tabela com BLOB grande, SELECT * pode ser 100× mais lento que SELECT id, name. Em prod, NUNCA use SELECT *.' },
      { short: 'JOINs sem índice na FK = full scan na tabela ligada', detail: 'JOIN orders ON orders.user_id = users.id. Se user_id não é index, o DB lê a tabela orders inteira pra cada user. CREATE INDEX idx_user ON orders(user_id) — diferença pode ser 1000×.' },
      { short: 'NULL não é igual a NULL (tem que usar IS NULL)', detail: 'WHERE col = NULL retorna 0 linhas, mesmo que existam NULLs. SQL trata NULL como "desconhecido" — não dá pra comparar dois desconhecidos. Use IS NULL ou IS NOT NULL.' },
      { short: 'COUNT(*) ≠ COUNT(coluna): ignoram NULLs diferente', detail: 'COUNT(*) conta linhas totais. COUNT(coluna) conta só onde coluna não é NULL. Em tabelas com NULL, dão números diferentes. Sutil mas crítico em relatórios.' },
    ],
  },
  // Fonte
  {
    tileX: 21, tileY: 22, kind: 'fountain', role: 'Fonte de Dados', emoji: '⛲', theme: 'cyan',
    curiosities: [
      { short: 'Data flow: Fonte → ETL → Warehouse → Dashboard', detail: 'ETL = Extract, Transform, Load. Pega dado bruto da fonte (DB, API, CSV), transforma (limpa, agrega), carrega no warehouse (Redshift, BigQuery). Dashboard mostra. Pipeline clássico de analytics.' },
      { short: 'Stream vs batch: tempo real vs em lotes', detail: 'Stream (Kafka, Flink): processa cada evento na hora. Batch (Spark, Airflow): processa N eventos juntos a cada hora/dia. Stream é caro mas atualizado; batch é eficiente mas atrasado.' },
    ],
  },
];

// EDUCATIONAL: spawnProps registra cada prop num map (tile-key → preset).
// O INSPECT no interact() consulta esse map pra abrir o PropModal.
function spawnProps(k: K): Map<string, PropPreset> {
  const map = new Map<string, PropPreset>();
  for (const p of PROP_PRESETS) {
    const cx = p.tileX * TILE + TILE / 2;
    const cy = p.tileY * TILE + TILE / 2;
    k.add([
      k.pos(cx, cy),
      k.anchor('center'),
      k.scale(1),
      k.z(3),
      'prop',
      {
        bobble: Math.random() * Math.PI * 2,
        update() { this.bobble += k.dt() * 2; },
        draw() { drawPropByKind(k, p.kind, this.bobble); },
      },
    ]);
    map.set(`${p.tileX},${p.tileY}`, p);
  }
  return map;
}

function drawPropByKind(k: K, kind: PropKind, bobble: number) {
  const bob = Math.sin(bobble) * 0.5;
  if (kind === 'tree') {
    // tronco
    k.drawRect({ pos: k.vec2(-2, 4), width: 4, height: 8, color: k.rgb(101, 67, 33), radius: 1 });
    // copa (3 círculos verdes empilhados)
    k.drawCircle({ pos: k.vec2(0, -2 + bob * 0.4), radius: 8, color: k.rgb(20, 110, 50) });
    k.drawCircle({ pos: k.vec2(-5, -3 + bob * 0.3), radius: 6, color: k.rgb(30, 130, 60) });
    k.drawCircle({ pos: k.vec2(5, -3 + bob * 0.3), radius: 6, color: k.rgb(30, 130, 60) });
    k.drawCircle({ pos: k.vec2(0, -8 + bob * 0.5), radius: 5, color: k.rgb(40, 150, 70) });
    // pequenas folhas brilhantes
    k.drawCircle({ pos: k.vec2(-3, -6 + bob), radius: 1.2, color: k.rgb(110, 231, 183), opacity: 0.8 });
    k.drawCircle({ pos: k.vec2(3, -2 + bob), radius: 1, color: k.rgb(110, 231, 183), opacity: 0.7 });
  } else if (kind === 'coffee') {
    // mesinha
    k.drawRect({ pos: k.vec2(-9, 6), width: 18, height: 3, color: k.rgb(80, 60, 40), radius: 1 });
    // xícara (corpo + alça)
    k.drawRect({ pos: k.vec2(-5, -3 + bob * 0.5), width: 10, height: 9, color: k.rgb(240, 240, 245), radius: 2 });
    k.drawRect({ pos: k.vec2(5, -1 + bob * 0.5), width: 3, height: 5, color: k.rgb(240, 240, 245), radius: 2 });
    // café preto dentro
    k.drawRect({ pos: k.vec2(-4, -2 + bob * 0.5), width: 8, height: 2, color: k.rgb(60, 35, 15), radius: 1 });
    // vapor (3 ondas)
    for (let i = 0; i < 3; i++) {
      const t = (bobble * 0.7 + i * 0.7) % 2;
      const wx = -2 + i * 2 + Math.sin(t * Math.PI) * 1.5;
      k.drawCircle({
        pos: k.vec2(wx, -7 - t * 5),
        radius: 1.2,
        color: k.rgb(220, 220, 230),
        opacity: Math.max(0, 1 - t / 2),
      });
    }
  } else if (kind === 'bookshelf') {
    // estante (3 prateleiras)
    k.drawRect({ pos: k.vec2(-9, -10), width: 18, height: 22, color: k.rgb(60, 40, 25), radius: 1 });
    // prateleiras horizontais
    for (let i = 0; i < 3; i++) {
      k.drawRect({ pos: k.vec2(-9, -10 + i * 7), width: 18, height: 1, color: k.rgb(40, 25, 15) });
    }
    // livros coloridos (4 por prateleira, cores variadas)
    const colors: Array<[number, number, number]> = [
      [220, 60, 60], [60, 180, 220], [220, 180, 60], [120, 60, 200], [60, 180, 100], [200, 100, 60],
    ];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const c = colors[(row * 4 + col) % colors.length];
        k.drawRect({
          pos: k.vec2(-8 + col * 4, -9 + row * 7),
          width: 3.5, height: 6,
          color: k.rgb(...c),
          radius: 0.3,
        });
      }
    }
  } else if (kind === 'serverrack') {
    // rack tall
    k.drawRect({ pos: k.vec2(-7, -12), width: 14, height: 24, color: k.rgb(35, 45, 75), radius: 1 });
    // 4 servidores empilhados
    for (let i = 0; i < 4; i++) {
      k.drawRect({ pos: k.vec2(-6, -11 + i * 6), width: 12, height: 4, color: k.rgb(50, 65, 110), radius: 0.5 });
      // 3 LEDs piscando
      for (let j = 0; j < 3; j++) {
        const phase = bobble * 2 + i + j * 0.5;
        const on = Math.sin(phase) > 0.2;
        k.drawCircle({
          pos: k.vec2(-4 + j * 1.5, -9 + i * 6),
          radius: 0.6,
          color: on ? k.rgb(34, 197, 94) : k.rgb(40, 50, 80),
        });
      }
      // slot brilhante
      k.drawRect({ pos: k.vec2(2, -10 + i * 6), width: 3, height: 0.5, color: k.rgb(34, 211, 238), opacity: 0.6 });
    }
  } else if (kind === 'parrot') {
    // poleiro
    k.drawRect({ pos: k.vec2(-7, 7), width: 14, height: 1.5, color: k.rgb(80, 60, 40), radius: 0.5 });
    k.drawRect({ pos: k.vec2(-1, 8), width: 2, height: 4, color: k.rgb(80, 60, 40) });
    // corpo (verde + amarelo)
    k.drawRect({ pos: k.vec2(-4, -1 + bob), width: 8, height: 8, color: k.rgb(20, 130, 70), radius: 3 });
    k.drawRect({ pos: k.vec2(-3, 2 + bob), width: 6, height: 4, color: k.rgb(220, 190, 50), radius: 2 });
    // cabeça
    k.drawRect({ pos: k.vec2(-3, -6 + bob), width: 6, height: 5, color: k.rgb(220, 60, 60), radius: 2 });
    // bico
    k.drawCircle({ pos: k.vec2(-5, -4 + bob), radius: 1.2, color: k.rgb(40, 30, 20) });
    // olho
    k.drawRect({ pos: k.vec2(-2, -5 + bob), width: 1, height: 1, color: k.rgb(15, 23, 42) });
    // asa (pisca)
    const wing = Math.sin(bobble * 3) * 0.5;
    k.drawRect({ pos: k.vec2(0, 0 + bob + wing), width: 3, height: 5, color: k.rgb(30, 100, 50), radius: 1 });
    // cauda
    k.drawRect({ pos: k.vec2(2, 4 + bob), width: 5, height: 2, color: k.rgb(220, 60, 60), radius: 1 });
  } else if (kind === 'fountain') {
    // base
    k.drawCircle({ pos: k.vec2(0, 4), radius: 12, color: k.rgb(60, 80, 130), opacity: 0.7 });
    k.drawCircle({ pos: k.vec2(0, 4), radius: 12, fill: false, outline: { width: 1.5, color: k.rgb(34, 211, 238), opacity: 0.6 } });
    // água dentro (azul claro)
    k.drawCircle({ pos: k.vec2(0, 4), radius: 9, color: k.rgb(34, 211, 238), opacity: 0.4 });
    // pilar central
    k.drawRect({ pos: k.vec2(-1.5, -2), width: 3, height: 6, color: k.rgb(80, 100, 150) });
    // jato d'água (4 partículas pulando)
    for (let i = 0; i < 4; i++) {
      const t = (bobble * 0.8 + i * 0.5) % 2;
      const angle = i * Math.PI / 2;
      const r = 4 + t * 3;
      k.drawCircle({
        pos: k.vec2(Math.cos(angle) * r, -4 - t * 3 + Math.sin(t * Math.PI) * 2),
        radius: 1.3,
        color: k.rgb(165, 243, 252),
        opacity: Math.max(0.2, 1 - t / 2),
      });
    }
    // jato vertical
    k.drawCircle({ pos: k.vec2(0, -6 + Math.sin(bobble * 2) * 1.5), radius: 1.5, color: k.rgb(165, 243, 252), opacity: 0.85 });
  }
}

// ============================================================================
// 🐕 Dog NPC — pet errante perto do spawn. Wanders dentro de raio de 3 tiles,
// muda de direção a cada 3-6s. Não bloqueia, atravessa tudo (mas evita borda).
// ============================================================================
function spawnDog(k: K, homeTileX: number, homeTileY: number) {
  const startX = homeTileX * TILE + TILE / 2;
  const startY = homeTileY * TILE + TILE / 2;
  let elapsed = 0;
  let nextMoveAt = 2 + Math.random() * 3;
  let facingRight = true;

  const dog = k.add([
    k.pos(startX, startY),
    k.anchor('center'),
    k.scale(1.3),
    k.z(3),
    'dog',
    {
      bobble: 0,
      moving: false,
      tileX: homeTileX,   // exposto pra INSPECT detectar
      tileY: homeTileY,
      targetX: startX,
      targetY: startY,
      pettedT: 0,         // > 0 = recebendo carinho (rabo abana mais)
      update() {
        this.bobble += k.dt() * (this.moving ? 8 : 4);
        elapsed += k.dt();
        if (this.pettedT > 0) this.pettedT -= k.dt();

        // smooth walk pra target tile
        const dx = this.targetX - this.pos.x;
        const dy = this.targetY - this.pos.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > 1) {
          this.pos.x = k.lerp(this.pos.x, this.targetX, 0.08);
          this.pos.y = k.lerp(this.pos.y, this.targetY, 0.08);
          this.moving = true;
          if (Math.abs(dx) > 0.5) facingRight = dx > 0;
        } else {
          this.moving = false;
        }

        // pet pausa a errância — dog fica feliz parado por 2s.
        if (this.pettedT > 0) return;

        // hora de escolher próximo tile?
        if (elapsed >= nextMoveAt && !this.moving) {
          elapsed = 0;
          nextMoveAt = 3 + Math.random() * 3;
          for (let attempt = 0; attempt < 6; attempt++) {
            const dxT = Math.floor(Math.random() * 3) - 1;
            const dyT = Math.floor(Math.random() * 3) - 1;
            if (dxT === 0 && dyT === 0) continue;
            const nx = this.tileX + dxT;
            const ny = this.tileY + dyT;
            if (nx < 1 || nx >= COLS - 1 || ny < 1 || ny >= ROWS - 1) continue;
            if (Math.abs(nx - homeTileX) > 3 || Math.abs(ny - homeTileY) > 3) continue;
            this.tileX = nx;
            this.tileY = ny;
            this.targetX = nx * TILE + TILE / 2;
            this.targetY = ny * TILE + TILE / 2;
            break;
          }
        }
      },
      draw() {
        // quando recebendo carinho, anima rabo mais rápido + sorriso visível
        const happyBobble = this.pettedT > 0 ? this.bobble * 2.5 : this.bobble;
        drawDogSprite(k, happyBobble, facingRight, this.moving);
      },
    },
  ]);
  return dog;
}

function drawDogSprite(k: K, bobble: number, facingRight: boolean, moving: boolean) {
  const bob = Math.sin(bobble) * (moving ? 0.8 : 0.4);
  const tailWag = Math.sin(bobble * 4) * 2;
  const sx = facingRight ? 1 : -1;
  const flip = (x: number) => x * sx;

  // sombra
  k.drawEllipse({ pos: k.vec2(0, 7), radiusX: 6, radiusY: 1.6, color: k.rgb(0, 0, 0), opacity: 0.45 });

  // patas (pequenas, alternadas se moving)
  const legSwing = moving ? Math.sin(bobble * 6) * 1.2 : 0;
  k.drawRect({ pos: k.vec2(flip(-4) - 1, 4 + bob + legSwing), width: 2, height: 3, color: k.rgb(140, 90, 30), radius: 0.5 });
  k.drawRect({ pos: k.vec2(flip(2) - 1, 4 + bob - legSwing), width: 2, height: 3, color: k.rgb(140, 90, 30), radius: 0.5 });

  // corpo (rect + topo arredondado)
  k.drawRect({ pos: k.vec2(-5, -1 + bob), width: 10, height: 6, color: k.rgb(180, 130, 50), radius: 2.5 });
  // mancha
  k.drawCircle({ pos: k.vec2(flip(2), 1 + bob), radius: 1.4, color: k.rgb(140, 90, 30), opacity: 0.7 });

  // rabo (abana mais quando parado)
  k.drawRect({
    pos: k.vec2(flip(5) + (sx > 0 ? 0 : -2), -2 + bob - tailWag * 0.3),
    width: 3, height: 1.8,
    color: k.rgb(180, 130, 50),
    radius: 1,
  });
  // ponta do rabo (com wag)
  k.drawCircle({
    pos: k.vec2(flip(7) + tailWag * 0.5, -1 + bob - tailWag * 0.4),
    radius: 1.2,
    color: k.rgb(200, 150, 70),
  });

  // cabeça
  k.drawRect({ pos: k.vec2(flip(-7) - (sx > 0 ? 0 : 1), -4 + bob), width: 5, height: 5, color: k.rgb(200, 150, 70), radius: 1.5 });
  // orelha caída
  k.drawRect({ pos: k.vec2(flip(-6) - (sx > 0 ? 0 : 1), -5 + bob), width: 2, height: 2.5, color: k.rgb(140, 90, 30), radius: 1 });
  // focinho
  k.drawCircle({ pos: k.vec2(flip(-9) + (sx > 0 ? 0 : 1), -1 + bob), radius: 0.9, color: k.rgb(40, 30, 20) });
  // olho
  k.drawRect({ pos: k.vec2(flip(-5) - (sx > 0 ? 0 : 1), -3 + bob), width: 1, height: 1, color: k.rgb(15, 23, 42) });
}

// ============================================================================
// 💻 PC Stations — decoração ambiente (mesa + cadeira + monitor + NPC sentado).
// Não bloqueiam movimento. Vida visual sem competir com gameplay.
// ============================================================================
const PC_STATION_POSITIONS: Array<{ tileX: number; tileY: number; theme: [number, number, number] }> = [
  { tileX: 6, tileY: 5, theme: [34, 211, 238] },     // canto cyan
  { tileX: COLS - 7, tileY: 5, theme: [167, 139, 250] },  // canto violet
  { tileX: 6, tileY: ROWS - 6, theme: [16, 185, 129] },   // canto emerald
  { tileX: COLS - 7, tileY: ROWS - 6, theme: [251, 191, 36] }, // canto âmbar
];

function spawnPcStations(k: K) {
  for (const s of PC_STATION_POSITIONS) {
    const cx = s.tileX * TILE + TILE / 2;
    const cy = s.tileY * TILE + TILE / 2;
    k.add([
      k.pos(cx, cy),
      k.anchor('center'),
      k.scale(1.1),
      k.z(3),
      'pc-station',
      {
        bobble: Math.random() * Math.PI * 2,
        typeT: Math.random() * 2,
        update() {
          this.bobble += k.dt() * 2.5;
          this.typeT += k.dt();
        },
        draw() {
          drawPcStation(k, this.bobble, this.typeT, s.theme);
        },
      },
    ]);
  }
}

function drawPcStation(k: K, bobble: number, typeT: number, theme: [number, number, number]) {
  const bob = Math.sin(bobble) * 0.4;
  // tapete
  k.drawRect({ pos: k.vec2(-12, -10), width: 24, height: 22, color: k.rgb(40, 50, 80), opacity: 0.5, radius: 2 });
  // mesa (base + tampo)
  k.drawRect({ pos: k.vec2(-10, -2), width: 20, height: 2, color: k.rgb(80, 60, 40), radius: 1 });
  k.drawRect({ pos: k.vec2(-9, 0), width: 1.5, height: 6, color: k.rgb(60, 45, 30) });
  k.drawRect({ pos: k.vec2(7.5, 0), width: 1.5, height: 6, color: k.rgb(60, 45, 30) });
  // monitor (atrás na mesa)
  k.drawRect({ pos: k.vec2(-5, -10), width: 10, height: 7, color: k.rgb(20, 28, 50), radius: 1 });
  k.drawRect({ pos: k.vec2(-4, -9), width: 8, height: 5, color: k.rgb(...theme), opacity: 0.55 });
  // "código" no monitor — 3 linhas piscando
  for (let i = 0; i < 3; i++) {
    const w = 4 + Math.sin(typeT * 4 + i) * 1.5;
    k.drawRect({
      pos: k.vec2(-3.5, -8.5 + i * 1.4),
      width: w,
      height: 0.7,
      color: k.rgb(255, 255, 255),
      opacity: 0.6 + 0.3 * Math.abs(Math.sin(typeT * 3 + i * 1.5)),
    });
  }
  // base do monitor
  k.drawRect({ pos: k.vec2(-1.5, -3), width: 3, height: 1, color: k.rgb(40, 50, 80) });
  // cadeira (encosto + assento)
  k.drawRect({ pos: k.vec2(-3, 4 + bob), width: 6, height: 4, color: k.rgb(80, 30, 30), radius: 1 });
  k.drawRect({ pos: k.vec2(-3.5, 1 + bob), width: 7, height: 3, color: k.rgb(120, 50, 50), radius: 1 });
  // NPC sentado de costas (cabeça + ombros), digitando — bob leve
  k.drawRect({ pos: k.vec2(-2.5, -1 + bob), width: 5, height: 4, color: k.rgb(15, 118, 110), radius: 1 });
  k.drawRect({ pos: k.vec2(-2, -5 + bob), width: 4, height: 4, color: k.rgb(252, 211, 170), radius: 1 });
  // capacete cyan
  k.drawRect({ pos: k.vec2(-2.5, -7 + bob), width: 5, height: 2, color: k.rgb(...theme), radius: 1 });
  // luz de teclado piscando (faísca)
  if (Math.sin(typeT * 8) > 0.7) {
    k.drawCircle({ pos: k.vec2(0, -2 + bob), radius: 0.6, color: k.rgb(...theme), opacity: 0.9 });
  }
}

// EDUCATIONAL: bubble estilo "balão de fala" — agora com TEXT WRAP.
// Quotes longas (frases de piada de SQL/AWS) quebram em N linhas.
// Lifespan escalona com tamanho do texto pra dar tempo de ler.
function spawnTalkBubble(k: K, text: string, x: number, y: number, rgb: [number, number, number]) {
  const safe = safeKaplayText(text);
  const charW = 5.2;     // largura média por caractere @ size 9
  const lineH = 11;       // altura por linha
  const padX = 10;
  const padY = 8;
  const maxBubbleW = 240;

  // Largura ideal sem wrap. Se passar do max, vai wrappar.
  const idealW = Math.round(safe.length * charW + padX);
  const w = Math.max(40, Math.min(maxBubbleW, idealW));
  const textW = w - padX;
  // Estimativa de # linhas após wrap (conservadora).
  const lines = idealW > maxBubbleW
    ? Math.ceil((safe.length * charW) / textW)
    : 1;
  const h = Math.max(16, lines * lineH + padY);
  // mais tempo na tela pra texto longo
  const lifespan = Math.max(3.0, Math.min(6.5, 1.8 + safe.length * 0.04));
  const fade = 1.4;

  // bg
  k.add([
    k.rect(w, h, { radius: 5 }),
    k.pos(x - w / 2, y - h),
    k.color(8, 14, 28),
    k.opacity(0.94),
    k.outline(1, k.rgb(...rgb)),
    k.lifespan(lifespan, { fade }),
    k.z(7),
  ]);
  // cauda triangular
  k.add([
    k.rect(4, 4),
    k.pos(x - 2, y - 2),
    k.color(8, 14, 28),
    k.opacity(0.94),
    k.rotate(45),
    k.lifespan(lifespan, { fade }),
    k.z(6),
  ]);
  // Texto — passa `width` pro kaplay quebrar em N linhas. Anchor 'top' pra
  // alinhar do topo do bg (caso tenha múltiplas linhas).
  k.add([
    k.text(safe, { size: 9, width: textW, lineSpacing: 2 }),
    k.pos(x, y - h + padY / 2),
    k.anchor('top'),
    k.color(...rgb),
    k.opacity(1),
    k.lifespan(lifespan, { fade }),
    k.z(8),
  ]);
}

// ============================================================================
// Signs — pequenos placas decorativas (estilo "neon sign") nos cantos do mapa.
// ============================================================================
const SIGN_PRESETS: Array<{ tileX: number; tileY: number; lines: string[]; rgb: [number, number, number] }> = [
  { tileX: 1, tileY: 1, lines: ['CRUD', 'BASICS'], rgb: [34, 211, 238] },
  { tileX: COLS - 2, tileY: 1, lines: ['TIP:', '4=INSPECT'], rgb: [251, 191, 36] },
  { tileX: 1, tileY: ROWS - 2, lines: ['HOUSES', 'lvl 1→2→3'], rgb: [167, 139, 250] },
  { tileX: COLS - 2, tileY: ROWS - 2, lines: ['DB', 'AWS RDS'], rgb: [16, 185, 129] },
];

function spawnSigns(k: K): Set<string> {
  const tiles = new Set<string>();
  for (const s of SIGN_PRESETS) {
    tiles.add(`${s.tileX},${s.tileY}`);
    const cx = s.tileX * TILE + TILE / 2;
    const cy = s.tileY * TILE + TILE / 2;
    // poste
    k.add([
      k.rect(2, 16),
      k.pos(cx - 1, cy + 4),
      k.color(60, 70, 110),
      k.z(-1),
    ]);
    // placa
    k.add([
      k.rect(28, 16, { radius: 2 }),
      k.pos(cx - 14, cy - 14),
      k.color(15, 23, 42),
      k.outline(1, k.rgb(...s.rgb)),
      k.opacity(0.95),
      k.z(0),
    ]);
    // textos
    s.lines.forEach((line, i) => {
      k.add([
        k.text(line, { size: 5 }),
        k.pos(cx, cy - 10 + i * 6),
        k.anchor('center'),
        k.color(...s.rgb),
        k.opacity(0.95),
        k.z(1),
        { phase: Math.random() * 6.28 },
      ]).onUpdate(function (this: any) {
        // pisca leve estilo neon
        this.opacity = 0.75 + 0.25 * Math.abs(Math.sin(k.time() * 1.4 + this.phase));
      });
    });
  }
  return tiles;
}

// ============================================================================
// Player idle quotes — pop "💭 thought" aleatório a cada 12-20s parado.
// ============================================================================
const IDLE_QUOTES = [
  'mais uma casa?',
  'CRUD é vida',
  'atalho 4 = ler',
  'banco vivo',
  'AWS responde',
  'level 3 ftw',
];

function spawnPlayerIdleSpeech(k: K, x: number, y: number) {
  const q = IDLE_QUOTES[Math.floor(Math.random() * IDLE_QUOTES.length)];
  spawnTalkBubble(k, q, x, y - 28, [165, 243, 252]);
}

// EDUCATIONAL: speech bubble que sai do player ao executar uma ação CRUD.
// Curta, contextual ("CONSTRUINDO!", "EVOLUINDO!", "DELETANDO!").
function spawnPlayerActionSpeech(k: K | null, kind: 'build' | 'update' | 'delete' | 'inspect', x: number, y: number) {
  if (!k) return;
  const map = {
    build:   { text: 'BUILDING!', rgb: [110, 231, 183] as [number, number, number] },
    update:  { text: 'EVOLVING!', rgb: [253, 224, 71]  as [number, number, number] },
    delete:  { text: 'BOOM!',     rgb: [254, 205, 211] as [number, number, number] },
    inspect: { text: 'SCANNING…', rgb: [165, 243, 252] as [number, number, number] },
  };
  const cfg = map[kind];
  spawnTalkBubble(k, cfg.text, x, y - 28, cfg.rgb);
}
