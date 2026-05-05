// app/providers.jsx
'use client';
// EDUCATIONAL: encapsula React Query + Sonner + bootstrap CSRF + service worker.
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useCsrfBootstrap } from '@/lib/queries';

function Bootstrap({ children }) {
  useCsrfBootstrap();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    let reloaded = false;
    // EDUCATIONAL: registra + força check de update + recarrega automaticamente
    // quando uma versão nova do SW assumir controle. Resolve o "deploy não atualiza".
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // checa update toda vez que a aba volta a ficar visível
      reg.update().catch(() => { });
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) reg.update().catch(() => { });
      });
      // se um SW novo aguardando, manda ativar imediato
      if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            sw.postMessage('SKIP_WAITING');
          }
        });
      });
    }).catch(() => { });

    // Quando o SW novo assume controle, recarrega a página uma vez
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  }, []);
  return children;
}

export default function Providers({ children }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 5_000 },
          mutations: { retry: 0 },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      <Bootstrap>{children}</Bootstrap>
      <Toaster
        position="top-right"
        theme="dark"
        toastOptions={{
          classNames: {
            toast: 'glass !text-slate-100 !rounded-lg !font-mono !text-xs',
          },
        }}
      />
    </QueryClientProvider>
  );
}
