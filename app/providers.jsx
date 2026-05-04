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
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
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
