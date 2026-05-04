// lib/game/sql.tsx
// EDUCATIONAL: builders e syntax highlighter de SQL para a UI educacional.
import { STATUS_NEXT } from './constants';
import type { Tool, Tipo, Objeto } from './constants';

export function buildSqlPreview(tool: Tool, tipo: Tipo, fx: number, fy: number, target: Objeto | null): string {
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
