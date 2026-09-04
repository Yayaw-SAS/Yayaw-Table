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
import CellRenderer from "../table/CellRenderer.vue";
import RowActions from "../table/RowActions.vue";

const context = useTableContext();
const translate = (key: string, fallback: string) => String(context.translations.value[key] ?? fallback);
const columns = computed(() =>
  context.config.columns.definitions.filter(
    (column) => !["select", "actions"].includes(column.id)
  )
);
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
const toggleProperty = (id: string, checked: boolean): void => {
  propertyIds.value = checked
    ? [...propertyIds.value.filter((value) => value !== id), id]
    : propertyIds.value.filter((value) => value !== id);
};
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
  <div class="yayaw-card-view-shell">
    <div class="yayaw-card-controls">
      <label>{{ translate('cardImage', 'Image') }} <select v-model="imageColumn" class="yayaw-select"><option value="">{{ translate('none', 'None') }}</option><option v-for="item in columns" :key="item.id" :value="item.id">{{ item.header }}</option></select></label>
      <label>{{ translate('cardTitle', 'Title') }} <select v-model="titleColumn" class="yayaw-select"><option v-for="item in columns" :key="item.id" :value="item.id">{{ item.header }}</option></select></label>
      <label>{{ translate('cardRatio', 'Ratio') }} <select v-model="aspectRatio" class="yayaw-select"><option value="square">{{ translate('cardSquare', 'Square') }}</option><option value="portrait">{{ translate('cardPortrait', 'Portrait') }}</option><option value="video">{{ translate('cardVideo', 'Video') }}</option><option value="wide">{{ translate('cardWide', 'Wide') }}</option></select></label>
      <label>{{ translate('cardFit', 'Fit') }} <select v-model="imageFit" class="yayaw-select"><option value="cover">{{ translate('cardCover', 'Cover') }}</option><option value="contain">{{ translate('cardContain', 'Contain') }}</option></select></label>
      <label>{{ translate('cardSize', 'Size') }} <select v-model="cardSize" class="yayaw-select"><option value="small">{{ translate('cardSmall', 'Small') }}</option><option value="medium">{{ translate('cardMedium', 'Medium') }}</option><option value="large">{{ translate('cardLarge', 'Large') }}</option></select></label>
      <details><summary class="yayaw-button yayaw-button-outline">{{ translate('properties', 'Properties') }}</summary><div class="yayaw-card-properties-menu">
        <label v-for="item in columns" :key="item.id" class="yayaw-checkbox-label"><input type="checkbox" :checked="propertyIds.includes(item.id)" @change="toggleProperty(item.id, ($event.target as HTMLInputElement).checked)" /> {{ item.header }}</label>
        <label class="yayaw-checkbox-label"><input v-model="showLabels" type="checkbox" /> {{ translate('cardShowLabels', 'Show labels') }}</label>
      </div></details>
    </div>
    <section v-for="section in sections" :key="section.label" class="yayaw-gallery-section">
      <h3 v-if="section.label">{{ section.label }} <span class="yayaw-count">{{ section.rows.length }}</span></h3>
      <div class="yayaw-gallery" :data-size="cardSize">
        <article v-for="row in section.rows" :key="context.getRowId(row)" class="yayaw-card yayaw-gallery-card" tabindex="0" @click="activate(row, $event)" @keydown="activate(row, $event)">
          <div class="yayaw-gallery-media" :data-ratio="aspectRatio">
            <img v-if="imageFor(row)" :src="imageFor(row)" :alt="String(value(row, titleColumn) ?? '')" loading="lazy" :style="{ objectFit: imageFit }" />
            <span v-else>{{ initialFor(row) }}</span>
            <label v-if="context.config.table.enableRowSelection" class="yayaw-card-select" @click.stop><input type="checkbox" :aria-label="translate('selectRow', 'Select') + ' ' + String(value(row, titleColumn))" :checked="context.selection.value[context.getRowId(row)]" :disabled="context.config.table.canSelectRow?.(row) === false" @change="toggleSelection(row, ($event.target as HTMLInputElement).checked)" /></label>
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
