// lib/queries.js
// EDUCATIONAL: React Query gerencia cache, refetch, race conditions e
// optimistic updates. Cada mutação alimenta o painel CRUD Live em tempo real.
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useGameStore } from './store';

const KEY = ['objetos'];

async function fetchJson(url, options = {}) {
  const start = performance.now();
  const csrf = useGameStore.getState().csrfToken;
  const isMutation = options.method && options.method !== 'GET';

  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(isMutation && csrf ? { 'x-csrf-token': csrf } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers, cache: 'no-store' });
  const ms = Math.round(performance.now() - start);
  const requestId = res.headers.get('x-request-id') || '—';
  const json = await res.json().catch(() => ({}));
  return { res, json, ms, requestId };
}

function logToStore({ method, url, status, ms, json, requestId }) {
  const { addSqlLog, addNetworkLog, incrementStat } = useGameStore.getState();
  if (json?._debug?.sql) {
    addSqlLog({ sql: json._debug.sql, affected: json._debug.affected ?? null, status });
  }
  addNetworkLog({ method, url, status, ms, requestId, payload: json });
  if (status >= 400) incrementStat('errors');
}

// EDUCATIONAL: helper que sincroniza o cache do React Query com o store Zustand.
// O jogo (Kaplay) lê de Zustand — sem isso, optimistic updates não chegam no canvas.
function syncStoreFromCache(qc) {
  useGameStore.getState().setObjetos(qc.getQueryData(KEY) || []);
}

export function useCsrfBootstrap() {
  // EDUCATIONAL: roda uma vez ao montar. Pega o token e guarda no store.
  const setCsrfToken = useGameStore((s) => s.setCsrfToken);
  return useQuery({
    queryKey: ['csrf'],
    queryFn: async () => {
      const { json } = await fetchJson('/api/csrf');
      if (json?.token) setCsrfToken(json.token);
      return json;
    },
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });
}

export function useObjetos() {
  const setObjetos = useGameStore((s) => s.setObjetos);
  const incrementStat = useGameStore((s) => s.incrementStat);

  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { res, json, ms, requestId } = await fetchJson('/api/objetos');
      logToStore({ method: 'GET', url: '/api/objetos', status: res.status, ms, json, requestId });
      incrementStat('reads');
      const data = json.data ?? [];
      setObjetos(data);
      return data;
    },
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateObjeto() {
  const qc = useQueryClient();
  const incrementStat = useGameStore((s) => s.incrementStat);

  return useMutation({
    mutationFn: async (payload) => {
      const { res, json, ms, requestId } = await fetchJson('/api/objetos', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      logToStore({ method: 'POST', url: '/api/objetos', status: res.status, ms, json, requestId });
      if (!res.ok) throw Object.assign(new Error(json.error || 'erro'), { status: res.status, body: json });
      return json.data;
    },
    onMutate: async (payload) => {
      // EDUCATIONAL: optimistic update. Inserimos uma linha "tmp" no cache E no
      // store imediatamente — o canvas mostra o objeto antes mesmo do RDS responder.
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData(KEY);
      qc.setQueryData(KEY, (old = []) => [...old, { ...payload, status: 'novo', id: `tmp-${Date.now()}` }]);
      syncStoreFromCache(qc);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(KEY, ctx.previous);
        syncStoreFromCache(qc);
      }
    },
    onSuccess: (created) => {
      incrementStat('writes');
      qc.setQueryData(KEY, (old = []) => [...old.filter((o) => !String(o.id).startsWith('tmp-')), created]);
      syncStoreFromCache(qc);
    },
  });
}

export function useUpdateObjeto() {
  const qc = useQueryClient();
  const incrementStat = useGameStore((s) => s.incrementStat);

  return useMutation({
    mutationFn: async ({ id, status }) => {
      const { res, json, ms, requestId } = await fetchJson(`/api/objetos/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      logToStore({ method: 'PUT', url: `/api/objetos/${id}`, status: res.status, ms, json, requestId });
      if (!res.ok) throw Object.assign(new Error(json.error || 'erro'), { status: res.status });
      return json.data;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData(KEY);
      qc.setQueryData(KEY, (old = []) => old.map((o) => (o.id === id ? { ...o, status } : o)));
      syncStoreFromCache(qc);
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(KEY, ctx.previous);
        syncStoreFromCache(qc);
      }
    },
    onSuccess: () => {
      incrementStat('updates');
      syncStoreFromCache(qc);
    },
  });
}

export function useDeleteObjeto() {
  const qc = useQueryClient();
  const incrementStat = useGameStore((s) => s.incrementStat);

  return useMutation({
    mutationFn: async (id) => {
      const { res, json, ms, requestId } = await fetchJson(`/api/objetos/${id}`, { method: 'DELETE' });
      logToStore({ method: 'DELETE', url: `/api/objetos/${id}`, status: res.status, ms, json, requestId });
      if (!res.ok) throw Object.assign(new Error(json.error || 'erro'), { status: res.status });
      return json.data;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData(KEY);
      qc.setQueryData(KEY, (old = []) => old.filter((o) => o.id !== id));
      syncStoreFromCache(qc);
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(KEY, ctx.previous);
        syncStoreFromCache(qc);
      }
    },
    onSuccess: () => {
      incrementStat('deletes');
      syncStoreFromCache(qc);
    },
  });
}
