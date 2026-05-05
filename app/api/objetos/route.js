// app/api/objetos/route.js
// EDUCATIONAL: rotas CRUD com defense-in-depth:
// rate-limit -> CSRF (mutações) -> body size -> zod -> DOMPurify -> prepared statements -> log estruturado.
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createSchema } from '@/lib/schemas';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { validateCsrf } from '@/lib/csrf';
import { sanitizeObject } from '@/lib/sanitize';
import { newRequestId, logger, readBoundedJson, renderSql, errorFields } from '@/lib/logger';

export const runtime = 'nodejs';

function jsonWith(requestId, body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...(init.headers || {}), 'x-request-id': requestId },
  });
}

// GET /api/objetos
export async function GET(req) {
  const requestId = newRequestId();
  const ip = getClientIp(req);
  const rl = rateLimit(`get:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    logger.warn('rate_limited', { requestId, ip, op: 'GET' });
    return jsonWith(requestId, { error: 'rate_limited' }, { status: 429 });
  }
  try {
    const sql = 'SELECT id, tipo, status, pos_x, pos_y, level FROM game_objects ORDER BY id ASC';
    const rows = await query(sql);
    logger.info('objetos_list', { requestId, count: rows.length });
    return jsonWith(requestId, {
      data: rows,
      _debug: { sql: renderSql(sql, {}), affected: rows.length },
    });
  } catch (err) {
    logger.error('objetos_list_failed', { requestId, ...errorFields(err) });
    return jsonWith(requestId, { error: 'internal_error' }, { status: 500 });
  }
}

// POST /api/objetos
export async function POST(req) {
  const requestId = newRequestId();
  const ip = getClientIp(req);

  const rl = rateLimit(`post:${ip}`, { limit: 20, windowMs: 60_000 });
  if (!rl.ok) {
    logger.warn('rate_limited', { requestId, ip, op: 'POST' });
    return jsonWith(requestId, { error: 'rate_limited' }, { status: 429 });
  }

  if (!(await validateCsrf(req))) {
    logger.warn('csrf_failed', { requestId, ip, op: 'POST' });
    return jsonWith(requestId, { error: 'csrf_invalid' }, { status: 403 });
  }

  const parsedBody = await readBoundedJson(req, requestId);
  if (parsedBody.error) return jsonWith(requestId, { error: parsedBody.error }, { status: parsedBody.status });

  const sanitized = sanitizeObject(parsedBody.data);
  const parsed = createSchema.safeParse(sanitized);
  if (!parsed.success) {
    return jsonWith(requestId, { error: 'invalid_payload', issues: parsed.error.issues }, { status: 400 });
  }

  const { tipo, pos_x, pos_y } = parsed.data;
  // EDUCATIONAL: toda casa nasce nível 1 (status='novo'). Server é a fonte da verdade.
  const sql = 'INSERT INTO game_objects (tipo, status, pos_x, pos_y, level) VALUES (:tipo, :status, :x, :y, :level)';
  const params = { tipo, status: 'novo', x: pos_x, y: pos_y, level: 1 };

  try {
    const result = await query(sql, params);
    logger.info('objeto_created', { requestId, id: result.insertId, tipo });
    return jsonWith(
      requestId,
      {
        data: { id: result.insertId, tipo, status: 'novo', pos_x, pos_y, level: 1 },
        _debug: { sql: renderSql(sql, params), affected: result.affectedRows },
      },
      { status: 201 }
    );
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return jsonWith(requestId, { error: 'tile_occupied' }, { status: 409 });
    }
    logger.error('objeto_create_failed', { requestId, ...errorFields(err) });
    return jsonWith(requestId, { error: 'internal_error' }, { status: 500 });
  }
}
