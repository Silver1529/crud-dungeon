// components/GameEngine.tsx
'use client';
// EDUCATIONAL: engine 2D real (Kaplay) com tema "Data Center" e camada didática.
// Para quem nunca mexeu em código: cada AÇÃO aqui dispara um SQL real no banco.
// Você vê o SQL antes (preview) e depois (no painel CRUD Live à direita).
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hammer, Wrench, Trash2, Server, Database, Zap, Network,
  Sparkles, BookOpen, ChevronRight, Keyboard,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useGameStore } from '@/lib/store';
import {
  useObjetos,
  useCreateObjeto,
  useUpdateObjeto,
  useDeleteObjeto,
} from '@/lib/queries';
import { notifyApi } from './ui/Toast';

// ============================================================================
// Types
// ============================================================================
type Tipo = 'servidor' | 'banco' | 'cache' | 'router';
type Tool = 'build' | 'upgrade' | 'delete';
type Status = 'novo' | 'ativo' | 'upgrade' | 'critico';

interface Objeto {
  id: number | string;
  tipo: Tipo;
  status: Status;
  pos_x: number;
  pos_y: number;
}

interface FacingTile {
  x: number;
  y: number;
}

// "Any" para o instance kaplay porque os tipos completos são grandes; o resto
// do componente é tipado com rigor.
type K = any;

// ============================================================================
// Constants
// ============================================================================
const TILE = 36;
const COLS = 20;
const ROWS = 15;
const W = COLS * TILE;
const H = ROWS * TILE;

const TIPO_META: Record<Tipo, { color: [number, number, number]; label: string; icon: ComponentType<{ className?: string }> }> = {
  servidor: { color: [34, 211, 238], label: 'servidor', icon: Server },
  banco: { color: [167, 139, 250], label: 'banco', icon: Database },
  cache: { color: [251, 191, 36], label: 'cache', icon: Zap },
  router: { color: [16, 185, 129], label: 'router', icon: Network },
};

const STATUS_META: Record<Status, { color: [number, number, number]; label: string }> = {
  novo: { color: [148, 163, 184], label: 'novo' },
  ativo: { color: [34, 197, 94], label: 'ativo' },
  upgrade: { color: [234, 179, 8], label: 'upgrade' },
  critico: { color: [239, 68, 68], label: 'critico' },
};

const STATUS_NEXT: Record<Status, Status> = {
  novo: 'ativo',
  ativo: 'upgrade',
  upgrade: 'critico',
  critico: 'novo',
};

const TOOL_META: Record<Tool, {
  label: string;
  icon: ComponentType<{ className?: string }>;
  verb: 'POST' | 'PUT' | 'DELETE';
  sqlKeyword: 'INSERT' | 'UPDATE' | 'DELETE';
  color: 'emerald' | 'amber' | 'rose';
  hint: string;
}> = {
  build: { label: 'BUILD', icon: Hammer, verb: 'POST', sqlKeyword: 'INSERT', color: 'emerald', hint: 'Criar novo registro no banco (CREATE)' },
  upgrade: { label: 'UPGRADE', icon: Wrench, verb: 'PUT', sqlKeyword: 'UPDATE', color: 'amber', hint: 'Modificar status de um registro existente (UPDATE)' },
  delete: { label: 'DELETE', icon: Trash2, verb: 'DELETE', sqlKeyword: 'DELETE', color: 'rose', hint: 'Apagar registro do banco (DELETE)' },
};

const COLOR_MAP = {
  emerald: { ring: 'border-emerald-400/40', bg: 'bg-emerald-400/10', fg: 'text-emerald-300' },
  amber: { ring: 'border-amber-400/40', bg: 'bg-amber-400/10', fg: 'text-amber-300' },
  rose: { ring: 'border-rose-400/40', bg: 'bg-rose-400/10', fg: 'text-rose-300' },
  cyan: { ring: 'border-cyan-400/40', bg: 'bg-cyan-400/10', fg: 'text-cyan-300' },
  violet: { ring: 'border-violet-400/40', bg: 'bg-violet-400/10', fg: 'text-violet-300' },
} as const;

// ============================================================================
// SQL preview (lê o que SERÁ executado se o jogador apertar Espaço agora)
// ============================================================================
function buildSqlPreview(tool: Tool, tipo: Tipo, fx: number, fy: number, target: Objeto | null): string {
  if (fx === 0 && fy === 0) {
    return `SELECT id, tipo, status, pos_x, pos_y\nFROM game_objects\nORDER BY id ASC;`;
  }
  if (tool === 'build') {
    if (target) return `-- tile ocupado · BUILD não roda (id=${target.id} já existe em ${fx},${fy})`;
    return `INSERT INTO game_objects (tipo, status, pos_x, pos_y)\nVALUES ('${tipo}', 'novo', ${fx}, ${fy});`;
  }
  if (tool === 'upgrade') {
    if (!target) return `-- vazio · UPGRADE precisa de um objeto na sua frente`;
    return `UPDATE game_objects\nSET status = '${STATUS_NEXT[target.status]}'\nWHERE id = ${target.id};`;
  }
  if (!target) return `-- vazio · DELETE precisa de um objeto na sua frente`;
  return `DELETE FROM game_objects\nWHERE id = ${target.id};`;
}

// ============================================================================
// Welcome flow + tutorial guiado
// ============================================================================
const USER_NAME_KEY = 'crud_dungeon_user_v1';
const TUTORIAL_DONE_KEY = 'crud_dungeon_tutorial_done_v1';
const PLAYER_CUSTOM_KEY = 'crud_dungeon_player_v1';

type TutStep = 'name' | 'intro' | 'move' | 'create' | 'read' | 'update' | 'delete' | 'done' | 'off';
type ActiveTutStep = Exclude<TutStep, 'name' | 'intro' | 'off'>;

const CRUD_CARDS = [
  { letter: 'C', name: 'CREATE', verb: 'POST', sql: 'INSERT INTO ...', color: 'emerald' as const, desc: 'Adicionar uma linha nova na tabela. No jogo: ferramenta BUILD num quadrado vazio.' },
  { letter: 'R', name: 'READ', verb: 'GET', sql: 'SELECT * FROM ...', color: 'cyan' as const, desc: 'Ler o que está salvo. No jogo: vá até o quadrado "?" no canto superior esquerdo.' },
  { letter: 'U', name: 'UPDATE', verb: 'PUT', sql: 'UPDATE ... SET ...', color: 'amber' as const, desc: 'Mudar uma linha existente. No jogo: ferramenta UPGRADE num objeto seu.' },
  { letter: 'D', name: 'DELETE', verb: 'DELETE', sql: 'DELETE FROM ...', color: 'rose' as const, desc: 'Apagar uma linha. No jogo: ferramenta DELETE num objeto seu.' },
];

const TUTORIAL_STEPS: Record<ActiveTutStep, {
  num: number; total: number; title: string; body: (name: string) => string;
  color: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet';
}> = {
  move:   { num: 1, total: 5, title: 'Mover',  body: (n) => `${n}, primeiro vamos te ensinar a se mexer. Use as setas ↑↓←→ ou WASD.`, color: 'cyan' },
  create: { num: 2, total: 5, title: 'CREATE = INSERT', body: (n) => `Boa, ${n}! Agora vá até um quadrado vazio e aperte Espaço. Você vai criar uma linha nova no banco (operação CREATE).`, color: 'emerald' },
  read:   { num: 3, total: 5, title: 'READ = SELECT', body: (n) => `Top, ${n}! Agora vá até o quadrado com "?" (canto superior esquerdo) e aperte Espaço para LER tudo do banco.`, color: 'cyan' },
  update: { num: 4, total: 5, title: 'UPDATE = UPDATE', body: (n) => `${n}, clique em UPGRADE no menu, encare um objeto seu e aperte Espaço para mudar o status dele.`, color: 'amber' },
  delete: { num: 5, total: 5, title: 'DELETE = DELETE', body: (n) => `Última, ${n}! Clique em DELETE no menu, encare um objeto seu e aperte Espaço para apagar do banco.`, color: 'rose' },
  done:   { num: 5, total: 5, title: 'Tutorial completo', body: (n) => `🎉 Parabéns, ${n}! Você dominou as 4 operações do CRUD. Agora é só explorar — todo SQL real aparece no painel à direita.`, color: 'violet' },
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

// EDUCATIONAL: presets de cor pro player. Cada preset vira RGB pro kaplay
// e classe Tailwind pra preview no modal.
const PLAYER_PRESETS = {
  shirt: {
    teal:    { rgb: [15, 118, 110],  bg: 'bg-teal-700',    accent: [34, 211, 238] },
    rose:    { rgb: [225, 29, 72],   bg: 'bg-rose-600',    accent: [254, 205, 211] },
    indigo:  { rgb: [67, 56, 202],   bg: 'bg-indigo-700',  accent: [165, 180, 252] },
    emerald: { rgb: [4, 120, 87],    bg: 'bg-emerald-700', accent: [110, 231, 183] },
    orange:  { rgb: [194, 65, 12],   bg: 'bg-orange-700',  accent: [253, 186, 116] },
  },
  hat: {
    cyan:    { rgb: [34, 211, 238],  bg: 'bg-cyan-400',   shade: [8, 145, 178] },
    amber:   { rgb: [251, 191, 36],  bg: 'bg-amber-400',  shade: [180, 83, 9] },
    rose:    { rgb: [244, 63, 94],   bg: 'bg-rose-500',   shade: [159, 18, 57] },
    violet:  { rgb: [167, 139, 250], bg: 'bg-violet-400', shade: [109, 40, 217] },
    none:    { rgb: null,            bg: 'bg-slate-700',  shade: null },
  },
  skin: {
    tan:    { rgb: [252, 211, 170],  bg: 'bg-[#fcd3aa]' },
    light:  { rgb: [255, 224, 189],  bg: 'bg-[#ffe0bd]' },
    medium: { rgb: [210, 160, 110],  bg: 'bg-[#d2a06e]' },
    dark:   { rgb: [128, 80, 50],    bg: 'bg-[#805032]' },
  },
} as const;

type ShirtKey = keyof typeof PLAYER_PRESETS.shirt;
type HatKey = keyof typeof PLAYER_PRESETS.hat;
type SkinKey = keyof typeof PLAYER_PRESETS.skin;
type PlayerCustom = { shirt: ShirtKey; hat: HatKey; skin: SkinKey };

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
        <PlayerPreview custom={custom} />
        <h2 className="font-mono text-xl text-cyan-300 flex items-center gap-2 mt-2">
          <Sparkles className="w-5 h-5" /> Bem-vindo
        </h2>
      </div>
      <p className="text-slate-300 text-sm leading-relaxed mb-4 text-center">
        Escolhe um nome e personaliza seu personagem. Vou te guiar pelas 4 operações de CRUD, uma por vez.
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
  return (
    <motion.div
      key={step}
      layout
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -10, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 26 }}
      className={`glass rounded-lg px-3 py-2 border ${cm.ring} ${cm.bg} flex items-start gap-3`}
    >
      <div className={`shrink-0 w-8 h-8 rounded-md bg-white/5 flex items-center justify-center font-mono ${cm.fg} text-[11px] font-bold`}>
        {step === 'done' ? '✓' : `${info.num}/${info.total}`}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-mono text-[11px] ${cm.fg} mb-0.5 uppercase tracking-wider`}>
          {info.title}
        </div>
        <p className="text-[12px] text-slate-200 leading-snug">
          {info.body(name)}
        </p>
      </div>
      {step === 'done' ? (
        <button
          onClick={onClose}
          className={`text-[10px] font-mono ${cm.fg} px-2 py-1 self-center hover:bg-white/5 rounded shrink-0`}
        >
          fechar
        </button>
      ) : (
        <button
          onClick={onSkip}
          className="text-[10px] font-mono text-slate-500 hover:text-slate-300 px-2 py-1 self-center shrink-0"
          title="Pular tutorial"
        >
          pular
        </button>
      )}
    </motion.div>
  );
}

// ============================================================================
// SQL preview bar — sempre visível, mostra o que vai rodar se você apertar Espaço
// ============================================================================
function highlightSql(sql: string) {
  const KEYWORDS = /\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|ORDER|BY|ASC|DESC)\b/g;
  const parts: { type: 'kw' | 'str' | 'comment' | 'text'; value: string }[] = [];

  // Linhas de comentário
  const lines = sql.split('\n');
  return lines.map((line, li) => {
    if (line.trim().startsWith('--')) {
      return <span key={li} className="text-slate-500 italic block">{line}{li < lines.length - 1 ? '\n' : ''}</span>;
    }
    parts.length = 0;
    let last = 0;
    let m: RegExpExecArray | null;
    KEYWORDS.lastIndex = 0;
    while ((m = KEYWORDS.exec(line)) !== null) {
      if (m.index > last) parts.push({ type: 'text', value: line.slice(last, m.index) });
      parts.push({ type: 'kw', value: m[0] });
      last = KEYWORDS.lastIndex;
    }
    if (last < line.length) parts.push({ type: 'text', value: line.slice(last) });

    return (
      <span key={li} className="block">
        {parts.map((p, i) => {
          if (p.type === 'kw') return <span key={i} className="text-violet-300 font-bold">{p.value}</span>;
          // strings entre aspas simples
          const sub = p.value.split(/('[^']*')/g);
          return sub.map((sp, j) =>
            sp.startsWith("'") && sp.endsWith("'")
              ? <span key={`${i}-${j}`} className="text-amber-300">{sp}</span>
              : <span key={`${i}-${j}`}>{sp}</span>
          );
        })}
      </span>
    );
  });
}

interface SqlPreviewBarProps {
  tool: Tool;
  tipo: Tipo;
  facing: FacingTile;
  target: Objeto | null;
}

function SqlPreviewBar({ tool, tipo, facing, target }: SqlPreviewBarProps) {
  const isRead = facing.x === 0 && facing.y === 0;
  const meta = isRead
    ? { verb: 'GET' as const, color: 'cyan' as const, label: 'READ' }
    : { verb: TOOL_META[tool].verb, color: TOOL_META[tool].color, label: TOOL_META[tool].label };
  const cm = COLOR_MAP[meta.color];
  const sql = buildSqlPreview(tool, tipo, facing.x, facing.y, target);

  return (
    <motion.div
      layout
      className="glass rounded-lg px-2 py-1.5 font-mono text-[11px]"
    >
      <div className="flex flex-wrap items-center gap-1.5 mb-1 text-[10px]">
        <span className={`px-1.5 py-0.5 rounded border ${cm.ring} ${cm.bg} ${cm.fg} font-bold`}>
          {meta.verb}
        </span>
        <span className="text-slate-500">próxima:</span>
        <span className={cm.fg}>{meta.label}</span>
        <code className="text-slate-400">({facing.x}, {facing.y})</code>
        <span className="text-slate-500 ml-auto hidden sm:inline">
          <kbd className="px-1 border border-white/10 rounded bg-white/5">Espaço</kbd>
        </span>
      </div>
      <pre className="whitespace-pre-wrap break-words text-slate-200 leading-tight">
        {highlightSql(sql)}
      </pre>
    </motion.div>
  );
}

// ============================================================================
// Toolbar com tooltips educacionais
// ============================================================================
interface ToolbarProps {
  tipo: Tipo; setTipo: (t: Tipo) => void;
  tool: Tool; setTool: (t: Tool) => void;
}

function Toolbar({ tipo, setTipo, tool, setTool }: ToolbarProps) {
  return (
    <div className="flex flex-wrap gap-2 items-center justify-center text-xs font-mono">
      <div className="flex items-center gap-1 glass rounded-lg p-1">
        <span className="px-2 py-1 text-slate-500 text-[10px]">TIPO</span>
        {(Object.keys(TIPO_META) as Tipo[]).map((id) => {
          const meta = TIPO_META[id];
          const Icon = meta.icon;
          const active = tipo === id;
          const cm = COLOR_MAP[id === 'servidor' ? 'cyan' : id === 'banco' ? 'violet' : id === 'cache' ? 'amber' : 'emerald'];
          return (
            <motion.button
              key={id}
              onClick={() => setTipo(id)}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              title={`Tipo de objeto a criar: ${meta.label}`}
              className={`px-2 py-1 rounded-md flex items-center gap-1 border transition-colors ${active ? `${cm.ring} ${cm.bg} ${cm.fg}` : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
            >
              <Icon className="w-3 h-3" />
              <span className="hidden sm:inline">{id}</span>
            </motion.button>
          );
        })}
      </div>
      <div className="flex items-center gap-1 glass rounded-lg p-1">
        <span className="px-2 py-1 text-slate-500 text-[10px]">TOOL</span>
        {(Object.keys(TOOL_META) as Tool[]).map((id, i) => {
          const meta = TOOL_META[id];
          const Icon = meta.icon;
          const active = tool === id;
          const cm = COLOR_MAP[meta.color];
          const shortcut = i + 1;
          return (
            <motion.button
              key={id}
              onClick={() => setTool(id)}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              title={`${meta.hint} → ${meta.verb} ${meta.sqlKeyword}  ·  atalho: ${shortcut}`}
              className={`relative px-2 py-1 rounded-md flex items-center gap-1 border transition-colors ${active ? `${cm.ring} ${cm.bg} ${cm.fg}` : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
            >
              <Icon className="w-3 h-3" />
              {meta.label}
              <kbd className={`hidden sm:inline-block ml-1 px-1 text-[9px] rounded ${active ? 'bg-white/10' : 'bg-white/5'} text-slate-400`}>
                {shortcut}
              </kbd>
            </motion.button>
          );
        })}
      </div>
    </div>
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

type Direction = 'up' | 'down' | 'left' | 'right';

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
    facing: { x: 5, y: 9 },
    custom: { shirt: 'teal', hat: 'cyan', skin: 'tan' },
  });
  const cbRef = useRef<{
    create?: (x: number, y: number) => void;
    update?: (o: Objeto) => void;
    del?: (o: Objeto) => void;
    read?: () => void;
  }>({});

  // EDUCATIONAL: store é JS sem types — anotamos o param e fazemos cast no retorno.
  const objetos = useGameStore((s: any) => s.objetos as Objeto[]);
  const userName = useGameStore((s: any) => s.userName as string | null);
  const tutorialStep = useGameStore((s: any) => s.tutorialStep as TutStep);
  const playerCustom = useGameStore((s: any) => s.playerCustom as PlayerCustom);
  const setUserName = useGameStore((s: any) => s.setUserName as (n: string) => void);
  const setTutorialStep = useGameStore((s: any) => s.setTutorialStep as (st: TutStep) => void);
  const setPlayerCustom = useGameStore((s: any) => s.setPlayerCustom as (c: PlayerCustom) => void);

  const [tipo, setTipo] = useState<Tipo>('servidor');
  const [tool, setTool] = useState<Tool>('build');
  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState<FacingTile>({ x: 5, y: 9 });

  useObjetos();
  // EDUCATIONAL: hooks vêm de queries.js (JS). TS infere `void` por falta de
  // tipos lá — usamos um shim local com a tipagem certa do payload.
  type Mutate<P> = (p: P, opts?: { onSuccess?: (d: unknown) => void; onError?: (e: { status?: number; message?: string }) => void }) => void;
  const createMut = useCreateObjeto() as unknown as { mutate: Mutate<{ tipo: Tipo; pos_x: number; pos_y: number }> };
  const updateMut = useUpdateObjeto() as unknown as { mutate: Mutate<{ id: number | string; status: Status }> };
  const deleteMut = useDeleteObjeto() as unknown as { mutate: Mutate<number | string> };

  // Carrega nome + progresso do tutorial + customização do localStorage.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedName = localStorage.getItem(USER_NAME_KEY);
      const tutDone = localStorage.getItem(TUTORIAL_DONE_KEY) === '1';
      const savedCustom = localStorage.getItem(PLAYER_CUSTOM_KEY);
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
      localStorage.setItem(USER_NAME_KEY, name);
      localStorage.setItem(PLAYER_CUSTOM_KEY, JSON.stringify(custom));
    } catch { }
    setUserName(name);
    setPlayerCustom(custom);
    setTutorialStep('intro');
  }, [setUserName, setPlayerCustom, setTutorialStep]);

  const onSkipAll = useCallback(() => {
    try {
      localStorage.setItem(USER_NAME_KEY, 'jogador');
      localStorage.setItem(TUTORIAL_DONE_KEY, '1');
    } catch { }
    setUserName('jogador');
    setTutorialStep('off');
  }, [setUserName, setTutorialStep]);

  const startTutorial = useCallback(() => setTutorialStep('move'), [setTutorialStep]);

  const finishTutorial = useCallback(() => {
    try { localStorage.setItem(TUTORIAL_DONE_KEY, '1'); } catch { }
    setTutorialStep('off');
  }, [setTutorialStep]);

  // EDUCATIONAL: atalhos de teclado pra trocar tool sem usar mouse.
  // 1=BUILD, 2=UPGRADE, 3=DELETE, Tab cicla (Shift+Tab cicla pra trás).
  // Pula se foco está num input (welcome modal por exemplo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === '1') { e.preventDefault(); setTool('build'); }
      else if (e.key === '2') { e.preventDefault(); setTool('upgrade'); }
      else if (e.key === '3') { e.preventDefault(); setTool('delete'); }
      else if (e.key === 'Tab') {
        e.preventDefault();
        const order: Tool[] = ['build', 'upgrade', 'delete'];
        const idx = order.indexOf(stateRef.current.tool);
        const dir = e.shiftKey ? -1 : 1;
        setTool(order[(idx + dir + 3) % 3]);
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
  const facingRef = useRef<FacingTile>({ x: 5, y: 9 });
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
      if (tileOcupado(x, y)) return notifyApi({ method: 'POST', status: 409, ms: 0 });
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
            // floating "+1 servidor" estilo RPG + camera shake leve
            spawnFloatingText(kRef.current, `+1 ${tipo}`, x, y - 1, [16, 185, 129], 11);
            cameraShake(kRef.current, 1.5, 0.18);
            advanceIf('create', 'read');
          },
          onError: (e: any) =>
            notifyApi({ method: 'POST', status: e.status || 500, ms: Math.round(performance.now() - start) }),
        }
      );
    };
    cbRef.current.update = (obj) => {
      const start = performance.now();
      const next = STATUS_NEXT[obj.status];
      const fromStatus = obj.status;
      updateMut.mutate(
        { id: obj.id as number, status: next },
        {
          onSuccess: () => {
            notifyApi({ method: 'PUT', status: 200, ms: Math.round(performance.now() - start) });
            spawnSqlBubble(kRef.current, `SET status='${next}'`, obj.pos_x, obj.pos_y, [251, 191, 36]);
            // texto flutuante "novo → ativo" + estrelas rodando + shake
            spawnFloatingText(kRef.current, `${fromStatus} → ${next}`, obj.pos_x, obj.pos_y - 1, [251, 191, 36], 10);
            spawnLevelUpStars(kRef.current, obj.pos_x * TILE + TILE / 2, obj.pos_y * TILE + TILE / 2, [251, 191, 36]);
            cameraShake(kRef.current, 1.2, 0.15);
            advanceIf('update', 'delete');
          },
          onError: (e: any) =>
            notifyApi({ method: 'PUT', status: e.status || 500, ms: Math.round(performance.now() - start) }),
        }
      );
    };
    cbRef.current.del = (obj) => {
      const start = performance.now();
      deleteMut.mutate(obj.id as number, {
        onSuccess: () => {
          notifyApi({ method: 'DELETE', status: 200, ms: Math.round(performance.now() - start) });
          spawnSqlBubble(kRef.current, `DELETE id=${obj.id}`, obj.pos_x, obj.pos_y, [244, 63, 94]);
          spawnFloatingText(kRef.current, `-1`, obj.pos_x, obj.pos_y - 1, [244, 63, 94], 12);
          cameraShake(kRef.current, 3, 0.25);
          advanceIf('delete', 'done');
        },
        onError: (e: any) =>
          notifyApi({ method: 'DELETE', status: e.status || 500, ms: Math.round(performance.now() - start) }),
      });
    };
    cbRef.current.read = () => {
      notifyApi({ method: 'GET', status: 200, ms: 0 });
      spawnSqlBubble(kRef.current, `SELECT *`, 0, 0, [34, 211, 238]);
      spawnFloatingText(kRef.current, `SELECT *`, 0, -1, [34, 211, 238], 10);
      advanceIf('read', 'update');
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
        crisp: false,
        global: false,
        debug: false,
        touchToMouse: true,
      });
      kRef.current = k;
      const K_ = k as K;

      // Tiles do data center
      drawDataCenterFloor(K_);

      // Read panel "?" no canto (0,0)
      K_.add([
        K_.rect(TILE - 6, TILE - 6, { radius: 6 }),
        K_.pos(3, 3),
        K_.color(34, 211, 238),
        K_.opacity(0.18),
        K_.outline(2, K_.rgb(34, 211, 238)),
        K_.z(0),
      ]);
      K_.add([
        K_.rect(TILE - 14, TILE - 14, { radius: 4 }),
        K_.pos(7, 7),
        K_.color(8, 14, 28),
        K_.outline(1, K_.rgb(34, 211, 238)),
        K_.z(1),
      ]);
      K_.add([
        K_.text('?', { size: 16 }),
        K_.pos(TILE / 2 - 4, TILE / 2 - 10),
        K_.color(34, 211, 238),
        K_.z(2),
      ]);
      K_.add([
        K_.text('READ', { size: 6 }),
        K_.pos(8, TILE - 12),
        K_.color(34, 211, 238),
        K_.opacity(0.6),
        K_.z(2),
      ]);

      // Partículas ambiente — pontos lentos como pacotes de dados
      spawnAmbientParticles(K_);

      // Player
      const player = K_.add([
        K_.pos(5 * TILE + TILE / 2, 9 * TILE + TILE / 2),
        K_.anchor('center'),
        K_.z(5),
        {
          targetPos: K_.vec2(5 * TILE + TILE / 2, 9 * TILE + TILE / 2),
          tileX: 5,
          tileY: 9,
          dir: 'down' as Direction,
          frame: 0,
          frameTime: 0,
          moving: false,
          bobble: 0,
          update() {
            this.pos.x = K_.lerp(this.pos.x, this.targetPos.x, 0.22);
            this.pos.y = K_.lerp(this.pos.y, this.targetPos.y, 0.22);
            this.frameTime += K_.dt();
            this.bobble += K_.dt() * 4;
            if (this.frameTime > 0.13) {
              this.frameTime = 0;
              this.frame = this.moving ? (this.frame + 1) % 4 : 0;
            }
            this.moving = false;
            // facing
            const dx = this.dir === 'right' ? 1 : this.dir === 'left' ? -1 : 0;
            const dy = this.dir === 'down' ? 1 : this.dir === 'up' ? -1 : 0;
            const fx = Math.max(0, Math.min(COLS - 1, this.tileX + dx));
            const fy = Math.max(0, Math.min(ROWS - 1, this.tileY + dy));
            stateRef.current.facing = { x: fx, y: fy };
          },
          draw() {
            drawDevopsSprite(K_, this.frame, this.dir, this.bobble, stateRef.current.custom);
          },
        },
      ]);

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
            if (f.x === 0 && f.y === 0) return; // já desenhado como "?" panel
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
      const syncObjects = () => {
        const objs = stateRef.current.objetos;
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
          } else {
            spawnDeleteParticles(K_, node.pos.x, node.pos.y);
            node.destroy();
            objNodes.delete(id);
          }
        }

        // Pass 2 — adiciona ou atualiza
        for (const o of objs) {
          const existing = objNodes.get(o.id);
          if (!existing) {
            const node = makeObjectNode(K_, o);
            objNodes.set(o.id, node);
          } else if (existing.objStatus !== o.status || existing.objTipo !== o.tipo) {
            existing.objStatus = o.status;
            existing.objTipo = o.tipo;
            K_.tween(1.18, 1, 0.28, (v: number) => (existing.scale = K_.vec2(v, v)), K_.easings.easeOutQuad);
          }
        }
      };
      let lastObjs = stateRef.current.objetos;
      const unsub = useGameStore.subscribe((state: { objetos: Objeto[] }) => {
        const next = state.objetos;
        if (next !== lastObjs) {
          lastObjs = next;
          syncObjects();
        }
      });
      syncObjects();

      // Câmera segue o player com smooth-follow
      // EDUCATIONAL: kaplay 3001+ usa getCamPos / setCamPos (camPos() está deprecado).
      K_.onUpdate(() => {
        const cur = K_.getCamPos();
        const cx = K_.lerp(cur.x, player.pos.x, 0.06);
        const cy = K_.lerp(cur.y, player.pos.y, 0.06);
        const halfW = K_.width() / 2;
        const halfH = K_.height() / 2;
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
        if (tileOcupado(nx, ny)) {
          player.moving = true;
          return;
        }
        if (nx === player.tileX && ny === player.tileY) return;
        player.tileX = nx;
        player.tileY = ny;
        player.targetPos = K_.vec2(nx * TILE + TILE / 2, ny * TILE + TILE / 2);
        player.moving = true;
        // Tutorial: 'move' avança para 'create' assim que o jogador anda.
        const cur = useGameStore.getState().tutorialStep;
        if (cur === 'move') useGameStore.getState().setTutorialStep('create');
      };

      const interact = () => {
        const f = stateRef.current.facing;
        if (f.x === 0 && f.y === 0) {
          cbRef.current.read?.();
          spawnReadWaves(K_, TILE / 2, TILE / 2);
          return;
        }
        const obj = tileOcupado(f.x, f.y);
        const t = stateRef.current.tool;
        if (!obj) {
          if (t === 'build') {
            spawnCreateParticles(K_, f.x * TILE + TILE / 2, f.y * TILE + TILE / 2);
            flashTile(K_, f.x, f.y, [16, 185, 129]);
            cbRef.current.create?.(f.x, f.y);
          }
          return;
        }
        if (t === 'upgrade') {
          flashTile(K_, f.x, f.y, [251, 191, 36]);
          spawnUpdateRing(K_, f.x * TILE + TILE / 2, f.y * TILE + TILE / 2);
          cbRef.current.update?.(obj as Objeto);
        } else if (t === 'delete') {
          flashTile(K_, f.x, f.y, [244, 63, 94]);
          // EDUCATIONAL: remove o nó visualmente NA HORA, sem esperar o servidor.
          // O optimistic update no React Query / Zustand vai concordar logo em seguida.
          // Se o DELETE falhar no servidor (raro), o syncObjects recria pelo store revertido.
          const node = objNodes.get(obj.id);
          if (node) {
            spawnDeleteParticles(K_, node.pos.x, node.pos.y);
            try { node.destroy(); } catch { }
            objNodes.delete(obj.id);
          }
          cbRef.current.del?.(obj as Objeto);
        }
      };

      K_.onKeyPress(['up', 'w'], () => tryMove('up'));
      K_.onKeyPress(['down', 's'], () => tryMove('down'));
      K_.onKeyPress(['left', 'a'], () => tryMove('left'));
      K_.onKeyPress(['right', 'd'], () => tryMove('right'));
      K_.onKeyPress(['space', 'enter'], interact);

      // Repetição quando segura
      let repeatTimer = 0;
      K_.onUpdate(() => {
        repeatTimer += K_.dt();
        if (repeatTimer < 0.16) return;
        repeatTimer = 0;
        if (K_.isKeyDown('up') || K_.isKeyDown('w')) tryMove('up');
        else if (K_.isKeyDown('down') || K_.isKeyDown('s')) tryMove('down');
        else if (K_.isKeyDown('left') || K_.isKeyDown('a')) tryMove('left');
        else if (K_.isKeyDown('right') || K_.isKeyDown('d')) tryMove('right');
      });

      kRef.current.__moveDir = tryMove;
      kRef.current.__interact = interact;
      kRef.current.__cleanup = unsub;

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
      <Toolbar tipo={tipo} setTipo={setTipo} tool={tool} setTool={setTool} />

      <SqlPreviewBar tool={tool} tipo={tipo} facing={facing} target={target} />

      <div className="relative flex-1 min-h-0 w-full flex items-center justify-center">
        <div
          className="relative w-full h-full flex items-center justify-center"
        >
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="block max-w-full max-h-full rounded-xl border border-cyan-400/15 shadow-[0_20px_80px_rgba(34,211,238,0.08)] bg-[#080e1c] touch-none select-none"
            style={{ aspectRatio: `${COLS}/${ROWS}`, width: 'auto', height: 'auto' }}
          />
          {/* vinheta sutil */}
          <div
            className="pointer-events-none absolute inset-0 rounded-xl"
            style={{ boxShadow: 'inset 0 0 80px rgba(0,0,0,0.55)' }}
          />
          {/* EDUCATIONAL: tutorial banner agora flutua no topo do canvas
              em vez de roubar espaço vertical do layout. */}
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
          {!ready && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-slate-900/80">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/favicon.ico"
                alt="CRUD Dungeon"
                width={64}
                height={64}
                className="rounded-xl animate-pulse shadow-[0_0_40px_rgba(34,211,238,0.4)]"
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
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Drawing helpers — tema "Data Center"
// ============================================================================
function drawDataCenterFloor(k: K) {
  // EDUCATIONAL: tiles em camadas — base + textura de circuito + vinheta sutil.
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const variant = (x + y) % 2 === 0 ? 1 : 0;
      // base
      k.add([
        k.rect(TILE, TILE),
        k.pos(x * TILE, y * TILE),
        k.color(11 + variant * 3, 18 + variant * 3, 36 + variant * 4),
        k.z(-3),
      ]);
      // micro-traço de circuito (decorativo, em ~30% dos tiles)
      const seed = (x * 31 + y * 17) % 100;
      if (seed < 30) {
        const which = seed % 3;
        if (which === 0) {
          // linha horizontal
          k.add([
            k.rect(TILE - 8, 1),
            k.pos(x * TILE + 4, y * TILE + TILE / 2),
            k.color(34, 211, 238),
            k.opacity(0.08),
            k.z(-2),
          ]);
        } else if (which === 1) {
          // L de circuito
          k.add([
            k.rect(1, TILE / 2 - 4),
            k.pos(x * TILE + TILE / 2, y * TILE + 4),
            k.color(34, 211, 238),
            k.opacity(0.1),
            k.z(-2),
          ]);
          k.add([
            k.rect(TILE / 2 - 4, 1),
            k.pos(x * TILE + TILE / 2, y * TILE + TILE / 2 - 1),
            k.color(34, 211, 238),
            k.opacity(0.1),
            k.z(-2),
          ]);
        } else {
          // ponto/nó
          k.add([
            k.circle(1.5),
            k.pos(x * TILE + TILE / 2, y * TILE + TILE / 2),
            k.color(167, 139, 250),
            k.opacity(0.25),
            k.z(-2),
          ]);
        }
      }
    }
  }
  // grid lines, bem sutis
  k.onDraw(() => {
    for (let x = 0; x <= COLS; x++) {
      k.drawLine({
        p1: k.vec2(x * TILE, 0),
        p2: k.vec2(x * TILE, H),
        color: k.rgb(34, 211, 238),
        opacity: 0.05,
        width: 1,
      });
    }
    for (let y = 0; y <= ROWS; y++) {
      k.drawLine({
        p1: k.vec2(0, y * TILE),
        p2: k.vec2(W, y * TILE),
        color: k.rgb(34, 211, 238),
        opacity: 0.05,
        width: 1,
      });
    }
  });
}

function spawnAmbientParticles(k: K) {
  // EDUCATIONAL: pontos lentos atravessam o mapa, sugerindo "dados em trânsito".
  for (let i = 0; i < 18; i++) {
    spawnAmbientParticle(k);
  }
  k.loop(0.6, () => spawnAmbientParticle(k));
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
function drawDevopsSprite(k: K, frame: number, dir: Direction, bobble: number, custom: PlayerCustom) {
  // EDUCATIONAL: sprite procedural, 4 frames. Cores customizáveis via PlayerCustom.
  const shirt = PLAYER_PRESETS.shirt[custom.shirt];
  const hat = PLAYER_PRESETS.hat[custom.hat];
  const skin = PLAYER_PRESETS.skin[custom.skin];

  // sombra
  k.drawEllipse({
    pos: k.vec2(0, 14), radiusX: 9, radiusY: 2.5,
    color: k.rgb(0, 0, 0), opacity: 0.5,
  });

  const bob = Math.sin(bobble) * 0.7;
  const legOffset = [0, 1.5, 0, -1.5][frame] ?? 0;

  // pernas
  k.drawRect({ pos: k.vec2(-5, 7 + legOffset), width: 4, height: 7, color: k.rgb(15, 23, 42), radius: 1 });
  k.drawRect({ pos: k.vec2(1, 7 - legOffset), width: 4, height: 7, color: k.rgb(15, 23, 42), radius: 1 });

  // corpo (camisa)
  k.drawRect({ pos: k.vec2(-7, -3 + bob), width: 14, height: 11, color: k.rgb(...shirt.rgb), radius: 2 });
  // estampa central
  k.drawRect({ pos: k.vec2(-1, 0 + bob), width: 2, height: 5, color: k.rgb(...shirt.accent), opacity: 0.85 });
  // braços
  k.drawRect({ pos: k.vec2(-9, -2 + bob + (frame % 2 === 0 ? 0 : 1)), width: 3, height: 8, color: k.rgb(...shirt.rgb), radius: 1 });
  k.drawRect({ pos: k.vec2(6, -2 + bob - (frame % 2 === 0 ? 0 : 1)), width: 3, height: 8, color: k.rgb(...shirt.rgb), radius: 1 });

  // cabeça (skin)
  k.drawRect({ pos: k.vec2(-5, -12 + bob), width: 10, height: 9, color: k.rgb(...skin.rgb), radius: 2 });

  // olhos
  const eye = (x: number, y: number, w = 1.6, h = 1.6) =>
    k.drawRect({ pos: k.vec2(x, y + bob), width: w, height: h, color: k.rgb(15, 23, 42) });
  if (dir === 'down') { eye(-3, -8); eye(2, -8); }
  if (dir === 'up') { eye(-3, -10, 1.6, 1); eye(2, -10, 1.6, 1); }
  if (dir === 'left') { eye(-4, -8, 2, 1.6); }
  if (dir === 'right') { eye(2, -8, 2, 1.6); }

  // hat (opcional — preset 'none' não desenha)
  if (hat.rgb) {
    k.drawRect({ pos: k.vec2(-6, -16 + bob), width: 12, height: 5, color: k.rgb(...hat.rgb), radius: 3 });
    if (hat.shade) {
      k.drawRect({ pos: k.vec2(-7, -12 + bob), width: 14, height: 1.5, color: k.rgb(...hat.shade) });
    }
    k.drawRect({ pos: k.vec2(-3, -15 + bob), width: 3, height: 1, color: k.rgb(255, 255, 255), opacity: 0.6 });
  }
}

// ===== Object node (renderiza ícone segundo o tipo) =====
function makeObjectNode(k: K, o: Objeto) {
  // EDUCATIONAL: drop-from-sky entrance. O objeto cai do alto + bounce + pulse.
  const cx = o.pos_x * TILE + TILE / 2;
  const cy = o.pos_y * TILE + TILE / 2;
  const node = k.add([
    k.pos(cx, cy - 80),
    k.anchor('center'),
    k.scale(0.3),
    k.opacity(0),
    k.z(0),
    {
      objStatus: o.status,
      objTipo: o.tipo,
      tileX: o.pos_x,
      tileY: o.pos_y,
      pulseT: 0,
      update() {
        this.pulseT += k.dt() * 2;
      },
      draw() {
        drawObjectByType(k, this.objTipo, this.objStatus, this.pulseT);
      },
    },
  ]);
  // queda + bounce + scale-up em paralelo
  k.tween(cy - 80, cy, 0.45, (v: number) => (node.pos.y = v), k.easings.easeOutBounce);
  k.tween(0.3, 1.15, 0.35, (v: number) => (node.scale = k.vec2(v, v)), k.easings.easeOutQuad);
  k.wait(0.35, () => {
    k.tween(1.15, 1, 0.18, (v: number) => (node.scale = k.vec2(v, v)), k.easings.easeOutQuad);
  });
  k.tween(0, 1, 0.25, (v: number) => (node.opacity = v), k.easings.easeOutQuad);
  // shockwave no chão quando aterrissa
  k.wait(0.4, () => spawnShockwave(k, cx, cy));
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

// EDUCATIONAL: status forma uma "barra de progresso" — cada UPDATE adiciona
// detalhes ao ícone. Metáfora: livro vazio → 1 livro → 2 livros → estante cheia.
const STATUS_LEVEL: Record<Status, number> = { novo: 0, ativo: 1, upgrade: 2, critico: 3 };

function drawObjectByType(k: K, tipo: Tipo, status: Status, pulseT: number) {
  const t = TIPO_META[tipo].color;
  const s = STATUS_META[status].color;
  const level = STATUS_LEVEL[status];
  const blink = status === 'critico' ? 0.5 + 0.5 * Math.sin(pulseT * 4) : 1;
  const isMax = level === 3;

  // Halo de status (atrás)
  k.drawRect({
    pos: k.vec2(-(TILE - 6) / 2, -(TILE - 6) / 2),
    width: TILE - 6,
    height: TILE - 6,
    color: k.rgb(s[0], s[1], s[2]),
    opacity: 0.18 * blink,
    radius: 6,
  });
  // Outline status
  k.drawRect({
    pos: k.vec2(-(TILE - 6) / 2, -(TILE - 6) / 2),
    width: TILE - 6,
    height: TILE - 6,
    fill: false,
    outline: { width: 2, color: k.rgb(s[0], s[1], s[2]), opacity: 0.85 * blink },
    radius: 6,
  });
  // Glow extra quando crítico (status máximo)
  if (isMax) {
    k.drawRect({
      pos: k.vec2(-(TILE - 2) / 2, -(TILE - 2) / 2),
      width: TILE - 2,
      height: TILE - 2,
      fill: false,
      outline: { width: 1, color: k.rgb(s[0], s[1], s[2]), opacity: 0.4 * blink },
      radius: 8,
    });
  }

  if (tipo === 'servidor') {
    // ===== Server rack: progressivo de 0→3 LEDs =====
    k.drawRect({
      pos: k.vec2(-7, -10), width: 14, height: 20,
      color: k.rgb(t[0], t[1], t[2]),
      opacity: 0.55 + 0.15 * level,
      radius: 2,
    });
    for (let i = 0; i < level; i++) {
      k.drawRect({
        pos: k.vec2(-5, -7 + i * 6), width: 10, height: 1.5,
        color: k.rgb(255, 255, 255), opacity: 0.7,
      });
      k.drawCircle({
        pos: k.vec2(5, -6 + i * 6), radius: 1,
        color: k.rgb(34, 197, 94),
        opacity: 0.6 + 0.4 * Math.sin(pulseT + i),
      });
    }
    if (isMax) {
      k.drawCircle({
        pos: k.vec2(0, -12), radius: 1.2,
        color: k.rgb(34, 197, 94),
        opacity: 0.7 + 0.3 * Math.sin(pulseT * 2),
      });
    }
  } else if (tipo === 'banco') {
    // ===== Database: progressivo de 0→3 "registros" (a metáfora dos livros!) =====
    // cilindro sempre desenhado
    k.drawEllipse({
      pos: k.vec2(0, -9), radiusX: 8, radiusY: 3,
      color: k.rgb(t[0], t[1], t[2]), opacity: 0.95,
    });
    k.drawRect({
      pos: k.vec2(-8, -9), width: 16, height: 18,
      color: k.rgb(t[0], t[1], t[2]),
      opacity: 0.45 + 0.15 * level,
    });
    k.drawEllipse({
      pos: k.vec2(0, 9), radiusX: 8, radiusY: 3,
      color: k.rgb(t[0], t[1], t[2]), opacity: 0.95,
    });
    // "registros" empilhados de baixo pra cima — começa vazio, vai enchendo
    for (let i = 0; i < level; i++) {
      k.drawEllipse({
        pos: k.vec2(0, 5 - i * 5),
        radiusX: 8, radiusY: 2,
        fill: false,
        outline: { width: 1, color: k.rgb(255, 255, 255), opacity: 0.6 },
      });
    }
    if (isMax) {
      // halo extra "estante cheia"
      k.drawEllipse({
        pos: k.vec2(0, -9), radiusX: 9.5, radiusY: 4,
        fill: false,
        outline: { width: 1, color: k.rgb(t[0], t[1], t[2]), opacity: 0.5 + 0.3 * Math.sin(pulseT * 1.5) },
      });
    }
  } else if (tipo === 'cache') {
    // ===== Cache (raio): progressivo — bolt + sparks ao redor =====
    // bolt sempre. opacity cresce com level.
    k.drawPolygon({
      pts: [
        k.vec2(-1, -10), k.vec2(5, -10), k.vec2(1, -2),
        k.vec2(6, -2), k.vec2(-3, 10), k.vec2(0, 1), k.vec2(-5, 1),
      ],
      color: k.rgb(t[0], t[1], t[2]),
      opacity: 0.55 + 0.15 * level,
      outline: { width: 1, color: k.rgb(255, 255, 255), opacity: 0.4 + 0.2 * level },
    });
    // sparks adicionais ao redor (1 por level extra)
    const sparkPositions: [number, number][] = [[-9, -8], [9, -8], [-10, 6], [9, 7]];
    for (let i = 0; i < level; i++) {
      const [sx, sy] = sparkPositions[i];
      k.drawCircle({
        pos: k.vec2(sx, sy), radius: 1.2,
        color: k.rgb(t[0], t[1], t[2]),
        opacity: 0.5 + 0.5 * Math.sin(pulseT * 2 + i),
      });
    }
    if (isMax) {
      k.drawCircle({
        pos: k.vec2(0, 0), radius: 12, fill: false,
        outline: { width: 1, color: k.rgb(t[0], t[1], t[2]), opacity: 0.3 + 0.2 * Math.sin(pulseT * 2) },
      });
    }
  } else if (tipo === 'router') {
    // ===== Router: progressivo — center + 0→4 arms =====
    const arms: [number, number][] = [[0, -9], [9, 0], [0, 9], [-9, 0]];
    for (let i = 0; i < level; i++) {
      const [ax, ay] = arms[i];
      k.drawLine({
        p1: k.vec2(0, 0), p2: k.vec2(ax, ay),
        color: k.rgb(t[0], t[1], t[2]), width: 2, opacity: 0.7,
      });
      k.drawCircle({
        pos: k.vec2(ax, ay), radius: 2.5,
        color: k.rgb(t[0], t[1], t[2]),
      });
    }
    // 4ª arm extra quando crítico
    if (isMax) {
      const [ax, ay] = arms[3];
      k.drawLine({
        p1: k.vec2(0, 0), p2: k.vec2(ax, ay),
        color: k.rgb(t[0], t[1], t[2]), width: 2, opacity: 0.7,
      });
      k.drawCircle({
        pos: k.vec2(ax, ay), radius: 2.5,
        color: k.rgb(t[0], t[1], t[2]),
      });
    }
    // center sempre
    k.drawCircle({
      pos: k.vec2(0, 0), radius: 4,
      color: k.rgb(t[0], t[1], t[2]),
      opacity: 0.6 + 0.13 * level,
    });
    k.drawCircle({
      pos: k.vec2(0, 0), radius: 4, fill: false,
      outline: { width: 1, color: k.rgb(255, 255, 255), opacity: 0.5 },
    });
    if (isMax) {
      k.drawCircle({
        pos: k.vec2(0, 0), radius: 13, fill: false,
        outline: { width: 1, color: k.rgb(t[0], t[1], t[2]), opacity: 0.3 + 0.15 * Math.sin(pulseT * 1.5) },
      });
    }
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
