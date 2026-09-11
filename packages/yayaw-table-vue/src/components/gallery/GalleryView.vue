<script setup lang="ts">
import TableEmptyState from "../table/TableEmptyState.vue";
import { computed } from "vue";
import { useGallerySettings } from "../../composables/use-gallery-settings";
import { displayCellValue, imageSource } from "../../core";
import type {
  ColumnDefinition,
  TableRecord,
} from "../../types";
import { useCardRows } from "../../composables/use-card-rows";
import TableCheckbox from "../controls/TableCheckbox.vue";
import CellRenderer from "../table/CellRenderer.vue";
import RowActions from "../table/RowActions.vue";

const { context, translate, columns, titleColumn, propertyIds, showLabels, imageColumn, aspectRatio, imageFit, cardSize } = useGallerySettings();
const rows = useCardRows();
const column = (id: string): ColumnDefinition | undefined =>
  columns.value.find((item) => item.id === id);
const value = (row: TableRecord, id: string): unknown =>
  column(id)?.accessorFn
    ? column(id)?.accessorFn?.(row)
    : row[column(id)?.accessorKey ?? id];
const sections = computed(() => {
  const groupBy = context.state.grouping.value[0];
  if (!groupBy) {
    return [{ label: "", rows: rows.value }];
  }
  const groups = new Map<string, TableRecord[]>();
  for (const row of rows.value) {
    const label = String(value(row, groupBy) ?? "Unassigned");
    groups.set(label, [...(groups.get(label) ?? []), row]);
  }
  return [...groups].map(([label, sectionRows]) => ({
    label,
    rows: sectionRows,
  }));
});
const imageFor = (row: TableRecord): string | undefined =>
  imageSource(value(row, imageColumn.value));
const initialFor = (row: TableRecord): string =>
  String(value(row, titleColumn.value) ?? "?")
    .trim()
    .charAt(0)
    .toLocaleUpperCase() || "?";
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

    <section v-for="section in sections" :key="section.label" class="yayaw-gallery-section">
      <h3 v-if="section.label">{{ section.label }} <span class="yayaw-count">{{ section.rows.length }}</span></h3>
      <div class="yayaw-gallery" :data-size="cardSize">
        <article v-for="row in section.rows" :key="context.getRowId(row)" class="yayaw-card yayaw-gallery-card" tabindex="0" @click="activate(row, $event)" @keydown="activate(row, $event)">
          <div class="yayaw-gallery-media" :data-ratio="aspectRatio">
            <img v-if="imageFor(row)" :src="imageFor(row)" :alt="String(value(row, titleColumn) ?? '')" loading="lazy" :style="{ objectFit: imageFit }" />
            <span v-else>{{ initialFor(row) }}</span>
            <span v-if="context.config.table.enableRowSelection" class="yayaw-card-select" @click.stop><TableCheckbox :label="translate('selectRow', 'Select') + ' ' + String(value(row, titleColumn))" :model-value="Boolean(context.selection.value[context.getRowId(row)])" :disabled="context.config.table.canSelectRow?.(row) === false" @update:model-value="toggleSelection(row, $event)" /></span>
          </div>
          <div class="yayaw-gallery-body">
            <div class="yayaw-card-header"><strong>{{ displayCellValue(value(row, titleColumn), column(titleColumn) ?? { id: titleColumn, header: titleColumn }, context.locale) }}</strong><RowActions :row="row" /></div>
            <dl class="yayaw-card-properties" :class="{ labeled: showLabels }">
              <template v-for="id in propertyIds.filter((item) => ![titleColumn, imageColumn].includes(item))" :key="id"><dt v-if="showLabels">{{ column(id)?.header ?? id }}</dt><dd><CellRenderer :value="value(row, id)" :row="row" :column="column(id) ?? { id, header: id }" /></dd></template>
            </dl>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
