<script setup lang="ts">
import { defineTableConfig, type TableActions, type TableView } from "../src";
import { calendarRenderer } from "../src/calendar/calendar-renderer";
import { chartRenderer } from "../src/chart/chart-renderer";
import type { DashboardTableSource } from "../src/dashboard/dashboard-types";
import YayawDashboard from "../src/dashboard/YayawDashboard.vue";
import { createDemoDashboardStorage } from "../../../examples/dashboard";
import {
  createFormatActions,
  formatColumns,
  formatsDashboard,
  formatsLocale,
  formatTableOptions,
  formatViews,
  formatVisibleColumns,
} from "../../../examples/value-formats";

// The matrix's numbers on a dashboard: KPIs and a date filter chip.
const locale = formatsLocale(window.location.search);
const tables: Record<string, DashboardTableSource> = {
  formats: {
    name: "Formats",
    config: defineTableConfig({
      id: "formats",
      columns: {
        definitions: formatColumns,
        order: formatColumns.map((column) => column.id),
        visible: formatVisibleColumns,
        mandatory: ["name"],
      },
      table: formatTableOptions,
      translations: { namespace: "formats", keys: { title: "Formats" } },
    }),
    actions: createFormatActions() as unknown as TableActions,
    views: formatViews as unknown as TableView[],
  },
};
const storage = createDemoDashboardStorage([formatsDashboard]);
const renderers = { calendar: calendarRenderer, chart: chartRenderer };
</script>

<template>
  <main class="dashboard-example">
    <div class="dashboard-example-inner">
      <YayawDashboard
        :actions="{ dashboards: storage }"
        :tables="tables"
        :dashboard-id="formatsDashboard.id"
        :display-mode-renderers="renderers"
        :locale="locale"
        :get-row-id="(row) => String(row.id)"
      />
    </div>
  </main>
</template>

<style>
/* Same page as the React preview, so the two editions compare on equal terms. */
body:has(.dashboard-example) {
  margin: 0;
  background: var(--yayaw-background);
  color: var(--yayaw-foreground);
  font-family: system-ui, sans-serif;
}
</style>
<style scoped>
.dashboard-example { box-sizing: border-box; min-height: 100vh; padding: 1.5rem; }
.dashboard-example-inner { max-width: 80rem; margin: auto; display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; }
</style>
