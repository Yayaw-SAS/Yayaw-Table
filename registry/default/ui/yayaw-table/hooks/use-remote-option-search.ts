"use client";

import { createContext, useEffect, useRef, useState } from "react";
import type { FormSelectOption } from "../components/forms/types";
import { optionControlKey } from "../utils/table-contracts";

/** Option callbacks bound to a field's current form context. */
export interface RemoteOptionSearch {
  search: (
    query: string,
    signal: AbortSignal
  ) => FormSelectOption[] | Promise<FormSelectOption[]>;
  resolve?: (
    values: unknown[],
    signal: AbortSignal
  ) => FormSelectOption[] | Promise<FormSelectOption[]>;
  create?: (
    label: string,
    signal: AbortSignal
  ) => FormSelectOption | Promise<FormSelectOption>;
  load?: () => FormSelectOption[] | Promise<FormSelectOption[]>;
  minLength: number;
  debounceMs: number;
}

export const RemoteOptionSearchContext = createContext<
  RemoteOptionSearch | undefined
>(undefined);

const optionKeysOf = (options: readonly FormSelectOption[]) =>
  new Set(options.map((option) => optionControlKey(option.value)));

/** Keep labels from earlier searches, without changing the server's current result set. */
export function rememberOptions<T extends FormSelectOption>(
  known: T[],
  found: readonly T[]
): T[] {
  const byValue = new Map<string, T>();
  for (const option of [...known, ...found]) {
    byValue.set(optionControlKey(option.value), option);
  }
  const merged = [...byValue.values()];
  return merged.length === known.length &&
    merged.every((option, index) => option === known[index])
    ? known
    : merged;
}

export function persistedOption(
  option: FormSelectOption | null | undefined
): FormSelectOption {
  if (
    !option ||
    option.value === undefined ||
    option.value === null ||
    option.value === ""
  ) {
    throw new Error("The new option must have a persisted value");
  }
  return option;
}

interface OptionSearchState {
  matched?: Set<string>;
  remembered: FormSelectOption[];
  searching: boolean;
  error?: string;
}

async function resolveSelectedOptions(
  resolve: RemoteOptionSearch["resolve"],
  selected: unknown[],
  known: FormSelectOption[],
  signal: AbortSignal
) {
  const missing = selected.filter(
    (value) => !known.some((option) => Object.is(option.value, value))
  );
  return missing.length && resolve ? await resolve(missing, signal) : [];
}

async function loadConfiguredOptions(search: RemoteOptionSearch | undefined) {
  return (await search?.load?.()) ?? [];
}

/** Shared cancellable search and selected-value resolution for form and inline lists. */
export function useRemoteOptionSearch(
  optionSearch: RemoteOptionSearch | undefined,
  active: boolean,
  query: string,
  selectedValues: unknown[]
) {
  const [state, setState] = useState<OptionSearchState>({
    remembered: [],
    searching: false,
  });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const latest = useRef({
    optionSearch,
    selectedValues,
    remembered: state.remembered,
  });
  latest.current = {
    optionSearch,
    selectedValues,
    remembered: state.remembered,
  };
  const text = query.trim();
  const enabled = Boolean(optionSearch);
  const resolves = Boolean(optionSearch?.resolve);
  const loads = Boolean(optionSearch?.load);
  const minLength = Math.max(1, optionSearch?.minLength ?? 1);
  const debounceMs = Math.max(0, optionSearch?.debounceMs ?? 0);
  const selectedKey = JSON.stringify(selectedValues);
  const configured = useRef<Promise<FormSelectOption[]> | undefined>(undefined);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Serialized values keep inline host callbacks from restarting requests on every render.
  useEffect(() => {
    if (!(active && enabled)) {
      return;
    }
    const request = new AbortController();
    const input = latest.current;
    setLoading(loads || (resolves && input.selectedValues.length > 0));
    setLoadError(undefined);
    (async () => {
      try {
        configured.current ??= loadConfiguredOptions(input.optionSearch);
        const base = await configured.current;
        const resolved = await resolveSelectedOptions(
          input.optionSearch?.resolve,
          input.selectedValues,
          [...base, ...input.remembered],
          request.signal
        );
        if (!request.signal.aborted) {
          setState((previous) => ({
            ...previous,
            remembered: rememberOptions(
              [...base, ...previous.remembered],
              resolved
            ),
          }));
        }
      } catch (cause) {
        configured.current = undefined;
        if (!request.signal.aborted) {
          setLoadError(cause instanceof Error ? cause.message : String(cause));
        }
      } finally {
        if (!request.signal.aborted) {
          setLoading(false);
        }
      }
    })();
    return () => request.abort();
  }, [active, enabled, loads, resolves, selectedKey, attempt]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: A retry repeats the same query after a failure.
  useEffect(() => {
    setState((previous) =>
      previous.matched || previous.error || previous.searching
        ? { remembered: previous.remembered, searching: false }
        : previous
    );
    if (!(enabled && active) || text.length < minLength) {
      return;
    }
    const request = new AbortController();
    setState((previous) => ({ ...previous, searching: true }));
    const timer = setTimeout(async () => {
      const search = latest.current.optionSearch?.search;
      if (!search) {
        return;
      }
      try {
        const found = await search(text, request.signal);
        if (!request.signal.aborted) {
          setState((previous) => ({
            remembered: rememberOptions(previous.remembered, found),
            matched: optionKeysOf(found),
            searching: false,
          }));
        }
      } catch (cause) {
        if (!request.signal.aborted) {
          setState((previous) => ({
            ...previous,
            searching: false,
            error: cause instanceof Error ? cause.message : String(cause),
          }));
        }
      }
    }, debounceMs);
    return () => {
      request.abort();
      clearTimeout(timer);
    };
  }, [active, debounceMs, enabled, minLength, text, attempt]);
  const retry = () => {
    configured.current = undefined;
    setAttempt((value) => value + 1);
  };
  return { ...state, loading, error: state.error ?? loadError, retry };
}
