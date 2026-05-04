// lib/csrf.js
// EDUCATIONAL: Double-submit cookie pattern.
// 1) GET /api/csrf grava cookie `cd_csrf` (não-httpOnly para JS poder lê-lo) e retorna o mesmo valor no JSON.
// 2) Cliente envia o valor no header `x-csrf-token` em qualquer mutação.
// 3) Servidor compara cookie e header — diferentes/ausentes => 403.
// Cross-origin não consegue ler nem o cookie nem setar header com mesmo valor => CSRF mitigado.
import { cookies } from 'next/headers';
import crypto from 'node:crypto';

export const CSRF_COOKIE = 'cd_csrf';
export const CSRF_HEADER = 'x-csrf-token';

export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function setCsrfCookie(token) {
  const store = await cookies();
  store.set(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
}

export async function getCsrfCookie() {
  const store = await cookies();
  return store.get(CSRF_COOKIE)?.value ?? null;
}

export async function validateCsrf(req) {
  const cookieToken = await getCsrfCookie();
  const headerToken = req.headers.get(CSRF_HEADER);
  if (!cookieToken || !headerToken) return false;
  if (cookieToken.length !== headerToken.length) return false;
  // EDUCATIONAL: comparação tempo-constante evita timing attack
  return crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));
}
