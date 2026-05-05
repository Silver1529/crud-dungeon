// app/api/objetos/[id]/route.js
// EDUCATIONAL: Next.js 16 — `params` agora é Promise. Sempre `await ctx.params`.
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { idSchema } from '@/lib/schemas';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { validateCsrf } from '@/lib/csrf';
import { newRequestId, logger, renderSql, errorFields } from '@/lib/logger';

export const runtime = 'nodejs';

function jsonWith(requestId, body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...(init.headers || {}), 'x-request-id': requestId },
  });
}

// EDUCATIONAL: tabela do tipo "level → status" — UI mostra status pra continuidade.
const LEVEL_TO_STATUS = { 1: 'novo', 2: 'ativo', 3: 'upgrade' };

// GET /api/objetos/[id] — operação de INSPECT (READ-detalhe), usada pela ferramenta
// "INSPECT" do jogo. Devolve a linha inteira pro modal didático mostrar.
export async function GET(req, ctx) {
  const requestId = newRequestId();
  const ip = getClientIp(req);
  const { id } = await ctx.params;

  const rl = rateLimit(`get:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    logger.warn('rate_limited', { requestId, ip, op: 'GET_BY_ID' });
    return jsonWith(requestId, { error: 'rate_limited' }, { status: 429 });
  }

  const idParsed = idSchema.safeParse(id);
  if (!idParsed.success) return jsonWith(requestId, { error: 'invalid_id' }, { status: 400 });

  const sql = 'SELECT id, tipo, status, pos_x, pos_y, level FROM game_objects WHERE id = :id';
  const params = { id: idParsed.data };

  try {
    const rows = await query(sql, params);
    if (rows.length === 0) {
      return jsonWith(requestId, { error: 'not_found' }, { status: 404 });
    }
    logger.info('objeto_read', { requestId, id: idParsed.data });
    return jsonWith(requestId, {
      data: rows[0],
      _debug: { sql: renderSql(sql, params), affected: 1 },
    });
  } catch (err) {
    logger.error('objeto_read_failed', { requestId, ...errorFields(err) });
    return jsonWith(requestId, { error: 'internal_error' }, { status: 500 });
  }
}

// PUT /api/objetos/[id] — UPGRADE (incrementa level). Body é opcional; quando vazio,
// o server simplesmente faz level + 1 (clamp em 3) e mantém a UX intuitiva.
export async function PUT(req, ctx) {
  const requestId = newRequestId();
  const ip = getClientIp(req);
  const { id } = await ctx.params;

  const rl = rateLimit(`put:${ip}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    logger.warn('rate_limited', { requestId, ip, op: 'PUT' });
    return jsonWith(requestId, { error: 'rate_limited' }, { status: 429 });
  }

  if (!(await validateCsrf(req))) {
    logger.warn('csrf_failed', { requestId, ip, op: 'PUT' });
    return jsonWith(requestId, { error: 'csrf_invalid' }, { status: 403 });
  }

  const idParsed = idSchema.safeParse(id);
  if (!idParsed.success) return jsonWith(requestId, { error: 'invalid_id' }, { status: 400 });

  // Lê estado atual pra calcular próximo level + status derivado.
  let current;
  try {
    const rows = await query('SELECT level FROM game_objects WHERE id = :id', { id: idParsed.data });
    if (rows.length === 0) {
      return jsonWith(requestId, { error: 'not_found' }, { status: 404 });
    }
    current = rows[0];
  } catch (err) {
    logger.error('objeto_update_lookup_failed', { requestId, ...errorFields(err) });
    return jsonWith(requestId, { error: 'internal_error' }, { status: 500 });
  }

  const nextLevel = Math.min(3, (current.level ?? 1) + 1);
  if (nextLevel === current.level) {
    // EDUCATIONAL: já está no nível máximo — operação no-op com 200 + flag.
    return jsonWith(requestId, {
      data: { id: idParsed.data, level: current.level, status: LEVEL_TO_STATUS[current.level], maxed: true },
      _debug: { sql: '-- casa já no nível máximo (3) · UPDATE não executado', affected: 0 },
    });
  }
  const nextStatus = LEVEL_TO_STATUS[nextLevel];

  const sql = 'UPDATE game_objects SET level = :level, status = :status WHERE id = :id';
  const params = { level: nextLevel, status: nextStatus, id: idParsed.data };

  try {
    const result = await query(sql, params);
    if (result.affectedRows === 0) {
      return jsonWith(requestId, { error: 'not_found' }, { status: 404 });
    }
    logger.info('objeto_updated', { requestId, id: idParsed.data, level: nextLevel, status: nextStatus });
    return jsonWith(requestId, {
      data: { id: idParsed.data, level: nextLevel, status: nextStatus },
      _debug: { sql: renderSql(sql, params), affected: result.affectedRows },
    });
  } catch (err) {
    logger.error('objeto_update_failed', { requestId, ...errorFields(err) });
    return jsonWith(requestId, { error: 'internal_error' }, { status: 500 });
  }
}

export async function DELETE(req, ctx) {
  const requestId = newRequestId();
  const ip = getClientIp(req);
  const { id } = await ctx.params;

  const rl = rateLimit(`del:${ip}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    logger.warn('rate_limited', { requestId, ip, op: 'DELETE' });
    return jsonWith(requestId, { error: 'rate_limited' }, { status: 429 });
  }

  if (!(await validateCsrf(req))) {
    logger.warn('csrf_failed', { requestId, ip, op: 'DELETE' });
    return jsonWith(requestId, { error: 'csrf_invalid' }, { status: 403 });
  }

  const idParsed = idSchema.safeParse(id);
  if (!idParsed.success) return jsonWith(requestId, { error: 'invalid_id' }, { status: 400 });

  const sql = 'DELETE FROM game_objects WHERE id = :id';
  const params = { id: idParsed.data };

  try {
    const result = await query(sql, params);
    if (result.affectedRows === 0) {
      return jsonWith(requestId, { error: 'not_found' }, { status: 404 });
    }
    logger.info('objeto_deleted', { requestId, id: idParsed.data });
    return jsonWith(requestId, {
      data: { id: idParsed.data, deleted: true },
      _debug: { sql: renderSql(sql, params), affected: result.affectedRows },
    });
  } catch (err) {
    logger.error('objeto_delete_failed', { requestId, ...errorFields(err) });
    return jsonWith(requestId, { error: 'internal_error' }, { status: 500 });
  }
}
