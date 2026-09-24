"use client";

import { useMemo, useState } from "react";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";
import type { TableView } from "../src/components/ui/yayaw-table/types/view-types";
import { calendarRenderer } from "../src/components/ui/yayaw-table-calendar/calendar-renderer";
import { chartRenderer } from "../src/components/ui/yayaw-table-chart/chart-renderer";
import {
  type DashboardTableSource,
  YayawDashboard,
} from "../src/components/ui/yayaw-table-dashboard/yayaw-dashboard";
import {
  createDemoDashboardStorage,
  createTasksActions,
  dashboardProjectViews,
  dashboardTaskViews,
  logDashboardRequests,
  tasksColumns,
  tasksTableOptions,
} from "./dashboard";
import {
  createViewsActions,
  viewsColumns,
  viewsTableOptions,
  viewsVisibleColumns,
} from "./views";

const renderers = { calendar: calendarRenderer, chart: chartRenderer };

/**
 * "Projects overview": saved views of two tables, numbers and a note on a
 * dashboard with filters. `?readonly` shows it without edit rights.
 */
export function DashboardExample() {
  const canEdit = !new URLSearchParams(window.location.search).has("readonly");
  const tables = useMemo<Record<string, DashboardTableSource>>(
    () => ({
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
        actions: logDashboardRequests(
          "views",
          createViewsActions()
        ) as unknown as TableActions,
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
        actions: logDashboardRequests(
          "tasks",
          createTasksActions()
        ) as unknown as TableActions,
        views: dashboardTaskViews as unknown as TableView[],
      },
    }),
    []
  );
  const storage = useMemo(() => createDemoDashboardStorage(), []);
  const [opened, setOpened] = useState("");
  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <YayawDashboard
          actions={{ dashboards: storage }}
          canEdit={canEdit}
          displayModeRenderers={renderers}
          getRowId={(row) => String(row.id)}
          openView={(tableId, viewId) =>
            setOpened(`${tableId} › ${viewId ?? "default"}`)
          }
          tables={tables}
        />
        <output
          className="block text-muted-foreground text-sm"
          data-dashboard-opened=""
        >
          {opened}
        </output>
      </div>
    </main>
  );
}
