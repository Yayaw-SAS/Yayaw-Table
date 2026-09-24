"use client";

import { useMemo } from "react";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";
import type { TableView } from "../src/components/ui/yayaw-table/types/view-types";
import { calendarRenderer } from "../src/components/ui/yayaw-table-calendar/calendar-renderer";
import { chartRenderer } from "../src/components/ui/yayaw-table-chart/chart-renderer";
import {
  type DashboardTableSource,
  YayawDashboard,
} from "../src/components/ui/yayaw-table-dashboard/yayaw-dashboard";
import { createDemoDashboardStorage } from "./dashboard";
import {
  createFormatActions,
  formatColumns,
  formatRows,
  formatsDashboard,
  formatsLocale,
  formatTableOptions,
  formatViews,
  formatVisibleColumns,
} from "./value-formats";

const renderers = { calendar: calendarRenderer, chart: chartRenderer };

const formatsConfig = () =>
  defineTableConfig({
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

/**
 * The format matrix: each field's format applies in every view, the record
 * view, footers and exports. `&locale=fr` shows the same page in French.
 */
export function ValueFormatsExample() {
  const locale = formatsLocale(window.location.search);
  const config = useMemo(formatsConfig, []);
  const actions = useMemo(
    () => createFormatActions() as unknown as TableActions,
    []
  );
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <h1 className="font-semibold text-2xl">Formats</h1>
      <DataTable
        displayModeRenderers={renderers}
        getRowId={(row) => String(row.id)}
        getTableActions={() => actions}
        getTableConfig={() => config}
        initialData={formatRows}
        initialPageCount={1}
        initialRowCount={formatRows.length}
        initialViews={formatViews as unknown as TableView[]}
        locale={locale}
        tableType={config.id}
      />
    </main>
  );
}

/** The matrix's numbers on a dashboard: KPIs and a date filter chip. */
export function ValueFormatsDashboardExample() {
  const locale = formatsLocale(window.location.search);
  const tables = useMemo<Record<string, DashboardTableSource>>(
    () => ({
      formats: {
        name: "Formats",
        config: formatsConfig(),
        actions: createFormatActions() as unknown as TableActions,
        views: formatViews as unknown as TableView[],
      },
    }),
    []
  );
  const storage = useMemo(
    () => createDemoDashboardStorage([formatsDashboard]),
    []
  );
  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <YayawDashboard
          actions={{ dashboards: storage }}
          dashboardId={formatsDashboard.id}
          displayModeRenderers={renderers}
          getRowId={(row) => String(row.id)}
          locale={locale}
          tables={tables}
        />
      </div>
    </main>
  );
}
