<script setup lang="ts">
import { DataTable, defineTableConfig, type TableActions, type TableRecord } from "../src";
import { Toaster } from "vue-sonner";
import { calendarRenderer } from "../src/calendar/calendar-renderer";
import { chartRenderer } from "../src/chart/chart-renderer";
import { mapRenderer } from "../src/map/map-renderer";
import { chartViews, createViewsActions, initialViewsRows, updatesFeedView, mapViews, viewsColumns, viewsTableOptions, viewsVisibleColumns } from "../../../examples/views";
import { guidedRequestFormView, requestFormView } from "../../../examples/form-links";

// Without `aggregate`, charts are computed over the rows the list action returns.
const props = withDefaults(defineProps<{ aggregate?: boolean }>(), { aggregate: true });
const rows: TableRecord[] = initialViewsRows();
const actions = createViewsActions({ aggregate: props.aggregate }) as unknown as TableActions;
const config = defineTableConfig({
  id: "views",
  columns: {
    definitions: viewsColumns,
    order: viewsColumns.map(column => column.id),
    visible: viewsVisibleColumns,
    mandatory: ["name"],
  },
  table: viewsTableOptions,
  translations: { namespace: "views", keys: { title: "Projects" } },
});
</script>
<template>
  <main class="views-example">
    <h1>Views</h1>
    <DataTable :table-type="config.id" :config="config" :data="rows" :get-table-actions="() => actions" :display-mode-renderers="{ calendar: calendarRenderer, chart: chartRenderer, map: mapRenderer }" :initial-views="[requestFormView, guidedRequestFormView, ...chartViews, updatesFeedView, ...mapViews]" />
    <Toaster position="bottom-right" />
  </main>
</template>
<style>
/* Same page as the React preview, so the two editions compare on equal terms. */
body:has(.views-example) {
  background: #fff;
  color: oklch(0.145 0 0);
  font-family: system-ui, sans-serif;
}
</style>
<style scoped>
.views-example { box-sizing: border-box; max-width: 80rem; margin: auto; padding: 1.5rem; display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
.views-example h1 { font-size: 1.5rem; line-height: 2rem; font-weight: 600; margin: 0; }
</style>
