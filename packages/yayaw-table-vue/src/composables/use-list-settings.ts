import { computed, onBeforeUnmount, ref } from "vue";
import { useTableContext } from "../context";
import {
  LIST_MOBILE_BREAKPOINT,
  resolveListSettings,
  visibleListProperties,
} from "../list-view";
import type { TableListViewConfig } from "../types";

const SYSTEM_COLUMNS = ["select", "actions"];

/** List settings mirror React: every non-title column is shown until the user picks. */
export function useListSettings() {
  const context = useTableContext();
  const translate = (key: string, fallback: string) =>
    String(context.translations.value[key] ?? fallback);
  const columns = computed(() =>
    context.config.columns.definitions.filter(
      (column) => !SYSTEM_COLUMNS.includes(column.id)
    )
  );
  const columnOptions = computed(() =>
    columns.value.map((column) => ({ value: column.id, label: column.header }))
  );
  const active = computed(() =>
    resolveListSettings(context.config.table.list, context.state.list.value)
  );
  const update = (patch: TableListViewConfig): void => {
    const next: TableListViewConfig = { ...context.state.list.value, ...patch };
    for (const key of Object.keys(patch) as (keyof TableListViewConfig)[]) {
      if (patch[key] === undefined) {
        Reflect.deleteProperty(next, key);
      }
    }
    context.state.list.value = next;
  };
  const query =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(`(max-width: ${LIST_MOBILE_BREAKPOINT - 1}px)`)
      : undefined;
  const isMobile = ref(query?.matches ?? false);
  const onMedia = (event: MediaQueryListEvent) => {
    isMobile.value = event.matches;
  };
  query?.addEventListener("change", onMedia);
  onBeforeUnmount(() => query?.removeEventListener("change", onMedia));
  const wrap = computed({
    get: () => active.value.wrap,
    set: (value: boolean) => update({ wrap: value }),
  });
  const showActions = computed({
    get: () => active.value.showActions,
    set: (value: boolean) => update({ showActions: value }),
  });
  const propertyAlign = computed({
    get: () => active.value.propertyAlign,
    set: (value: "end" | "start") => update({ propertyAlign: value }),
  });
  const maxProperties = computed({
    get: () => active.value.maxProperties,
    set: (value: number | undefined) => update({ maxProperties: value }),
  });
  const mobileMaxProperties = computed({
    get: () => active.value.mobileMaxProperties,
    set: (value: number | undefined) => update({ mobileMaxProperties: value }),
  });
  const titleColumn = computed({
    get: () => active.value.titleColumn || (columns.value[0]?.id ?? "id"),
    set: (value: string) => update({ titleColumn: value }),
  });
  const propertyIds = computed({
    get: () =>
      active.value.cardColumnIds ??
      columns.value
        .map((column) => column.id)
        .filter((id) => id !== titleColumn.value),
    set: (value: string[]) => update({ cardColumnIds: value }),
  });
  const showLabels = computed({
    get: () => active.value.showCardLabels === true,
    set: (value: boolean) => update({ showCardLabels: value }),
  });
  const reset = (): void => {
    context.state.list.value = {};
  };

  const visibleProperties = (ids: string[]): string[] =>
    visibleListProperties(ids, active.value, isMobile.value);

  return {
    context,
    wrap,
    showActions,
    propertyAlign,
    maxProperties,
    mobileMaxProperties,
    visibleProperties,
    translate,
    columns,
    columnOptions,
    titleColumn,
    propertyIds,
    showLabels,
    reset,
  };
}
