// lib/game/sql.tsx
// EDUCATIONAL: builders, syntax highlighter e tradutor PT-BR de SQL para a UI educacional.
import { clampLevel } from './constants';
import type { Tool, Tipo, Objeto } from './constants';

export function buildSqlPreview(tool: Tool, tipo: Tipo, fx: number, fy: number, target: Objeto | null): string {
  if (tool === 'inspect') {
    if (!target) return `-- vazio · INSPECT precisa de uma casa na sua frente`;
    return `SELECT id, tipo, status, pos_x, pos_y, level\nFROM game_objects\nWHERE id = ${target.id};`;
  }
  if (tool === 'build') {
    if (target) return `-- tile ocupado · BUILD não roda (id=${target.id} já existe em ${fx},${fy})`;
    return `INSERT INTO game_objects (tipo, status, pos_x, pos_y, level)\nVALUES ('${tipo}', 'novo', ${fx}, ${fy}, 1);`;
  }
  if (tool === 'upgrade') {
    if (!target) return `-- vazio · UPGRADE precisa de uma casa na sua frente`;
    const cur = clampLevel(target.level);
    if (cur === 3) return `-- casa já no nível máximo (3) · UPGRADE no-op`;
    const next = (cur + 1) as 1 | 2 | 3;
    const nextStatus = next === 2 ? 'ativo' : 'upgrade';
    return `UPDATE game_objects\nSET level = ${next}, status = '${nextStatus}'\nWHERE id = ${target.id};`;
  }
  if (!target) return `-- vazio · DELETE precisa de uma casa na sua frente`;
  return `DELETE FROM game_objects\nWHERE id = ${target.id};`;
}

const KEYWORDS = /\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|ORDER|BY|ASC|DESC)\b/g;

// EDUCATIONAL: highlight básico — keywords roxas, strings âmbar, comentários cinza.
export function highlightSql(sql: string) {
  const parts: { type: 'kw' | 'str' | 'comment' | 'text'; value: string }[] = [];
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

// EDUCATIONAL: traduz uma SQL real (já renderizada com valores) pra português claro.
// Não tenta parser completo — só identifica a operação, o id, e os valores chave.
// Esse texto aparece embaixo de cada query no painel SQL pra quem nunca viu SQL na vida.
export function humanizeSql(sql: string): string {
  if (!sql) return '';
  const trimmed = sql.trim();
  if (trimmed.startsWith('--')) {
    // Comentário: já é PT-BR (vem de buildSqlPreview ou no-op do server).
    return trimmed.replace(/^--\s*/, '');
  }
  const head = trimmed.match(/^(SELECT|INSERT|UPDATE|DELETE)/i)?.[1]?.toUpperCase();
  const idMatch = trimmed.match(/WHERE\s+id\s*=\s*(\d+)/i);
  const id = idMatch ? idMatch[1] : null;

  if (head === 'SELECT') {
    if (id) return `Lendo os dados da casa #${id} no banco (READ-detalhe).`;
    return 'Lendo TODAS as casas do banco (READ — operação mais comum em apps reais).';
  }
  if (head === 'INSERT') {
    const tipo = trimmed.match(/VALUES\s*\(\s*'([^']+)'/i)?.[1];
    const coords = trimmed.match(/,\s*(\d+)\s*,\s*(\d+)\s*,\s*1\s*\)/);
    const where = coords ? ` em (${coords[1]}, ${coords[2]})` : '';
    return `Inseriu uma nova casa${tipo ? ` do tipo ${tipo}` : ''}${where}, nível 1. CREATE.`;
  }
  if (head === 'UPDATE') {
    const lvl = trimmed.match(/level\s*=\s*(\d+)/i)?.[1];
    return `Evoluiu a casa${id ? ` #${id}` : ''} para o nível ${lvl ?? '?'}. UPDATE.`;
  }
  if (head === 'DELETE') {
    return `Apagou a casa${id ? ` #${id}` : ''} permanentemente do banco. DELETE.`;
  }
  return 'Operação SQL.';
}

// EDUCATIONAL: dado um keyword (INSERT/UPDATE/...), devolve cor Tailwind do esquema CRUD.
//   CREATE → verde · READ → cyan · UPDATE → âmbar · DELETE → rose
export const SQL_KEYWORD_THEME: Record<string, { ring: string; bg: string; fg: string; dot: string; label: string }> = {
  SELECT: { ring: 'border-cyan-400/40',    bg: 'bg-cyan-400/10',    fg: 'text-cyan-300',    dot: 'bg-cyan-400',    label: 'READ' },
  INSERT: { ring: 'border-emerald-400/40', bg: 'bg-emerald-400/10', fg: 'text-emerald-300', dot: 'bg-emerald-400', label: 'CREATE' },
  UPDATE: { ring: 'border-amber-400/40',   bg: 'bg-amber-400/10',   fg: 'text-amber-300',   dot: 'bg-amber-400',   label: 'UPDATE' },
  DELETE: { ring: 'border-rose-400/40',    bg: 'bg-rose-400/10',    fg: 'text-rose-300',    dot: 'bg-rose-400',    label: 'DELETE' },
  SQL:    { ring: 'border-slate-400/40',   bg: 'bg-slate-400/10',   fg: 'text-slate-300',   dot: 'bg-slate-400',   label: 'SQL' },
};
