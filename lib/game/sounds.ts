// lib/game/sounds.ts
// EDUCATIONAL: sons procedurais via Web Audio API. Sem assets externos —
// só ondas sintéticas curtas. Browser policy exige AudioContext criado após
// interação do user, então lazy-init na primeira nota.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.18;
    masterGain.connect(ctx.destination);
  } catch { ctx = null; }
  return ctx;
}

export function setMuted(m: boolean) { muted = m; }
export function isMuted(): boolean { return muted; }

interface Note {
  freq: number;        // Hz inicial
  freqEnd?: number;    // se setado, faz pitch sweep (chirp)
  duration: number;    // segundos
  type?: OscillatorType; // 'sine' | 'square' | 'sawtooth' | 'triangle'
  gain?: number;       // 0..1 multiplicador local
  delay?: number;      // segundos de offset
}

function playNote({ freq, freqEnd, duration, type = 'sine', gain = 1, delay = 0 }: Note) {
  if (muted) return;
  const c = getCtx();
  if (!c || !masterGain) return;
  try {
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(g).connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  } catch { /* sound errors are non-fatal */ }
}

// EDUCATIONAL: cache de HTMLAudioElement por URL — toca samples reais do /public.
// Cada chamada reseta currentTime pra começar do zero (não fila som em si mesmo).
const audioCache = new Map<string, HTMLAudioElement>();
function playSample(url: string, volume = 0.6) {
  if (muted) return;
  if (typeof window === 'undefined') return;
  try {
    let el = audioCache.get(url);
    if (!el) {
      el = new Audio(url);
      el.preload = 'auto';
      audioCache.set(url, el);
    }
    el.currentTime = 0;
    el.volume = volume;
    void el.play().catch(() => { /* autoplay policy / user-gesture pode bloquear */ });
  } catch { /* sound errors são non-fatal */ }
}

// EDUCATIONAL: cada operação CRUD tem identidade sonora própria.
export const sfx = {
  move: () => playNote({ freq: 380, duration: 0.04, type: 'square', gain: 0.4 }),
  blocked: () => playNote({ freq: 180, duration: 0.08, type: 'square', gain: 0.5 }),
  build: () => {
    // "thud" — onda baixa rápida + click
    playNote({ freq: 220, freqEnd: 110, duration: 0.18, type: 'square', gain: 0.7 });
    playNote({ freq: 880, duration: 0.04, type: 'triangle', gain: 0.5, delay: 0.02 });
  },
  update: () => {
    // "ding" tipo level-up: 2 notas ascendentes
    playNote({ freq: 660, duration: 0.1, type: 'triangle', gain: 0.6 });
    playNote({ freq: 990, duration: 0.18, type: 'triangle', gain: 0.6, delay: 0.08 });
  },
  delete: () => {
    // "crash" — sweep down rápido
    playNote({ freq: 320, freqEnd: 80, duration: 0.22, type: 'sawtooth', gain: 0.7 });
  },
  read: () => {
    // "ploop" — sweep up rápido
    playNote({ freq: 440, freqEnd: 880, duration: 0.14, type: 'sine', gain: 0.7 });
  },
  happy: () => {
    // melodia curta de vitória C-E-G
    playNote({ freq: 523, duration: 0.1, type: 'triangle', gain: 0.7 });
    playNote({ freq: 659, duration: 0.1, type: 'triangle', gain: 0.7, delay: 0.1 });
    playNote({ freq: 784, duration: 0.2, type: 'triangle', gain: 0.7, delay: 0.2 });
  },
  // EDUCATIONAL: latido real do /public/audio cachorro.mp3 (file com espaço no nome).
  // URL-encode: %20 substitui o espaço pra fetch correto.
  dogBark: () => playSample('/audio%20cachorro.mp3', 0.7),
};
