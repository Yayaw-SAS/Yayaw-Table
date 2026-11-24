"use client";

import { useEffect, useState } from "react";

interface RemoteColumn {
  id: string;
  optionsLoader?: (
    query: string,
    signal?: AbortSignal
  ) => Promise<
    { value: string | number | boolean; label: string; disabled?: boolean; iconUrl?: string }[]
  >;
  optionsSearchMinLength?: number;
  optionsSearchDebounceMs?: number;
}

/**
 * The options a column's `optionsLoader` returns for the typed search, shared
 * by the filter menu and the quick filters. Nothing is requested while
 * `enabled` is false (a closed quick filter).
 */
export function useRemoteFilterOptions(
  column: RemoteColumn,
  query: string,
  rememberOptions: (
    columnId: string,
    options: { value: unknown; label: string }[]
  ) => void,
  enabled = true
) {
  const [loaded, setLoaded] = useState<
    { value: unknown; label: string; disabled?: boolean; iconUrl?: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const minimum = Math.max(0, column.optionsSearchMinLength ?? 0);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    if (!(enabled && column.optionsLoader) || query.length < minimum) {
      setLoaded([]);
      setLoading(false);
      return;
    }
    setLoaded([]);
    setLoading(true);
    const timer = setTimeout(
      async () => {
        try {
          const result = await column.optionsLoader?.(query, controller.signal);
          if (!controller.signal.aborted) {
            setLoaded(result ?? []);
            rememberOptions(column.id, result ?? []);
          }
        } catch {
          if (!controller.signal.aborted) {
            setLoaded([]);
            setFailed(true);
          }
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        }
      },
      query ? Math.max(0, column.optionsSearchDebounceMs ?? 300) : 0
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    column.id,
    column.optionsLoader,
    column.optionsSearchDebounceMs,
    enabled,
    minimum,
    query,
    rememberOptions,
  ]);
  return { loaded, loading, failed, minimum };
}
