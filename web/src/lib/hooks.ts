import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

export interface Async<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  reload: () => void;
}

/** Fetch JSON from /api once per (path, deps) change; keeps stale-safe. */
export function useApi<T>(path: string | null, deps: unknown[] = []): Async<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(!!path);
  const generation = useRef(0);
  const load = useCallback(async () => {
    if (!path) return;
    const gen = ++generation.current;
    setLoading(true);
    setError(undefined);
    try {
      const result = await api.get<T>(path);
      if (gen === generation.current) setData(result);
    } catch (e) {
      if (gen === generation.current) setError(e as Error);
    } finally {
      if (gen === generation.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => {
    load();
    return () => {
      generation.current++;
    };
  }, [load]);
  return { data, error, loading, reload: load };
}
