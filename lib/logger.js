// lib/logger.js
// EDUCATIONAL: log estruturado em JSON facilita ingestão (Cloudwatch, Datadog).
// Cada request recebe um requestId para correlação.
import crypto from 'node:crypto';

export function newRequestId() {
  return crypto.randomUUID();
}

export function log(level, event, data = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...data,
  };
  // EDUCATIONAL: log defensivo. Se JSON.stringify falhar (ref circular,
  // BigInt, etc), cai no console direto pra não derrubar a função inteira.
  try {
    console.log(JSON.stringify(entry));
  } catch {
    try { console.log('[log_stringify_failed]', level, event, String(data)); } catch { }
  }
}

export const logger = {
  info: (event, data) => log('info', event, data),
  warn: (event, data) => log('warn', event, data),
  error: (event, data) => log('error', event, data),
};

// EDUCATIONAL: extrai info útil de erros do mysql2/Node. `err.message` sozinho
// não chega — precisamos de code/errno/sqlMessage para diagnosticar.
export function errorFields(err) {
  if (!err) return { msg: 'unknown', kind: typeof err };
  return {
    msg: err.message || '(empty)',
    name: err.name,
    code: err.code,
    errno: err.errno,
    sqlState: err.sqlState,
    sqlMessage: err.sqlMessage,
    address: err.address,
    port: err.port,
    syscall: err.syscall,
  };
}

const MAX_BODY_BYTES = 1024;

// EDUCATIONAL: lê body com limite de tamanho. Evita ataques de payload gigante.
export async function readBoundedJson(req, requestId) {
  const len = Number(req.headers.get('content-length') || 0);
  if (len > MAX_BODY_BYTES) {
    logger.warn('body_too_large', { requestId, bytes: len, limit: MAX_BODY_BYTES });
    return { error: 'body_too_large', status: 413 };
  }
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) {
    logger.warn('body_too_large', { requestId, bytes: text.length, limit: MAX_BODY_BYTES });
    return { error: 'body_too_large', status: 413 };
  }
  try {
    return { data: JSON.parse(text) };
  } catch {
    return { error: 'invalid_json', status: 400 };
  }
}

// EDUCATIONAL: SQL renderizado para o painel educacional. Em apps reais você
// nunca exporia o SQL pro cliente em prod (info disclosure). Aqui é demo, com
// schema simples — então mostramos sempre, esse é todo o ponto do jogo.
// Pra desligar: `DEMO_MODE=false` env var.
export function renderSql(template, params) {
  if (process.env.DEMO_MODE === 'false') return null;
  let out = template;
  for (const [k, v] of Object.entries(params || {})) {
    const literal = typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
    out = out.replaceAll(`:${k}`, literal);
  }
  return out;
}
