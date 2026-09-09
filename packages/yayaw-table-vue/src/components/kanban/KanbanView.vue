<script setup lang="ts">
import { ArrowLeft, ArrowRight } from "lucide-vue-next";
import TableEmptyState from "../table/TableEmptyState.vue";
import { computed, ref } from "vue";
import { useTableContext } from "../../context";
import { displayCellValue } from "../../core";
import type { ColumnDefinition, TableRecord } from "../../types";
import { useCardRows } from "../../composables/use-card-rows";
import CardPropertiesMenu from "../controls/CardPropertiesMenu.vue";
import TableCheckbox from "../controls/TableCheckbox.vue";
import TableSelect from "../controls/TableSelect.vue";
import CellRenderer from "../table/CellRenderer.vue";
import RowActions from "../table/RowActions.vue";

const context = useTableContext();
const translate = (key: string, fallback: string) => String(context.translations.value[key] ?? fallback);
const columns = computed(() => context.config.columns.definitions.filter((column) => !["select", "actions"].includes(column.id)));
const columnOptions = computed(() => columns.value.map((column) => ({ value: column.id, label: column.header })));
const groupingOptions = computed(() => columns.value.filter((column) => column.enableGrouping !== false).map((column) => ({ value: column.id, label: column.header })));
const dragged = ref<TableRecord>();
const pending = ref<string>();
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
const rows = useCardRows();
const rawGroups = computed(() => {
  const configured = groupBy.value === context.config.table.kanban?.groupBy ? context.config.table.kanban?.groups ?? [] : [];
  const values = new Set(
    rows.value.map((row) => String(value(row, groupBy.value) ?? "Unassigned"))
  );
  const groups = configured.map((group) => ({
    value: group.value,
    label: group.label ?? group.value,
  }));
  for (const value of values) {
    if (!groups.some((group) => group.value === value)) {
      groups.push({ value, label: value });
    }
  }
  return groups;
});
const rowsFor = (group: string): TableRecord[] =>
  rows.value.filter(
    (row) => String(value(row, groupBy.value) ?? "Unassigned") === group
  );
const column = (id: string): ColumnDefinition | undefined =>
  context.config.columns.definitions.find((item) => item.id === id);
const value = (row: TableRecord, id: string): unknown => {
  const definition = column(id);
  return definition?.accessorFn
    ? definition.accessorFn(row)
    : row[definition?.accessorKey ?? id];
};
const canDrag = computed(
  () =>
    context.config.table.kanban?.allowDragUpdate &&
    context.config.table.allowEdit &&
    Boolean(context.actions.value?.update) &&
    Boolean(groupBy.value)
);
const canEditRow = (row: TableRecord): boolean =>
  context.config.table.canEditRow?.(row) !== false;
const moveRow = async (
  row: TableRecord | undefined,
  target: string
): Promise<void> => {
  const definition = column(groupBy.value);
  const field = definition?.accessorKey ?? groupBy.value;
  if (
    !canDrag.value || pending.value ||
    !(row && groupBy.value) ||
    String(value(row, groupBy.value)) === target ||
    !context.actions.value?.update ||
    context.config.table.canEditRow?.(row) === false
  ) {
    return;
  }
  const id = context.getRowId(row);
  const previous = row[field];
  row[field] = target;
  pending.value = id;
  try {
    const result = await context.actions.value.update(id, { [field]: target });
    if (!result.success) {
      row[field] = previous;
      throw new Error(result.error ?? "Move failed");
    }
    await context.refresh();
  } catch (cause) {
    if (Object.is(row[field], target)) row[field] = previous;
    context.status.value = {
      type: "error",
      message: cause instanceof Error ? cause.message : String(cause),
    };
  } finally {
    dragged.value = undefined;
    pending.value = undefined;
  }
};
const drop = async (target: string): Promise<void> => {
  await moveRow(dragged.value, target);
};
const adjacentGroup = (
  row: TableRecord,
  offset: -1 | 1
): { label: string; value: string } | undefined => {
  const currentValue = String(value(row, groupBy.value) ?? "Unassigned");
  const currentIndex = rawGroups.value.findIndex(
    (group) => group.value === currentValue
  );
  return rawGroups.value[currentIndex + offset];
};
const activate = (
  row: TableRecord,
  event: MouseEvent | KeyboardEvent
): void => {
  if (event instanceof KeyboardEvent && (event.target !== event.currentTarget || !["Enter", " "].includes(event.key))) {
    return;
  }
  if (event.target instanceof Element && event.target.closest("button,a,input,select,textarea,label")) return;
  if (event instanceof KeyboardEvent) event.preventDefault();
  context.activateRow(row, event as MouseEvent);
};
const toggleSelection = (row: TableRecord, checked: boolean): void => {
  if (context.config.table.canSelectRow?.(row) === false) {
    return;
  }
  if (!context.config.table.enableMultiRowSelection) {
    context.clearSelection();
  }
  context.selection.value[context.getRowId(row)] = checked;
};
</script>

<template>
  <TableEmptyState
    v-if="!rows.length && !context.data.isLoading.value && !context.data.error.value && context.config.table.emptyState?.show !== false"
    class="yayaw-card-empty"
  />
  <div v-else class="yayaw-card-view-shell">
    <div class="yayaw-card-controls">
      <TableSelect v-model="groupBy" :label="translate('cardLane', 'Lane')" :options="groupingOptions" />
      <TableSelect v-model="titleColumn" :label="translate('cardTitle', 'Title')" :options="columnOptions" />
      <CardPropertiesMenu v-model="propertyIds" v-model:show-labels="showLabels" :label="translate('properties', 'Properties')" :show-labels-label="translate('cardShowLabels', 'Show labels')" :options="columnOptions" />
    </div>
    <div class="yayaw-kanban">
      <section v-for="group in rawGroups" :key="group.value" class="yayaw-kanban-lane" @dragover.prevent @drop="drop(group.value)">
        <header><strong>{{ group.label }}</strong><span class="yayaw-count">{{ rowsFor(group.value).length }}</span></header>
        <div class="yayaw-kanban-cards">
          <article
            v-for="row in rowsFor(group.value)"
            :key="context.getRowId(row)"
            class="yayaw-card yayaw-kanban-card"
            :class="{ pending: pending === context.getRowId(row) }"
            :draggable="canDrag && canEditRow(row)"
            tabindex="0"
            @dragstart="dragged = row"
            @click="activate(row, $event)"
            @keydown="activate(row, $event)"
          >
            <div class="yayaw-card-header">
              <span v-if="context.config.table.enableRowSelection" class="yayaw-card-select" @click.stop>
                <TableCheckbox :label="translate('selectRow', 'Select') + ' ' + String(value(row, titleColumn))" :model-value="Boolean(context.selection.value[context.getRowId(row)])" :disabled="context.config.table.canSelectRow?.(row) === false" @update:model-value="toggleSelection(row, $event)" />
              </span>
              <strong>{{ displayCellValue(value(row, titleColumn), column(titleColumn) ?? { id: titleColumn, header: titleColumn }, context.locale) }}</strong>
              <div v-if="canDrag && canEditRow(row)" class="yayaw-kanban-move-actions">
                <button
                  v-if="adjacentGroup(row, -1)"
                  type="button"
                  class="yayaw-icon-button"
                  :aria-label="translate('moveTo', 'Move') + ' ' + String(value(row, titleColumn)) + ' ' + translate('to', 'to') + ' ' + adjacentGroup(row, -1)?.label"
                  :disabled="Boolean(pending)"
                  @click.stop="moveRow(row, adjacentGroup(row, -1)?.value ?? '')"
                >
                  <ArrowLeft :size="16" aria-hidden="true" />
                </button>
                <button
                  v-if="adjacentGroup(row, 1)"
                  type="button"
                  class="yayaw-icon-button"
                  :aria-label="translate('moveTo', 'Move') + ' ' + String(value(row, titleColumn)) + ' ' + translate('to', 'to') + ' ' + adjacentGroup(row, 1)?.label"
                  :disabled="Boolean(pending)"
                  @click.stop="moveRow(row, adjacentGroup(row, 1)?.value ?? '')"
                >
                  <ArrowRight :size="16" aria-hidden="true" />
                </button>
              </div>
              <RowActions :row="row" />
            </div>
            <dl class="yayaw-card-properties" :class="{ labeled: showLabels }">
              <template v-for="id in propertyIds.filter((item) => item !== titleColumn && item !== groupBy)" :key="id">
                <dt v-if="showLabels">{{ column(id)?.header ?? id }}</dt>
                <dd><CellRenderer :value="value(row, id)" :row="row" :column="column(id) ?? { id, header: id }" /></dd>
              </template>
            </dl>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>
