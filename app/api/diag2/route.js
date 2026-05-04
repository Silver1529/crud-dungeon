// app/api/diag2/route.js
// EDUCATIONAL: testa o MESMO encadeamento de imports do /api/objetos pra
// isolar qual dos módulos quebra na Vercel. Apaga depois.
import { NextResponse } from 'next/server';

const tried = [];

async function tryImport(name, fn) {
  try {
    const mod = await fn();
    tried.push({ name, ok: true, exports: Object.keys(mod) });
  } catch (e) {
    tried.push({ name, ok: false, error: { msg: e?.message, name: e?.name, code: e?.code } });
  }
}

export const runtime = 'nodejs';

export async function GET() {
  tried.length = 0;
  await tryImport('lib/db', () => import('@/lib/db'));
  await tryImport('lib/schemas', () => import('@/lib/schemas'));
  await tryImport('lib/rate-limit', () => import('@/lib/rate-limit'));
  await tryImport('lib/csrf', () => import('@/lib/csrf'));
  await tryImport('lib/sanitize', () => import('@/lib/sanitize'));
  await tryImport('lib/logger', () => import('@/lib/logger'));

  // Tenta usar query() depois do import
  let queryResult = null;
  try {
    const dbMod = await import('@/lib/db');
    const rows = await dbMod.query('SELECT 1 AS x');
    queryResult = { ok: true, rows };
  } catch (e) {
    queryResult = { ok: false, error: { msg: e?.message, name: e?.name, code: e?.code } };
  }

  // Tenta sanitize de string
  let sanitizeResult = null;
  try {
    const sanMod = await import('@/lib/sanitize');
    sanitizeResult = { ok: true, out: sanMod.sanitizeString('hello <b>world</b>') };
  } catch (e) {
    sanitizeResult = { ok: false, error: { msg: e?.message, name: e?.name, code: e?.code } };
  }

  return NextResponse.json({ tried, queryResult, sanitizeResult });
}
