// components/EditPlayerButton.jsx
'use client';
// EDUCATIONAL: botão no header que abre um modal só pra trocar a skin do
// boneco (camisa, capacete, pele) — sem reabrir o tutorial inteiro.
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Check, X } from 'lucide-react';
import { useGameStore } from '@/lib/store';
import { PLAYER_PRESETS, PLAYER_CUSTOM_KEY } from '@/lib/game/constants';

const SHIRT_KEYS = Object.keys(PLAYER_PRESETS.shirt);
const HAT_KEYS = Object.keys(PLAYER_PRESETS.hat);
const SKIN_KEYS = Object.keys(PLAYER_PRESETS.skin);

function rgbStr(c) { return `rgb(${c[0]},${c[1]},${c[2]})`; }

function PlayerPreviewSvg({ custom }) {
  const shirt = PLAYER_PRESETS.shirt[custom.shirt];
  const hat = PLAYER_PRESETS.hat[custom.hat];
  const skin = PLAYER_PRESETS.skin[custom.skin];
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

function ColorRow({ label, options, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider w-16">{label}</span>
      <div className="flex gap-1.5 flex-wrap">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`w-7 h-7 rounded-md ${o.bg} transition-all border-2 ${value === o.key
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

export default function EditPlayerButton() {
  const playerCustom = useGameStore((s) => s.playerCustom);
  const setPlayerCustom = useGameStore((s) => s.setPlayerCustom);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(playerCustom);

  // sincroniza draft quando abre o modal (pega valor mais recente do store)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setDraft(playerCustom);
  }, [open, playerCustom]);

  const onSave = () => {
    setPlayerCustom(draft);
    try { sessionStorage.setItem(PLAYER_CUSTOM_KEY, JSON.stringify(draft)); } catch { }
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Editar skin do boneco"
        className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md border border-violet-400/20 bg-violet-400/5 text-violet-300 hover:bg-violet-400/10 transition-colors text-[10px] font-mono"
      >
        <User className="w-3 h-3" />
        skin
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-2xl p-5 max-w-sm w-full shadow-[0_30px_120px_rgba(0,0,0,0.6)]"
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-mono text-base text-violet-300 flex items-center gap-2">
                  <User className="w-4 h-4" /> Editar skin
                </h2>
                <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-200">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-3 mb-4 justify-center">
                <PlayerPreviewSvg custom={draft} />
              </div>

              <div className="space-y-2 mb-4">
                <ColorRow
                  label="camisa"
                  value={draft.shirt}
                  options={SHIRT_KEYS.map((k) => ({ key: k, bg: PLAYER_PRESETS.shirt[k].bg }))}
                  onChange={(k) => setDraft((c) => ({ ...c, shirt: k }))}
                />
                <ColorRow
                  label="capacete"
                  value={draft.hat}
                  options={HAT_KEYS.map((k) => ({ key: k, bg: PLAYER_PRESETS.hat[k].bg }))}
                  onChange={(k) => setDraft((c) => ({ ...c, hat: k }))}
                />
                <ColorRow
                  label="pele"
                  value={draft.skin}
                  options={SKIN_KEYS.map((k) => ({ key: k, bg: PLAYER_PRESETS.skin[k].bg }))}
                  onChange={(k) => setDraft((c) => ({ ...c, skin: k }))}
                />
              </div>

              <button
                onClick={onSave}
                className="w-full bg-violet-500/20 border border-violet-400/40 text-violet-200 hover:bg-violet-500/30 transition-colors rounded-lg py-2 font-mono text-sm flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" /> Salvar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
