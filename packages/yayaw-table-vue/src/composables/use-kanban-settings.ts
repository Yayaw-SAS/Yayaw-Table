import { computed } from "vue";
import { useTableContext } from "../context";

export function useKanbanSettings() {
  const context = useTableContext();
  const translate = (key: string, fallback: string) =>
    String(context.translations.value[key] ?? fallback);
  const columns = computed(() =>
    context.config.columns.definitions.filter(
      (column) => !["select", "actions"].includes(column.id)
    )
  );
  const columnOptions = computed(() =>
    columns.value.map((column) => ({ value: column.id, label: column.header }))
  );
  const groupingOptions = computed(() =>
    columns.value
      .filter((column) => column.enableGrouping !== false)
      .map((column) => ({ value: column.id, label: column.header }))
  );
  const groupBy = computed({
    get: () =>
      context.state.grouping.value[0] ??
      context.config.table.kanban?.groupBy ??
      "",
    set: (value: string) => {
      context.state.grouping.value = value ? [value] : [];
    },
  });
  const titleColumn = computed({
    get: () =>
      context.state.kanban.value.titleColumn ??
      context.config.table.kanban?.titleColumn ??
      context.config.columns.definitions.find(
        (column) => !["select", "actions"].includes(column.id)
      )?.id ??
      "id",
    set: (value: string) => {
      context.state.kanban.value = {
        ...context.state.kanban.value,
        titleColumn: value,
      };
    },
  });
  const propertyIds = computed({
    get: () =>
      context.state.kanban.value.cardColumnIds ??
      context.config.table.kanban?.cardColumnIds ??
      context.config.columns.definitions
        .filter(
          (column) =>
            !["select", "actions", titleColumn.value].includes(column.id)
        )
        .slice(0, 4)
        .map((column) => column.id),
    set: (value: string[]) => {
      context.state.kanban.value = {
        ...context.state.kanban.value,
        cardColumnIds: value,
      };
    },
  });
  const showLabels = computed({
    get: () =>
      context.state.kanban.value.showCardLabels ??
      context.config.table.kanban?.showCardLabels ??
      false,
    set: (value: boolean) => {
      context.state.kanban.value = {
        ...context.state.kanban.value,
        showCardLabels: value,
      };
    },
  });

  return {
    context,
    translate,
    columns,
    columnOptions,
    titleColumn,
    propertyIds,
    showLabels,
    groupingOptions,
    groupBy,
  };
}
