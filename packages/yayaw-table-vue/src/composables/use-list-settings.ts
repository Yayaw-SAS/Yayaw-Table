import { computed } from "vue";
import { useTableContext } from "../context";
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
  const active = computed<TableListViewConfig>(() => ({
    ...context.config.table.list,
    ...context.state.list.value,
  }));
  const update = (patch: TableListViewConfig): void => {
    context.state.list.value = { ...context.state.list.value, ...patch };
  };
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

  return {
    context,
    translate,
    columns,
    columnOptions,
    titleColumn,
    propertyIds,
    showLabels,
    reset,
  };
}
