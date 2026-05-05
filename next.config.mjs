/** @type {import('next').NextConfig} */
// EDUCATIONAL: defense-in-depth via headers. Cada um cobre uma classe de ataque.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // EDUCATIONAL: 'unsafe-inline' em script-src é necessário p/ Next.js inline bootstrap.
      // Em produção real considere migrar para nonces (proxy.js + headers dinâmicos).
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "media-src 'self' blob: data:",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
  },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // EDUCATIONAL: avisa o Vercel/Next pra incluir o CA bundle do AWS RDS no deploy.
  // Sem isso o serverless function não acha o arquivo em runtime.
  outputFileTracingIncludes: {
    '/api/**/*': ['./certs/**'],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // EDUCATIONAL: o /sw.js NUNCA pode ser cacheado pelo browser/CDN, senão
      // updates do Service Worker ficam presos. Sempre busca fresco.
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
