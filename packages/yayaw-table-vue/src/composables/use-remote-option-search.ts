import { computed, onBeforeUnmount, ref, watch } from "vue";
import { optionControlKey } from "../table-contracts";
import type { MaybePromise, SelectOption } from "../types";

/** Remote field callbacks bound to their current form context. */
export interface RemoteOptionSearch {
  search: (query: string, signal: AbortSignal) => MaybePromise<SelectOption[]>;
  resolve?: (
    values: unknown[],
    signal: AbortSignal
  ) => MaybePromise<SelectOption[]>;
  create?: (label: string, signal: AbortSignal) => MaybePromise<SelectOption>;
  minLength: number;
  debounceMs: number;
}

const errorMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/** Shared by form comboboxes and inline editors; only current requests can publish results. */
export const useRemoteOptionSearch = (input: {
  options: () => readonly SelectOption[];
  selected: () => unknown[];
  search: () => RemoteOptionSearch | undefined;
  enabled?: () => boolean;
  scope?: () => string | undefined;
}) => {
  const query = ref("");
  const remote = ref<SelectOption[]>([]);
  const matches = ref<SelectOption[]>([]);
  const searching = ref(false);
  const resolving = ref(false);
  const creating = ref(false);
  const searchError = ref<string>();
  const resolveError = ref<string>();
  const createError = ref<string>();
  const retryCount = ref(0);
  const enabled = () => input.enabled?.() ?? true;
  let createRequest: AbortController | undefined;
  const remember = (options: SelectOption[]): void => {
    const known = new Map(
      remote.value.map((option) => [optionControlKey(option.value), option])
    );
    for (const option of options) {
      known.set(optionControlKey(option.value), option);
    }
    remote.value = [...known.values()];
  };
  const choices = computed(() => {
    const known = new Map(
      [...input.options(), ...remote.value].map((option) => [
        optionControlKey(option.value),
        option,
      ])
    );
    for (const value of input.selected()) {
      const key = optionControlKey(value);
      if (!known.has(key)) {
        known.set(key, {
          label: String(value),
          value: value as SelectOption["value"],
        });
      }
    }
    return [...known.values()];
  });
  watch(
    [() => input.scope?.(), enabled],
    ([scope], [previousScope]) => {
      createRequest?.abort();
      creating.value = false;
      createError.value = undefined;
      if (scope !== previousScope) {
        remote.value = [];
      }
      query.value = "";
    },
    { flush: "sync" }
  );
  watch(
    [
      query,
      () => input.search()?.search,
      () => input.search()?.minLength,
      () => input.search()?.debounceMs,
      enabled,
      () => input.scope?.(),
      retryCount,
    ],
    (_value, _previous, onCleanup) => {
      matches.value = [];
      searchError.value = undefined;
      createError.value = undefined;
      searching.value = false;
      const search = input.search();
      const text = query.value.trim();
      if (
        !(enabled() && search) ||
        text.length < Math.max(1, search.minLength)
      ) {
        return;
      }
      const request = new AbortController();
      searching.value = true;
      const timer = setTimeout(
        async () => {
          try {
            const result = await search.search(text, request.signal);
            if (request.signal.aborted) {
              return;
            }
            remember(result);
            matches.value = result;
          } catch (cause) {
            if (!request.signal.aborted) {
              searchError.value = errorMessage(cause);
            }
          } finally {
            if (!request.signal.aborted) {
              searching.value = false;
            }
          }
        },
        Math.max(0, search.debounceMs)
      );
      onCleanup(() => {
        clearTimeout(timer);
        request.abort();
      });
    },
    { flush: "sync" }
  );
  watch(
    [
      () => JSON.stringify(input.selected()),
      () => input.options(),
      () => input.search()?.resolve,
      enabled,
      () => input.scope?.(),
      retryCount,
    ],
    async (_value, _previous, onCleanup) => {
      resolving.value = false;
      resolveError.value = undefined;
      const resolve = input.search()?.resolve;
      const known = [...input.options(), ...remote.value];
      const missing = input
        .selected()
        .filter(
          (value) => !known.some((option) => Object.is(option.value, value))
        );
      if (!(enabled() && resolve && missing.length)) {
        return;
      }
      const request = new AbortController();
      onCleanup(() => request.abort());
      resolving.value = true;
      try {
        const result = await resolve(missing, request.signal);
        if (!request.signal.aborted) {
          remember(result);
        }
      } catch (cause) {
        if (!request.signal.aborted) {
          resolveError.value = errorMessage(cause);
        }
      } finally {
        if (!request.signal.aborted) {
          resolving.value = false;
        }
      }
    },
    { immediate: true, flush: "sync" }
  );
  const createText = computed(() => query.value.trim());
  const canCreate = computed(
    () =>
      enabled() &&
      Boolean(input.search()?.create) &&
      createText.value.length > 0 &&
      !searching.value &&
      !searchError.value &&
      !choices.value.some(
        (option) =>
          option.label.trim().toLocaleLowerCase() ===
          createText.value.toLocaleLowerCase()
      )
  );
  const createOption = async (): Promise<SelectOption | undefined> => {
    const create = input.search()?.create;
    const label = createText.value;
    if (!(enabled() && create && label) || creating.value) {
      return;
    }
    const request = new AbortController();
    createRequest = request;
    creating.value = true;
    createError.value = undefined;
    try {
      const option = await create(label, request.signal);
      if (request.signal.aborted) {
        return;
      }
      if (
        !option ||
        option.value === undefined ||
        option.value === null ||
        option.value === ""
      ) {
        throw new Error("The new option must have a persisted value");
      }
      remember([option]);
      query.value = "";
      return option;
    } catch (cause) {
      if (!request.signal.aborted) {
        createError.value = errorMessage(cause);
      }
    } finally {
      if (!request.signal.aborted) {
        creating.value = false;
      }
    }
  };
  onBeforeUnmount(() => createRequest?.abort());
  return {
    query,
    choices,
    matches,
    searching,
    resolving,
    creating,
    searchError,
    resolveError,
    createError,
    canCreate,
    createText,
    createOption,
    retry: () => {
      retryCount.value += 1;
    },
  };
};
