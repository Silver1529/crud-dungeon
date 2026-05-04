// lib/rate-limit.js
// Rate limit simples em memória. Para produção real, use Redis/Upstash.
const buckets = new Map();

export function rateLimit(key, { limit = 30, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { count: 0, reset: now + windowMs };

  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + windowMs;
  }

  bucket.count += 1;
  buckets.set(key, bucket);

  return {
    ok: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    reset: bucket.reset,
  };
}

export function getClientIp(req) {
  const fwd = req.headers.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || 'unknown';
}
