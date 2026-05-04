// app/api/objetos/[id]/route.js
// EDUCATIONAL: Next.js 16 — `params` agora é Promise. Sempre `await ctx.params`.
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { updateSchema, idSchema } from '@/lib/schemas';
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

  const parsedBody = await readBoundedJson(req, requestId);
  if (parsedBody.error) return jsonWith(requestId, { error: parsedBody.error }, { status: parsedBody.status });

  const sanitized = sanitizeObject(parsedBody.data);
  const parsed = updateSchema.safeParse(sanitized);
  if (!parsed.success) {
    return jsonWith(requestId, { error: 'invalid_payload', issues: parsed.error.issues }, { status: 400 });
  }

  const sql = 'UPDATE game_objects SET status = :status WHERE id = :id';
  const params = { status: parsed.data.status, id: idParsed.data };

  try {
    const result = await query(sql, params);
    if (result.affectedRows === 0) {
      return jsonWith(requestId, { error: 'not_found' }, { status: 404 });
    }
    logger.info('objeto_updated', { requestId, id: idParsed.data, status: parsed.data.status });
    return jsonWith(requestId, {
      data: { id: idParsed.data, status: parsed.data.status },
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
