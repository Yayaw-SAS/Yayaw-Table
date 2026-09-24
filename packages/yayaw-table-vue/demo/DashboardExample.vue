<script setup lang="ts">
import { ref } from "vue";
import { Toaster } from "vue-sonner";
import { defineTableConfig, type TableActions, type TableView } from "../src";
import { calendarRenderer } from "../src/calendar/calendar-renderer";
import { chartRenderer } from "../src/chart/chart-renderer";
import type { DashboardTableSource } from "../src/dashboard/dashboard-types";
import YayawDashboard from "../src/dashboard/YayawDashboard.vue";
import {
  createDemoDashboardStorage,
  createTasksActions,
  dashboardProjectViews,
  dashboardTaskViews,
  logDashboardRequests,
  tasksColumns,
  tasksTableOptions,
} from "../../../examples/dashboard";
import { createViewsActions, viewsColumns, viewsTableOptions, viewsVisibleColumns } from "../../../examples/views";

// "Projects overview": saved views of two tables, numbers and a note on a
// dashboard with filters. `?readonly` shows it without edit rights.
const canEdit = !new URLSearchParams(window.location.search).has("readonly");
const tables: Record<string, DashboardTableSource> = {
  views: {
    name: "Projects",
    config: defineTableConfig({
      id: "views",
      columns: {
        definitions: viewsColumns,
        order: viewsColumns.map((column) => column.id),
        visible: viewsVisibleColumns,
        mandatory: ["name"],
      },
      table: viewsTableOptions,
      translations: { namespace: "views", keys: { title: "Projects" } },
    }),
    actions: logDashboardRequests("views", createViewsActions()) as unknown as TableActions,
    views: dashboardProjectViews as unknown as TableView[],
  },
  tasks: {
    name: "Tasks",
    config: defineTableConfig({
      id: "tasks",
      columns: {
        definitions: tasksColumns,
        order: tasksColumns.map((column) => column.id),
        visible: tasksColumns.map((column) => column.id),
        mandatory: ["title"],
      },
      table: tasksTableOptions,
      translations: { namespace: "tasks", keys: { title: "Tasks" } },
    }),
    actions: logDashboardRequests("tasks", createTasksActions()) as unknown as TableActions,
    views: dashboardTaskViews as unknown as TableView[],
  },
};
const storage = createDemoDashboardStorage();
const renderers = { calendar: calendarRenderer, chart: chartRenderer };
const opened = ref("");
const openView = (tableId: string, viewId: string | null) => {
  opened.value = `${tableId} › ${viewId ?? "default"}`;
};
</script>

<template>
  <main class="dashboard-example">
    <div class="dashboard-example-inner">
      <YayawDashboard
        :actions="{ dashboards: storage }"
        :tables="tables"
        :can-edit="canEdit"
        :display-mode-renderers="renderers"
        :open-view="openView"
        :get-row-id="(row) => String(row.id)"
      />
      <output class="dashboard-example-opened" data-dashboard-opened="">{{ opened }}</output>
    </div>
    <Toaster position="bottom-right" />
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
.dashboard-example-opened { display: block; color: var(--yayaw-muted-foreground); font-size: 14px; min-height: 1.25rem; }
@media (max-width: 639px) { .dashboard-example { padding: 1rem; } }
</style>
