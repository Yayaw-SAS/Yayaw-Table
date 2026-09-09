<script setup lang="ts">
import { computed } from "vue";
import { useTableContext } from "../../context";
import { displayCellValue, imageSource } from "../../core";
import type {
  ColumnDefinition,
  TableGalleryAspectRatio,
  TableGalleryCardSize,
  TableGalleryImageFit,
  TableRecord,
} from "../../types";
import { useCardRows } from "../../composables/use-card-rows";
import CardPropertiesMenu from "../controls/CardPropertiesMenu.vue";
import TableCheckbox from "../controls/TableCheckbox.vue";
import TableSelect from "../controls/TableSelect.vue";
import CellRenderer from "../table/CellRenderer.vue";
import RowActions from "../table/RowActions.vue";

const context = useTableContext();
const translate = (key: string, fallback: string) => String(context.translations.value[key] ?? fallback);
const columns = computed(() =>
  context.config.columns.definitions.filter(
    (column) => !["select", "actions"].includes(column.id)
  )
);
const columnOptions = computed(() => columns.value.map((column) => ({ value: column.id, label: column.header })));
const imageOptions = computed(() => [{ value: "", label: translate("none", "None") }, ...columnOptions.value]);
const ratioOptions = computed(() => [
  { value: "square" as const, label: translate("cardSquare", "Square") },
  { value: "portrait" as const, label: translate("cardPortrait", "Portrait") },
  { value: "video" as const, label: translate("cardVideo", "Video") },
  { value: "wide" as const, label: translate("cardWide", "Wide") },
]);
const fitOptions = computed(() => [
  { value: "cover" as const, label: translate("cardCover", "Cover") },
  { value: "contain" as const, label: translate("cardContain", "Contain") },
]);
const sizeOptions = computed(() => [
  { value: "small" as const, label: translate("cardSmall", "Small") },
  { value: "medium" as const, label: translate("cardMedium", "Medium") },
  { value: "large" as const, label: translate("cardLarge", "Large") },
]);
const imageColumn = computed({
  get: () =>
    context.state.gallery.value.imageColumn ??
    context.config.table.gallery?.imageColumn ??
    columns.value.find((column) => column.type === "image")?.id ??
    "",
  set: (value: string) => {
    context.state.gallery.value = {
      ...context.state.gallery.value,
      imageColumn: value,
    };
  },
});
const titleColumn = computed({
  get: () =>
    context.state.gallery.value.titleColumn ??
    context.config.table.gallery?.titleColumn ??
    columns.value.find((column) => column.id !== imageColumn.value)?.id ??
    "id",
  set: (value: string) => {
    context.state.gallery.value = {
      ...context.state.gallery.value,
      titleColumn: value,
    };
  },
});
const propertyIds = computed({
  get: () =>
    context.state.gallery.value.cardColumnIds ??
    context.config.table.gallery?.cardColumnIds ??
    columns.value
      .filter(
        (column) => ![imageColumn.value, titleColumn.value].includes(column.id)
      )
      .slice(0, 4)
      .map((column) => column.id),
  set: (value: string[]) => {
    context.state.gallery.value = {
      ...context.state.gallery.value,
      cardColumnIds: value,
    };
  },
});
const aspectRatio = computed({
  get: () =>
    context.state.gallery.value.aspectRatio ??
    context.config.table.gallery?.aspectRatio ??
    "square",
  set: (value: TableGalleryAspectRatio) => {
    context.state.gallery.value = {
      ...context.state.gallery.value,
      aspectRatio: value,
    };
  },
});
const imageFit = computed({
  get: () =>
    context.state.gallery.value.imageFit ??
    context.config.table.gallery?.imageFit ??
    "cover",
  set: (value: TableGalleryImageFit) => {
    context.state.gallery.value = {
      ...context.state.gallery.value,
      imageFit: value,
    };
  },
});
const cardSize = computed({
  get: () =>
    context.state.gallery.value.cardSize ??
    context.config.table.gallery?.cardSize ??
    "medium",
  set: (value: TableGalleryCardSize) => {
    context.state.gallery.value = {
      ...context.state.gallery.value,
      cardSize: value,
    };
  },
});
const showLabels = computed({
  get: () =>
    context.state.gallery.value.showCardLabels ??
    context.config.table.gallery?.showCardLabels ??
    false,
  set: (value: boolean) => {
    context.state.gallery.value = {
      ...context.state.gallery.value,
      showCardLabels: value,
    };
  },
});
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
  <div
    v-if="!rows.length && !context.data.isLoading.value && context.config.table.emptyState?.show !== false"
    class="yayaw-empty yayaw-card-empty"
  >
    <strong>{{ context.config.table.emptyState?.title ?? context.translations.value.noResults }}</strong>
    <span v-if="context.config.table.emptyState?.description">{{ context.config.table.emptyState.description }}</span>
  </div>
  <div v-else class="yayaw-card-view-shell">
    <div class="yayaw-card-controls">
      <TableSelect v-model="imageColumn" :label="translate('cardImage', 'Image')" :options="imageOptions" />
      <TableSelect v-model="titleColumn" :label="translate('cardTitle', 'Title')" :options="columnOptions" />
      <TableSelect v-model="aspectRatio" :label="translate('cardRatio', 'Ratio')" :options="ratioOptions" />
      <TableSelect v-model="imageFit" :label="translate('cardFit', 'Fit')" :options="fitOptions" />
      <TableSelect v-model="cardSize" :label="translate('cardSize', 'Size')" :options="sizeOptions" />
      <CardPropertiesMenu v-model="propertyIds" v-model:show-labels="showLabels" :label="translate('properties', 'Properties')" :show-labels-label="translate('cardShowLabels', 'Show labels')" :options="columnOptions" />
    </div>
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
