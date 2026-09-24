"use client";

import { useMemo, useState } from "react";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import {
  defaultTranslations,
  type TableActions,
} from "../src/components/ui/yayaw-table/providers/table-provider";
import type { DataTableTranslations } from "../src/components/ui/yayaw-table/types/translations";
import type { TableView } from "../src/components/ui/yayaw-table/types/view-types";
import { calendarRenderer } from "../src/components/ui/yayaw-table-calendar/calendar-renderer";
import { chartRenderer } from "../src/components/ui/yayaw-table-chart/chart-renderer";
import {
  type DashboardTableSource,
  YayawDashboard,
} from "../src/components/ui/yayaw-table-dashboard/yayaw-dashboard";
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
} from "./dashboard";

const renderers = { calendar: calendarRenderer, chart: chartRenderer };

/**
 * `?lang=fr`: the page's French table labels, which the dashboard passes to
 * every widget (only the pagination here, the rest stays in English).
 */
const frenchTableTranslations: DataTableTranslations = {
  ...defaultTranslations,
  pagination: {
    ...defaultTranslations.pagination,
    rowsPerPage: "Lignes par page",
    showing: "Page {page} sur {total}",
  },
};

/**
 * "Projects overview": numbers, charts and lists of two tables on a
 * dashboard with filters, without a scrollbar. `?readonly` shows it without
 * edit rights, `?lang=fr` in French.
 */
export function DashboardExample() {
  const search = new URLSearchParams(window.location.search);
  const canEdit = !search.has("readonly");
  const french = search.get("lang") === "fr";
  const tables = useMemo<Record<string, DashboardTableSource>>(
    () => ({
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
        actions: logDashboardRequests(
          "projects",
          createProjectActions()
        ) as unknown as TableActions,
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
        actions: logDashboardRequests(
          "tasks",
          createTaskActions()
        ) as unknown as TableActions,
        views: dashboardTaskViews as unknown as TableView[],
      },
    }),
    []
  );
  const storage = useMemo(() => createDemoDashboardStorage(), []);
  const [opened, setOpened] = useState("");
  return (
    <main className="min-h-screen bg-background px-4 py-4 text-foreground sm:px-6">
      <div className="mx-auto max-w-7xl">
        <YayawDashboard
          actions={{ dashboards: storage }}
          canEdit={canEdit}
          displayModeRenderers={renderers}
          getRowId={(row) => String(row.id)}
          locale={french ? "fr" : "en"}
          openView={(tableId, viewId) =>
            setOpened(`${tableId} › ${viewId ?? "default"}`)
          }
          tables={tables}
          tableTranslations={french ? frenchTableTranslations : undefined}
        />
        {opened ? (
          <output
            className="fixed bottom-4 left-4 rounded-md border bg-background px-3 py-2 text-muted-foreground text-sm shadow-sm"
            data-dashboard-opened=""
          >
            {opened}
          </output>
        ) : null}
      </div>
    </main>
  );
}
