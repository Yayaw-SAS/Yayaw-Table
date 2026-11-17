import { computed, type Ref, ref, watch } from "vue";
import type { SelectOption } from "../types";

interface RemoteColumn {
  id: string;
  optionsLoader?: (
    query: string,
    signal?: AbortSignal
  ) => Promise<SelectOption[]>;
  optionsSearchMinLength?: number;
  optionsSearchDebounceMs?: number;
}

/**
 * The options a column's `optionsLoader` returns for the typed search, shared
 * by the filter menu and the quick filters. Nothing is requested while
 * `enabled` is false (a closed quick filter).
 */
export const useRemoteFilterOptions = (input: {
  column: () => RemoteColumn | undefined;
  search: Ref<string>;
  remember: (columnId: string, options: SelectOption[]) => void;
  enabled?: () => boolean;
}) => {
  const loaded = ref<SelectOption[]>([]);
  const loading = ref(false);
  const failed = ref(false);
  const minimum = computed(() =>
    Math.max(0, input.column()?.optionsSearchMinLength ?? 0)
  );
  watch(
    () =>
      [
        input.column()?.id,
        input.column()?.optionsLoader,
        input.search.value.trim(),
        input.enabled?.() ?? true,
      ] as const,
    ([, loader, query, enabled], _previous, onCleanup) => {
      const controller = new AbortController();
      const column = input.column();
      failed.value = false;
      loaded.value = [];
      loading.value = false;
      if (!(column && loader && enabled) || query.length < minimum.value) {
        return;
      }
      loading.value = true;
      const timer = setTimeout(
        async () => {
          try {
            const result = await loader(query, controller.signal);
            if (!controller.signal.aborted) {
              loaded.value = result;
              input.remember(column.id, result);
            }
          } catch {
            if (!controller.signal.aborted) {
              failed.value = true;
            }
          } finally {
            if (!controller.signal.aborted) {
              loading.value = false;
            }
          }
        },
        query ? Math.max(0, column.optionsSearchDebounceMs ?? 300) : 0
      );
      onCleanup(() => {
        clearTimeout(timer);
        controller.abort();
      });
    },
    { immediate: true }
  );
  return { loaded, loading, failed, minimum };
};
