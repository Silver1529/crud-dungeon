// lib/game/constants.ts
// EDUCATIONAL: tipos + constantes compartilhados entre o engine kaplay e os
// componentes React (Toolbar, NameStep, etc). Manter aqui evita duplicação
// e deixa o GameEngine.tsx focado em orquestração.
import type { ComponentType } from 'react';
import { Hammer, Wrench, Trash2, Search, Server, Database, Zap, Network } from 'lucide-react';

// ===== Domínio do jogo =====
export type Tipo = 'servidor' | 'banco' | 'cache' | 'router';
export type Tool = 'build' | 'upgrade' | 'delete' | 'inspect';
export type Status = 'novo' | 'ativo' | 'upgrade' | 'critico';
export type Direction = 'up' | 'down' | 'left' | 'right';
// Nível visual da casa: 1=base, 2=upgrade1, 3=upgrade2 (cap).
export type Level = 1 | 2 | 3;

export interface Objeto {
  id: number | string;
  tipo: Tipo;
  status: Status;
  pos_x: number;
  pos_y: number;
  level?: number; // server sempre devolve, optional só pra compat com payload tmp- antigo.
}

export interface FacingTile { x: number; y: number; }

// "Any" para o instance kaplay (tipos do KAPLAYCtx são gigantescos).
export type K = any;

// ===== Geometria do tabuleiro =====
// EDUCATIONAL: 40×28 = 1120 tiles. Câmera com zoom 1.5× compensa o tamanho.
// Posições antigas (até 19/14) continuam válidas no novo grid.
export const TILE = 48;
export const COLS = 40;
export const ROWS = 28;
export const W = COLS * TILE;
export const H = ROWS * TILE;
export const SPAWN_X = 20;
export const SPAWN_Y = 14;
export const CAM_SCALE = 1.5;

// ===== Metadados visuais por tipo / status / tool =====
export const TIPO_META: Record<Tipo, { color: [number, number, number]; label: string; icon: ComponentType<{ className?: string }> }> = {
  servidor: { color: [34, 211, 238],  label: 'servidor', icon: Server },
  banco:    { color: [167, 139, 250], label: 'banco',    icon: Database },
  cache:    { color: [251, 191, 36],  label: 'cache',    icon: Zap },
  router:   { color: [16, 185, 129],  label: 'router',   icon: Network },
};

export const STATUS_META: Record<Status, { color: [number, number, number]; label: string }> = {
  novo:    { color: [148, 163, 184], label: 'novo' },
  ativo:   { color: [34, 197, 94],   label: 'ativo' },
  upgrade: { color: [234, 179, 8],   label: 'upgrade' },
  critico: { color: [239, 68, 68],   label: 'critico' },
};

// EDUCATIONAL: nível visual da casa. Sprites em /public:
//   level 1 → casa.png      (simples)
//   level 2 → casav2.png    (intermediária)
//   level 3 → casa v3.png   (avançada — note o espaço no nome)
export const LEVEL_META: Record<Level, { sprite: string; label: string; emoji: string; color: [number, number, number] }> = {
  1: { sprite: '/casa.png',        label: 'simples',       emoji: '🏠', color: [148, 163, 184] },
  2: { sprite: '/casav2.png',      label: 'intermediária', emoji: '🏡', color: [251, 191, 36] },
  3: { sprite: '/casa%20v3.png',   label: 'avançada',      emoji: '🏛️', color: [167, 139, 250] },
};

export const STATUS_BY_LEVEL: Record<Level, Status> = {
  1: 'novo',
  2: 'ativo',
  3: 'upgrade',
};

// kept for backward-compat: o status agora é derivado do level pelo server.
// Mantemos o mapping pra código antigo (logs, animations) que ainda lê status.
export const STATUS_NEXT: Record<Status, Status> = {
  novo: 'ativo',
  ativo: 'upgrade',
  upgrade: 'critico',
  critico: 'novo',
};

export const STATUS_LEVEL: Record<Status, number> = {
  novo: 0, ativo: 1, upgrade: 2, critico: 3,
};

export const TOOL_META: Record<Tool, {
  label: string;
  icon: ComponentType<{ className?: string }>;
  verb: 'POST' | 'PUT' | 'DELETE' | 'GET';
  sqlKeyword: 'INSERT' | 'UPDATE' | 'DELETE' | 'SELECT';
  color: 'emerald' | 'amber' | 'rose' | 'cyan';
  hint: string;
}> = {
  build:   { label: 'BUILD',   icon: Hammer, verb: 'POST',   sqlKeyword: 'INSERT', color: 'emerald', hint: 'Construir uma casa nova (CREATE · INSERT)' },
  upgrade: { label: 'UPGRADE', icon: Wrench, verb: 'PUT',    sqlKeyword: 'UPDATE', color: 'amber',   hint: 'Evoluir a casa para o próximo nível (UPDATE)' },
  delete:  { label: 'DELETE',  icon: Trash2, verb: 'DELETE', sqlKeyword: 'DELETE', color: 'rose',    hint: 'Apagar a casa do banco (DELETE)' },
  inspect: { label: 'INSPECT', icon: Search, verb: 'GET',    sqlKeyword: 'SELECT', color: 'cyan',    hint: 'Ler os dados desta casa (READ · SELECT WHERE id=...)' },
};

export const COLOR_MAP = {
  emerald: { ring: 'border-emerald-400/40', bg: 'bg-emerald-400/10', fg: 'text-emerald-300' },
  amber:   { ring: 'border-amber-400/40',   bg: 'bg-amber-400/10',   fg: 'text-amber-300' },
  rose:    { ring: 'border-rose-400/40',    bg: 'bg-rose-400/10',    fg: 'text-rose-300' },
  cyan:    { ring: 'border-cyan-400/40',    bg: 'bg-cyan-400/10',    fg: 'text-cyan-300' },
  violet:  { ring: 'border-violet-400/40',  bg: 'bg-violet-400/10',  fg: 'text-violet-300' },
} as const;

// ===== Customização do player =====
export const PLAYER_PRESETS = {
  shirt: {
    teal:    { rgb: [15, 118, 110]  as [number, number, number], bg: 'bg-teal-700',    accent: [34, 211, 238]  as [number, number, number] },
    rose:    { rgb: [225, 29, 72]   as [number, number, number], bg: 'bg-rose-600',    accent: [254, 205, 211] as [number, number, number] },
    indigo:  { rgb: [67, 56, 202]   as [number, number, number], bg: 'bg-indigo-700',  accent: [165, 180, 252] as [number, number, number] },
    emerald: { rgb: [4, 120, 87]    as [number, number, number], bg: 'bg-emerald-700', accent: [110, 231, 183] as [number, number, number] },
    orange:  { rgb: [194, 65, 12]   as [number, number, number], bg: 'bg-orange-700',  accent: [253, 186, 116] as [number, number, number] },
  },
  hat: {
    cyan:   { rgb: [34, 211, 238]   as [number, number, number] | null, bg: 'bg-cyan-400',   shade: [8, 145, 178]  as [number, number, number] | null },
    amber:  { rgb: [251, 191, 36]   as [number, number, number] | null, bg: 'bg-amber-400',  shade: [180, 83, 9]   as [number, number, number] | null },
    rose:   { rgb: [244, 63, 94]    as [number, number, number] | null, bg: 'bg-rose-500',   shade: [159, 18, 57]  as [number, number, number] | null },
    violet: { rgb: [167, 139, 250]  as [number, number, number] | null, bg: 'bg-violet-400', shade: [109, 40, 217] as [number, number, number] | null },
    none:   { rgb: null, bg: 'bg-slate-700', shade: null },
  },
  skin: {
    tan:    { rgb: [252, 211, 170] as [number, number, number], bg: 'bg-[#fcd3aa]' },
    light:  { rgb: [255, 224, 189] as [number, number, number], bg: 'bg-[#ffe0bd]' },
    medium: { rgb: [210, 160, 110] as [number, number, number], bg: 'bg-[#d2a06e]' },
    dark:   { rgb: [128, 80, 50]   as [number, number, number], bg: 'bg-[#805032]' },
  },
} as const;

export type ShirtKey = keyof typeof PLAYER_PRESETS.shirt;
export type HatKey = keyof typeof PLAYER_PRESETS.hat;
export type SkinKey = keyof typeof PLAYER_PRESETS.skin;
export type PlayerCustom = { shirt: ShirtKey; hat: HatKey; skin: SkinKey };

// ===== Tutorial =====
export type TutStep = 'name' | 'intro' | 'move' | 'create' | 'read' | 'update' | 'delete' | 'done' | 'off';
export type ActiveTutStep = Exclude<TutStep, 'name' | 'intro' | 'off'>;

// ===== localStorage keys =====
export const USER_NAME_KEY = 'crud_dungeon_user_v1';
export const TUTORIAL_DONE_KEY = 'crud_dungeon_tutorial_done_v1';
export const PLAYER_CUSTOM_KEY = 'crud_dungeon_player_v1';
export const QUIZ_DONE_KEY = 'crud_dungeon_quiz_done_v1';

// ===== Helpers para nivel =====
export function clampLevel(n: number | undefined): Level {
  const v = Math.max(1, Math.min(3, Math.floor(n ?? 1)));
  return v as Level;
}
