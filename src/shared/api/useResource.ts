"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Entry {
  data?: unknown;
  error?: unknown;
  promise?: Promise<void>;
}

const cache = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
const fetchers = new Map<string, () => Promise<unknown>>();

function notify(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

function load(key: string, fetcher: () => Promise<unknown>) {
  const entry = cache.get(key) ?? {};
  if (entry.promise) return entry.promise;

  const promise = fetcher().then(
    (data) => {
      cache.set(key, { data });
      notify(key);
    },
    (error) => {
      cache.set(key, { data: cache.get(key)?.data, error });
      notify(key);
    },
  );
  cache.set(key, { ...entry, promise });
  return promise;
}

export function clearResources() {
  cache.clear();
}

export async function revalidate(key: string) {
  const fetcher = fetchers.get(key);
  if (!fetcher) return;
  await cache.get(key)?.promise;
  await load(key, fetcher);
}

interface ResourceOptions<T> {
  refreshInterval?: (data: T | undefined) => number;
}

export function useResource<T>(key: string | null, fetcher: () => Promise<T>, options: ResourceOptions<T> = {}) {
  const [, rerender] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!key) return;
    const listener = () => rerender((n) => n + 1);
    const set = listeners.get(key) ?? new Set();
    listeners.set(key, set);
    set.add(listener);
    fetchers.set(key, () => fetcherRef.current());
    load(key, () => fetcherRef.current());
    return () => {
      set.delete(listener);
    };
  }, [key]);

  const entry = key ? cache.get(key) : undefined;
  const data = entry?.data as T | undefined;
  const interval = options.refreshInterval?.(data) ?? 0;

  useEffect(() => {
    if (!key || !interval) return;
    const id = setInterval(() => load(key, () => fetcherRef.current()), interval);
    return () => clearInterval(id);
  }, [key, interval]);

  const reload = useCallback(() => {
    if (key) load(key, () => fetcherRef.current());
  }, [key]);

  return {
    data,
    error: entry?.error,
    loading: Boolean(key) && data === undefined && !entry?.error,
    reload,
  };
}
