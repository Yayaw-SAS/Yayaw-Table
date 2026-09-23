<script setup lang="ts">
import { computed, ref } from "vue";
import { useCardRows } from "../../composables/use-card-rows";
import { useListSettings } from "../../composables/use-list-settings";
import { displayCellValue } from "../../core";
import { selectionAfterClick } from "../../selection-interaction";
import type { ColumnDefinition, TableRecord } from "../../types";
import TableCheckbox from "../controls/TableCheckbox.vue";
import CellRenderer from "../table/CellRenderer.vue";
import RowActions from "../table/RowActions.vue";
import TableEmptyState from "../table/TableEmptyState.vue";

const EMPTY_GROUP_LABEL = "No value";
const { context, translate, columns, titleColumn, propertyIds, showLabels } =
  useListSettings();
const rows = useCardRows();
const column = (id: string): ColumnDefinition | undefined =>
  columns.value.find((item) => item.id === id);
const value = (row: TableRecord, id: string): unknown =>
  column(id)?.accessorFn
    ? column(id)?.accessorFn?.(row)
    : row[column(id)?.accessorKey ?? id];
const groupBy = computed(() => context.state.grouping.value[0] ?? "");
const properties = computed(() =>
  propertyIds.value.filter(
    (id) => id !== titleColumn.value && id !== groupBy.value && column(id)
  )
);
const sections = computed(() => {
  if (!groupBy.value) {
    return [{ id: "all", label: "", rows: rows.value }];
  }
  const groups = new Map<string, TableRecord[]>();
  for (const row of rows.value) {
    const raw = value(row, groupBy.value);
    const label =
      raw === null || raw === undefined || raw === ""
        ? EMPTY_GROUP_LABEL
        : String(raw);
    groups.set(label, [...(groups.get(label) ?? []), row]);
  }
  return [...groups].map(([label, sectionRows]) => ({
    id: label,
    label,
    rows: sectionRows,
  }));
});
const groupHeader = computed(
  () => column(groupBy.value)?.header ?? groupBy.value
);
const orderedRows = computed(() =>
  sections.value.flatMap((section) => section.rows)
);
const checkboxShift = ref(false);
const selectable = (row: TableRecord): boolean =>
  context.config.table.canSelectRow?.(row) !== false;
const toggleSelection = (
  row: TableRecord,
  checked: boolean,
  shift = false
): void => {
  if (!selectable(row)) {
    return;
  }
  context.selection.value = selectionAfterClick({
    scope: context.selection,
    rows: orderedRows.value
      .filter(selectable)
      .map((item) => ({ id: context.getRowId(item) })),
    selection: context.selection.value,
    id: context.getRowId(row),
    selected: checked,
    shift,
    multiple: context.config.table.enableMultiRowSelection,
  });
};
const captureSelection = (row: TableRecord, event: MouseEvent): void => {
  if (
    !(event.shiftKey || event.metaKey || event.ctrlKey) ||
    !context.config.table.enableRowSelection ||
    (event.target as Element).closest(".yayaw-list-select")
  ) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  toggleSelection(
    row,
    event.shiftKey || !context.selection.value[context.getRowId(row)],
    event.shiftKey
  );
};
const activate = (row: TableRecord, event: MouseEvent | KeyboardEvent): void => {
  if (
    event instanceof KeyboardEvent &&
    (event.target !== event.currentTarget || !["Enter", " "].includes(event.key))
  ) {
    return;
  }
  if (
    event.target instanceof Element &&
    event.target.closest("button,a,input,select,textarea,label")
  ) {
    return;
  }
  if (event instanceof KeyboardEvent) {
    event.preventDefault();
  }
  context.activateRow(row, event as MouseEvent);
};
</script>

<template>
  <TableEmptyState
    v-if="!rows.length && !context.data.isLoading.value && !context.data.error.value && context.config.table.emptyState?.show !== false"
    class="yayaw-card-empty"
  />
  <div v-else class="yayaw-list">
    <section v-for="section in sections" :key="section.id" class="yayaw-list-section">
      <div v-if="section.label" class="yayaw-list-group">
        <h3><span class="yayaw-list-group-label">{{ groupHeader }}: </span>{{ section.label }}</h3>
        <span class="yayaw-count">{{ section.rows.length }}</span>
      </div>
      <ul>
        <li
          v-for="row in section.rows"
          :key="context.getRowId(row)"
          :class="{ selected: context.selection.value[context.getRowId(row)] }"
          :data-yayaw-row-id="context.getRowId(row)"
        >
          <div
            class="yayaw-list-item"
            tabindex="0"
            role="button"
            @click.capture="captureSelection(row, $event)"
            @mousedown.capture="(event) => { if (event.shiftKey || event.ctrlKey || event.metaKey) event.preventDefault(); }"
            @click="activate(row, $event)"
            @keydown="activate(row, $event)"
          >
            <span
              v-if="context.config.table.enableRowSelection"
              class="yayaw-list-select"
              @click.capture="checkboxShift = $event.shiftKey"
              @click.stop
            >
              <TableCheckbox
                :label="`${translate('selectRow', 'Select')} ${String(value(row, titleColumn))}`"
                :model-value="Boolean(context.selection.value[context.getRowId(row)])"
                :disabled="!selectable(row)"
                @update:model-value="toggleSelection(row, $event, checkboxShift); checkboxShift = false"
              />
            </span>
            <strong class="yayaw-list-title">{{ displayCellValue(value(row, titleColumn), column(titleColumn) ?? { id: titleColumn, header: titleColumn }, context.locale) }}</strong>
            <dl class="yayaw-list-properties">
              <div v-for="id in properties" :key="id">
                <dt :class="{ 'yayaw-sr-only': !showLabels }">{{ column(id)?.header ?? id }}</dt>
                <dd><CellRenderer :value="value(row, id)" :row="row" :column="column(id) ?? { id, header: id }" /></dd>
              </div>
            </dl>
            <RowActions :row="row" />
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
