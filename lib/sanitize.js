// lib/sanitize.js
// EDUCATIONAL: defense-in-depth. Zod já valida enums/ranges; mysql2 prepared
// statements bloqueiam SQL injection. DOMPurify aqui protege contra XSS caso
// algum valor seja ecoado em HTML no futuro (p.ex. tipo customizado).
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeString(input) {
  if (typeof input !== 'string') return input;
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
}

export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === 'string' ? sanitizeString(v) : v;
  }
  return out;
}
