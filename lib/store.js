// lib/store.js
// EDUCATIONAL: Zustand é um store global minimalista. Sem boilerplate de
// Provider; qualquer componente (`use client`) chama `useGameStore()`.
'use client';
import { create } from 'zustand';

const MAX_LOG = 50;

const initialStats = {
  reads: 0,
  writes: 0,
  updates: 0,
  deletes: 0,
  errors: 0,
};

export const useGameStore = create((set) => ({
  objetos: [],
  sqlLog: [],
  networkLog: [],
  stats: { ...initialStats },
  csrfToken: null,

  // EDUCATIONAL: nome do jogador (persistido em localStorage).
  // Permite mensagens personalizadas no tutorial e nos parabéns.
  userName: null,
  // Step do tutorial guiado: 'name' | 'intro' | 'move' | 'create' | 'read' | 'update' | 'delete' | 'done' | 'off'
  tutorialStep: 'name',

  // Customização visual do personagem. Cada campo é uma string com a chave
  // do preset (ver PLAYER_PRESETS no GameEngine.tsx).
  playerCustom: { shirt: 'teal', hat: 'cyan', skin: 'tan' },

  // EDUCATIONAL: tool/tipo elevados pro store (antes eram local state no GameEngine).
  // Necessário porque agora o header bar (fora do GameEngine) também muda esses valores.
  tool: 'build',
  tipo: 'servidor',
  // FPS publicado pelo kaplay; usado pela barra de stats no header.
  fps: 60,

  setObjetos: (objetos) => set({ objetos }),
  setCsrfToken: (csrfToken) => set({ csrfToken }),
  setUserName: (userName) => set({ userName }),
  setTutorialStep: (tutorialStep) => set({ tutorialStep }),
  setPlayerCustom: (playerCustom) => set({ playerCustom }),
  setTool: (tool) => set({ tool }),
  setTipo: (tipo) => set({ tipo }),
  setFps: (fps) => set({ fps }),

  addSqlLog: (entry) =>
    set((s) => ({ sqlLog: [{ id: crypto.randomUUID(), ts: Date.now(), ...entry }, ...s.sqlLog].slice(0, MAX_LOG) })),

  addNetworkLog: (entry) =>
    set((s) => ({ networkLog: [{ id: crypto.randomUUID(), ts: Date.now(), ...entry }, ...s.networkLog].slice(0, MAX_LOG) })),

  incrementStat: (key, by = 1) =>
    set((s) => ({ stats: { ...s.stats, [key]: (s.stats[key] || 0) + by } })),

  resetLogs: () => set({ sqlLog: [], networkLog: [], stats: { ...initialStats } }),
}));
