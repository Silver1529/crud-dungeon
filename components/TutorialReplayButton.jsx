// components/TutorialReplayButton.jsx
'use client';
// EDUCATIONAL: pequeno botão no header pra reabrir o tutorial inteiro.
// Útil pra rever o que cada operação faz sem precisar limpar localStorage.
import { HelpCircle } from 'lucide-react';
import { useGameStore } from '@/lib/store';

export default function TutorialReplayButton() {
  const userName = useGameStore((s) => s.userName);
  const setTutorialStep = useGameStore((s) => s.setTutorialStep);

  const onClick = () => {
    // Se já tem nome, vai direto pro intro; senão, do começo (name).
    setTutorialStep(userName ? 'intro' : 'name');
  };

  return (
    <button
      onClick={onClick}
      title="Rever tutorial"
      className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md border border-cyan-400/20 bg-cyan-400/5 text-cyan-300 hover:bg-cyan-400/10 transition-colors text-[10px] font-mono"
    >
      <HelpCircle className="w-3 h-3" />
      tutorial
    </button>
  );
}
