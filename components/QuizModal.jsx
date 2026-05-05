// components/QuizModal.jsx
'use client';
// EDUCATIONAL: quiz pós-tutorial. 4 perguntas (uma por op CRUD), múltipla escolha,
// feedback imediato, resultado final com badge.
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, CheckCircle2, XCircle, Award, ArrowRight } from 'lucide-react';
import { QUIZ_DONE_KEY, COLOR_MAP } from '@/lib/game/constants';

const QUESTIONS = [
  {
    op: 'CREATE',
    color: 'emerald',
    sql: 'INSERT INTO',
    prompt: 'Você quer adicionar uma casa nova no banco. Qual operação CRUD usar?',
    options: [
      { key: 'a', label: 'CREATE — INSERT INTO ...', correct: true,  why: 'Exato. INSERT INTO adiciona uma linha nova na tabela.' },
      { key: 'b', label: 'READ — SELECT ...',         correct: false, why: 'SELECT só LÊ dados, nunca cria.' },
      { key: 'c', label: 'UPDATE — UPDATE ... SET',   correct: false, why: 'UPDATE altera linhas que JÁ existem.' },
      { key: 'd', label: 'DELETE — DELETE FROM ...',  correct: false, why: 'DELETE apaga, nunca cria.' },
    ],
  },
  {
    op: 'READ',
    color: 'cyan',
    sql: 'SELECT *',
    prompt: 'Você só quer LISTAR todas as casas, sem alterar nada. Qual é a operação?',
    options: [
      { key: 'a', label: 'INSERT INTO',          correct: false, why: 'INSERT cria — não lê.' },
      { key: 'b', label: 'SELECT * FROM ...',    correct: true,  why: 'Sim! SELECT é a leitura — não muda nada no banco.' },
      { key: 'c', label: 'UPDATE ... SET ...',   correct: false, why: 'UPDATE muda dados, não lista.' },
      { key: 'd', label: 'DROP TABLE',           correct: false, why: 'DROP TABLE apaga a tabela inteira — operação destrutiva.' },
    ],
  },
  {
    op: 'UPDATE',
    color: 'amber',
    sql: 'UPDATE ... WHERE',
    prompt: 'Sua casa está nível 1 e você quer evoluir pra nível 2. Qual SQL?',
    options: [
      { key: 'a', label: "UPDATE casas SET level = 2",                correct: false, why: 'PERIGO! Sem WHERE, isso atualiza TODAS as casas — bug clássico.' },
      { key: 'b', label: "UPDATE casas SET level = 2 WHERE id = 5",   correct: true,  why: 'Correto. WHERE id = X garante que só ESSA linha muda.' },
      { key: 'c', label: "INSERT INTO casas (level) VALUES (2)",       correct: false, why: 'Isso CRIA uma casa nova, não atualiza a existente.' },
      { key: 'd', label: "DELETE FROM casas WHERE level = 1",         correct: false, why: 'Isso APAGA todas as casas nível 1 — não evolui.' },
    ],
  },
  {
    op: 'DELETE',
    color: 'rose',
    sql: 'DELETE WHERE',
    prompt: 'Qual desses comandos é mais PERIGOSO em produção?',
    options: [
      { key: 'a', label: 'SELECT * FROM users',           correct: false, why: 'SELECT é leitura — pode ser lento, mas não destrói.' },
      { key: 'b', label: 'DELETE FROM users WHERE id=42', correct: false, why: 'Apaga UMA linha, contido pelo WHERE.' },
      { key: 'c', label: 'DELETE FROM users',             correct: true,  why: 'Sim — sem WHERE, apaga TODOS os usuários. Sempre confira o WHERE.' },
      { key: 'd', label: 'UPDATE users SET name="x" WHERE id=1', correct: false, why: 'Atualiza só uma linha — controlado.' },
    ],
  },
];

function Question({ q, index, total, onAnswer }) {
  const [picked, setPicked] = useState(null);
  const cm = COLOR_MAP[q.color];

  const choose = (opt) => {
    if (picked) return;
    setPicked(opt);
    setTimeout(() => onAnswer(opt.correct), 1700);
  };

  return (
    <motion.div
      key={q.op}
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`px-2 py-0.5 rounded border ${cm.ring} ${cm.bg} ${cm.fg} font-mono text-[11px] font-bold`}>
          {q.op}
        </span>
        <span className="text-[10px] font-mono text-slate-500">
          {index + 1} / {total}
        </span>
      </div>
      <div className="text-[10px] font-mono text-slate-500 mb-1">SQL relacionado</div>
      <code className={`block ${cm.fg} font-mono text-xs mb-3 px-2 py-1 rounded ${cm.bg} border ${cm.ring}`}>
        {q.sql}
      </code>
      <p className="text-slate-200 text-sm leading-relaxed mb-4">{q.prompt}</p>

      <div className="space-y-2">
        {q.options.map((o) => {
          const isPicked = picked?.key === o.key;
          const isWrong = isPicked && !o.correct;
          const isRight = isPicked && o.correct;
          const showCorrect = picked && !isPicked && o.correct;
          return (
            <button
              key={o.key}
              onClick={() => choose(o)}
              disabled={!!picked}
              className={`w-full text-left px-3 py-2 rounded-lg border font-mono text-xs transition-colors flex items-center gap-2 ${
                isRight ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-200'
                : isWrong ? 'border-rose-400/60 bg-rose-400/15 text-rose-200'
                : showCorrect ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/30 hover:bg-white/[0.06]'
              }`}
            >
              <span className="font-bold opacity-60">{o.key.toUpperCase()}.</span>
              <span className="flex-1">{o.label}</span>
              {isRight && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {isWrong && <XCircle className="w-4 h-4 text-rose-400" />}
              {showCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400/70" />}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {picked && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mt-4 p-3 rounded-lg border text-xs leading-relaxed ${
              picked.correct
                ? 'border-emerald-400/30 bg-emerald-400/5 text-emerald-100'
                : 'border-rose-400/30 bg-rose-400/5 text-rose-100'
            }`}
          >
            <div className="flex items-center gap-2 font-mono font-bold mb-1">
              {picked.correct ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {picked.correct ? 'Mandou bem!' : 'Quase!'}
            </div>
            {picked.why}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ResultScreen({ score, total, name, onClose }) {
  const pct = Math.round((score / total) * 100);
  // Tier do badge baseado em score.
  const tier =
    score === total ? { label: 'Mestre do CRUD', color: 'violet', emoji: '🏆' } :
    score >= 3      ? { label: 'CRUD Avançado',  color: 'amber',  emoji: '🥈' } :
    score >= 2      ? { label: 'CRUD Júnior',    color: 'cyan',   emoji: '🥉' } :
                      { label: 'Aprendiz',       color: 'rose',   emoji: '📘' };
  const cm = COLOR_MAP[tier.color];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      className="text-center"
    >
      <div className="text-5xl mb-2">{tier.emoji}</div>
      <h3 className="font-mono text-lg text-cyan-200 mb-1">
        {score === total ? `Perfeito, ${name}!` : `Tá indo bem, ${name}!`}
      </h3>
      <p className="text-slate-400 text-xs font-mono mb-4">
        {score} / {total} respostas certas · {pct}%
      </p>

      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${cm.ring} ${cm.bg} mb-5`}>
        <Award className={`w-4 h-4 ${cm.fg}`} />
        <span className={`font-mono text-sm font-bold ${cm.fg}`}>BADGE: {tier.label}</span>
      </div>

      <p className="text-slate-300 text-xs leading-relaxed mb-5">
        Você desbloqueou o sandbox livre — agora é só explorar. Cada CREATE, READ, UPDATE e DELETE
        que você fizer roda <strong>SQL real</strong> num MySQL na AWS. 🇺🇸
      </p>

      <button
        onClick={onClose}
        className="w-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/30 transition-colors rounded-lg py-2.5 font-mono text-sm flex items-center justify-center gap-2"
      >
        <Sparkles className="w-4 h-4" /> jogar livre
      </button>
    </motion.div>
  );
}

export default function QuizModal({ open, name, onClose }) {
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const onAnswer = (correct) => {
    if (correct) setScore((s) => s + 1);
    if (idx + 1 < QUESTIONS.length) {
      setIdx((i) => i + 1);
    } else {
      setDone(true);
    }
  };

  const handleClose = () => {
    try { localStorage.setItem(QUIZ_DONE_KEY, '1'); } catch { }
    onClose();
  };

  if (!open) return null;

  const q = QUESTIONS[idx];
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
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        className="glass rounded-2xl p-5 sm:p-6 max-w-md w-full max-h-[90vh] overflow-auto shadow-[0_30px_120px_rgba(0,0,0,0.6)]"
      >
        {!done && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-cyan-300" />
              <h2 className="font-mono text-base text-cyan-300">Quiz Final · CRUD</h2>
            </div>
            <p className="text-[11px] font-mono text-slate-400">
              4 perguntas. Sem pressão — é pra fixar o que você acabou de fazer.
            </p>
            <div className="mt-2 h-1 bg-white/5 rounded overflow-hidden">
              <motion.div
                className="h-full bg-cyan-400/70"
                initial={{ width: 0 }}
                animate={{ width: `${((idx) / QUESTIONS.length) * 100}%` }}
                transition={{ duration: 0.25 }}
              />
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {!done ? (
            <Question key={q.op} q={q} index={idx} total={QUESTIONS.length} onAnswer={onAnswer} />
          ) : (
            <ResultScreen key="result" score={score} total={QUESTIONS.length} name={name || 'jogador'} onClose={handleClose} />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
