<script setup lang="ts">
import { Image as ImageIcon } from "lucide-vue-next";
import TableEmptyState from "../table/TableEmptyState.vue";
import { computed, defineComponent, onBeforeUnmount, ref } from "vue";
import type { PropType, VNodeChild } from "vue";
import { galleryAspectRatio, resolveGalleryMedia } from "../../media-contract";
import { mediaViewerLabels, openMediaViewer } from "../../media-viewer";
import { selectionAfterClick } from "../../selection-interaction";
import "../../media-viewer.css";
import GalleryMedia from "./GalleryMedia.vue";
import { useGallerySettings } from "../../composables/use-gallery-settings";
import { displayCellValue, imageSource } from "../../core";
import type {
  ColumnDefinition,
  TableRecord,
} from "../../types";
import { useCardRows } from "../../composables/use-card-rows";
import { emptyGroupLabel, fieldText, groupValueKey } from "../../table-contracts";
import TableCheckbox from "../controls/TableCheckbox.vue";
import CellRenderer from "../table/CellRenderer.vue";
import RowActions from "../table/RowActions.vue";

const { context, translate, columns, titleColumn, propertyIds, showLabels, imageColumn, aspectRatio, imageFit, cardSize, previewSize } = useGallerySettings();
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
    return [{ id: "all", label: "", rows: rows.value }];
  }
  // Headings read the value as the table shows it; groups stay by raw value.
  const groups = new Map<string, { id: string; label: string; rows: TableRecord[] }>();
  for (const row of rows.value) {
    const raw = value(row, groupBy);
    const key = groupValueKey(raw);
    const section = groups.get(key) ?? {
      id: key,
      label:
        (key && (fieldText(raw, column(groupBy), context.locale) || key)) ||
        emptyGroupLabel(context.locale),
      rows: [],
    };
    section.rows.push(row);
    groups.set(key, section);
  }
  return [...groups.values()];
});
/** The title as the table shows it, for names, alt text and initials. */
const titleText = (row: TableRecord): string =>
  fieldText(value(row, titleColumn.value), column(titleColumn.value), context.locale, row);
const imageFor = (row: TableRecord): string | undefined =>
  imageSource(value(row, imageColumn.value));
const initialFor = (row: TableRecord): string =>
  (titleText(row) || "?")
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
const orderedRows = computed(() => sections.value.flatMap(section => section.rows));
const toggleSelection = (row: TableRecord, checked: boolean, shift = false): void => {
  if (context.config.table.canSelectRow?.(row) === false) return;
  context.selection.value = selectionAfterClick({
    scope: context.selection,
    rows: orderedRows.value.filter(item => context.config.table.canSelectRow?.(item) !== false).map(item => ({id: context.getRowId(item)})),
    selection: context.selection.value, id: context.getRowId(row), selected: checked, shift, multiple: context.config.table.enableMultiRowSelection,
  });
};
const captureSelection = (row: TableRecord, event: MouseEvent): void => {
  if (!(event.shiftKey || event.metaKey || event.ctrlKey) || !context.config.table.enableRowSelection || (event.target as Element).closest('.yayaw-card-select')) return;
  event.preventDefault(); event.stopPropagation();
  (event.currentTarget as HTMLElement).focus({ preventScroll: true });
  toggleSelection(row, event.shiftKey || !context.selection.value[context.getRowId(row)], event.shiftKey);
};
const checkboxShift = ref(false);
const labels = computed(() => mediaViewerLabels(context.locale));
let viewer: ReturnType<typeof openMediaViewer> | undefined;
onBeforeUnmount(() => viewer?.destroy());
const openPreview = (row: TableRecord, target: HTMLElement) => {
  viewer?.destroy();
  viewer = openMediaViewer({
    items: orderedRows.value.map(item => ({ id: context.getRowId(item), title: titleText(item) || context.getRowId(item), source: resolveGalleryMedia(item, context.config.table.gallery?.media, imageColumn.value) })),
    index: orderedRows.value.findIndex(item => context.getRowId(item) === context.getRowId(row)), labels: labels.value, returnFocus: target,
    onInfo: context.openDetails ? id => { const item = orderedRows.value.find(item => context.getRowId(item) === id); if (item) context.openDetails?.(item); } : undefined,
  });
};
const mediaContext = (row: TableRecord) => ({ row, title: titleText(row) || context.getRowId(row), source: imageFor(row), imageFit: imageFit.value, aspectRatio: aspectRatio.value });
const CustomContent = defineComponent({ props: { node: { type: null as unknown as PropType<VNodeChild>, required: true } }, setup: props => () => props.node });
</script>

<template>
  <TableEmptyState
    v-if="!rows.length && !context.data.isLoading.value && !context.data.error.value && context.config.table.emptyState?.show !== false"
    class="yayaw-card-empty"
  />
  <div v-else class="yayaw-card-view-shell yayaw-gallery-panel">

    <section v-for="section in sections" :key="section.id" class="yayaw-gallery-section">
      <h3 v-if="section.label">{{ section.label }} <span class="yayaw-count">{{ section.rows.length }}</span></h3>
      <div class="yayaw-gallery" :data-size="cardSize">
        <article v-for="row in section.rows" :key="context.getRowId(row)" class="yayaw-card yayaw-gallery-card" :class="{ selected: context.selection.value[context.getRowId(row)] }" :data-yayaw-row-id="context.getRowId(row)" :data-row-id="context.getRowId(row)" tabindex="0" role="button" @click.capture="captureSelection(row, $event)" @contextmenu.capture="event => { if(event.ctrlKey && event.button === 0) captureSelection(row, event); }" @mousedown.capture="event => { if(event.shiftKey || event.ctrlKey || event.metaKey) event.preventDefault(); }" @click="activate(row, $event)" @keydown="activate(row, $event)">
          <div class="yayaw-gallery-media" :data-ratio="aspectRatio" :style="{ aspectRatio: galleryAspectRatio(aspectRatio, previewSize) }">
            <CustomContent v-if="context.config.table.gallery?.renderMedia" :node="context.config.table.gallery.renderMedia(mediaContext(row))" />
            <GalleryMedia v-else-if="context.config.table.gallery?.media?.enabled" :source="resolveGalleryMedia(row, context.config.table.gallery.media, imageColumn)" :title="mediaContext(row).title" :fit="imageFit" :hover-preview="context.config.table.gallery.media.hoverPreview" :preview-label="labels.preview" @open="openPreview(row, $event)" />
            <img v-else-if="imageFor(row)" :src="imageFor(row)" :alt="titleText(row)" loading="lazy" :style="{ objectFit: imageFit }" />
            <span v-else class="yayaw-gallery-placeholder"><ImageIcon :size="24" aria-hidden="true" /><span>{{ initialFor(row) }}</span></span>
            <span v-if="context.config.table.enableRowSelection" class="yayaw-card-select" @click.capture="checkboxShift = $event.shiftKey" @click.stop><TableCheckbox :label="translate('selectRow', 'Select') + ' ' + titleText(row)" :model-value="Boolean(context.selection.value[context.getRowId(row)])" :disabled="context.config.table.canSelectRow?.(row) === false" @update:model-value="toggleSelection(row, $event, checkboxShift); checkboxShift = false" /></span>
          </div>
          <div class="yayaw-gallery-body">
            <div class="yayaw-card-header"><strong>{{ displayCellValue(value(row, titleColumn), column(titleColumn) ?? { id: titleColumn, header: titleColumn }, context.locale) }}</strong><RowActions :row="row" /></div>
            <CustomContent v-if="context.config.table.gallery?.renderProperties" :node="context.config.table.gallery.renderProperties(mediaContext(row))" />
            <dl v-else class="yayaw-card-properties" :class="{ labeled: showLabels }">
              <template v-for="id in propertyIds.filter((item) => ![titleColumn, imageColumn].includes(item))" :key="id"><dt v-if="showLabels">{{ column(id)?.header ?? id }}</dt><dd :data-type="column(id)?.type"><CellRenderer :value="value(row, id)" :row="row" :column="column(id) ?? { id, header: id }" /></dd></template>
            </dl>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
