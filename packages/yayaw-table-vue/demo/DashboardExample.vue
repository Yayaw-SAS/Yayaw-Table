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
  createProjectActions,
  createTaskActions,
  dashboardProjectViews,
  dashboardTaskViews,
  logDashboardRequests,
  projectColumns,
  projectTableOptions,
  projectVisibleColumns,
  taskColumns,
  taskTableOptions,
} from "../../../examples/dashboard";

// "Projects overview": numbers, charts and lists of two tables on a
// dashboard with filters, without a scrollbar. `?readonly` shows it without
// edit rights, `?lang=fr` in French (the table labels are built in).
const search = new URLSearchParams(window.location.search);
const canEdit = !search.has("readonly");
const locale = search.get("lang") === "fr" ? "fr" : "en";
const tables: Record<string, DashboardTableSource> = {
  projects: {
    name: "Projects",
    config: defineTableConfig({
      id: "projects",
      columns: {
        definitions: projectColumns,
        order: projectColumns.map((column) => column.id),
        visible: projectVisibleColumns,
        mandatory: ["name"],
      },
      table: projectTableOptions,
      translations: { namespace: "projects", keys: { title: "Projects" } },
    }),
    actions: logDashboardRequests("projects", createProjectActions()) as unknown as TableActions,
    views: dashboardProjectViews() as unknown as TableView[],
  },
  tasks: {
    name: "Tasks",
    config: defineTableConfig({
      id: "tasks",
      columns: {
        definitions: taskColumns,
        order: taskColumns.map((column) => column.id),
        visible: taskColumns.map((column) => column.id),
        mandatory: ["title"],
      },
      table: taskTableOptions,
      translations: { namespace: "tasks", keys: { title: "Tasks" } },
    }),
    actions: logDashboardRequests("tasks", createTaskActions()) as unknown as TableActions,
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
        :locale="locale"
      />
      <output v-if="opened" class="dashboard-example-opened" data-dashboard-opened="">{{ opened }}</output>
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
.dashboard-example { box-sizing: border-box; min-height: 100vh; padding: 1rem 1.5rem; }
.dashboard-example-inner { max-width: 80rem; margin: auto; }
.dashboard-example-opened {
  position: fixed;
  bottom: 1rem;
  left: 1rem;
  border: 1px solid var(--yayaw-border);
  border-radius: var(--yayaw-radius);
  background: var(--yayaw-background);
  padding: 0.5rem 0.75rem;
  color: var(--yayaw-muted-foreground);
  font-size: 14px;
  box-shadow: var(--yayaw-shadow-xs);
}
@media (max-width: 639px) { .dashboard-example { padding: 1rem; } }
</style>
