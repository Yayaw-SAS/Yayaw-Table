import { computed } from "vue";
import { useTableContext } from "../context";
import {
  type KanbanLaneSettings,
  kanbanLaneCandidates,
  kanbanLaneSettings,
  mergeKanbanLanes,
  withKanbanLaneSettings,
} from "../kanban-lanes";
import { emptyGroupLabel, fieldText, groupValueKey } from "../table-contracts";

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
        // Every visible property by default, as in React.
        .filter(
          (column) =>
            !["select", "actions", titleColumn.value].includes(column.id) &&
            context.state.visibility.value[column.id] !== false
        )
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

  // Lanes of the grouping column: the view's settings, else the table's.
  const laneSettings = computed(() =>
    kanbanLaneSettings(
      mergeKanbanLanes(
        context.config.table.kanban?.lanes,
        context.state.kanban.value.lanes
      ),
      groupBy.value
    )
  );
  /** Every lane the settings can arrange, hidden ones included, in order. */
  const lanes = computed(() => {
    const id = groupBy.value;
    if (!id) {
      return [];
    }
    const definition = context.config.columns.definitions.find(
      (column) => column.id === id
    );
    const read = (row: Record<string, unknown>) =>
      definition?.accessorFn
        ? definition.accessorFn(row)
        : row[definition?.accessorKey ?? id];
    const kanban = context.config.table.kanban;
    return kanbanLaneCandidates({
      label: (value) =>
        (value && (fieldText(value, definition, context.locale) || value)) ||
        emptyGroupLabel(context.locale),
      // The board's own order: fixed groups, then values as rows bring them.
      options:
        kanban?.groupBy === id
          ? (kanban.groups ?? []).map((group) => ({
              value: groupValueKey(group.value),
              label: group.label,
            }))
          : [],
      settings: laneSettings.value,
      values: [
        ...context.data.rows.value.map((row) => groupValueKey(read(row))),
        ...(definition?.options ?? []).map((option) =>
          groupValueKey(option.value)
        ),
      ],
    });
  });
  /** The view changes this column's lanes: they can be reset to the default. */
  const lanesResettable = computed(() => {
    const own = context.state.kanban.value.lanes;
    return Boolean(own && Object.hasOwn(own, groupBy.value));
  });
  const setLanes = (settings: KanbanLaneSettings | undefined): void => {
    context.state.kanban.value = {
      ...context.state.kanban.value,
      lanes: withKanbanLaneSettings(
        context.state.kanban.value.lanes,
        groupBy.value,
        settings
      ),
    };
  };

  return {
    context,
    laneSettings,
    lanes,
    lanesResettable,
    setLanes,
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
