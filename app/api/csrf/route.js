// app/api/csrf/route.js
// EDUCATIONAL: emite token CSRF (double-submit). Cliente lê e envia em cada mutação.
import { NextResponse } from 'next/server';
import { generateToken, setCsrfCookie, getCsrfCookie } from '@/lib/csrf';
import { newRequestId, logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET() {
  const requestId = newRequestId();
  let token = await getCsrfCookie();
  if (!token) {
    token = generateToken();
    await setCsrfCookie(token);
  }
  logger.info('csrf_issued', { requestId });
  return NextResponse.json(
    { token },
    { headers: { 'x-request-id': requestId } }
  );
}
