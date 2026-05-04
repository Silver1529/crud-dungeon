// lib/sanitize.js
// EDUCATIONAL: defense-in-depth. Zod já valida enums/ranges; mysql2 prepared
// statements bloqueiam SQL injection. Aqui removemos qualquer marcação HTML
// caso algum valor seja ecoado em HTML no futuro.
//
// Antes usávamos isomorphic-dompurify, mas a dependência transitiva (jsdom →
// html-encoding-sniffer → @exodus/bytes) quebra com ERR_REQUIRE_ESM no
// runtime serverless da Vercel. Como nossos campos são enums + ints (sem
// HTML legítimo), uma sanitização regex resolve sem dependência externa.

const TAG_RE = /<\/?[^>]+>/g;
const CTRL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

export function sanitizeString(input) {
  if (typeof input !== 'string') return input;
  return input.replace(TAG_RE, '').replace(CTRL_RE, '').trim();
}

export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === 'string' ? sanitizeString(v) : v;
  }
  return out;
}
