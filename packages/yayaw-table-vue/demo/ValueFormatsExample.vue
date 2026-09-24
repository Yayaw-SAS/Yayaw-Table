<script setup lang="ts">
import { Toaster } from "vue-sonner";
import { DataTable, defineTableConfig, type TableActions, type TableRecord, type TableView } from "../src";
import { calendarRenderer } from "../src/calendar/calendar-renderer";
import { chartRenderer } from "../src/chart/chart-renderer";
import {
  createFormatActions,
  formatColumns,
  formatRows,
  formatsLocale,
  formatTableOptions,
  formatViews,
  formatVisibleColumns,
} from "../../../examples/value-formats";

// The format matrix: each field's format applies in every view, the record
// view, footers and exports. `&locale=fr` shows the same page in French.
const locale = formatsLocale(window.location.search);
const rows: TableRecord[] = formatRows.map((row) => ({ ...row }));
const actions = createFormatActions() as unknown as TableActions;
const config = defineTableConfig({
  id: "formats",
  columns: {
    definitions: formatColumns,
    order: formatColumns.map((column) => column.id),
    visible: formatVisibleColumns,
    mandatory: ["name"],
  },
  table: formatTableOptions,
  translations: { namespace: "formats", keys: { title: "Formats" } },
});
const views = formatViews as unknown as TableView[];
const renderers = { calendar: calendarRenderer, chart: chartRenderer };
</script>
<template>
  <main class="formats-example">
    <h1>Formats</h1>
    <DataTable :table-type="config.id" :config="config" :data="rows" :locale="locale" :get-table-actions="() => actions" :display-mode-renderers="renderers" :initial-views="views" />
    <Toaster position="bottom-right" />
  </main>
</template>
<style>
/* Same page as the React preview, so the two editions compare on equal terms. */
body:has(.formats-example) {
  background: #fff;
  color: oklch(0.145 0 0);
  font-family: system-ui, sans-serif;
}
</style>
<style scoped>
.formats-example { box-sizing: border-box; max-width: 80rem; margin: auto; padding: 1.5rem; display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
.formats-example h1 { font-size: 1.5rem; line-height: 2rem; font-weight: 600; margin: 0; }
</style>
