"use client";

import { useMemo } from "react";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";
import { calendarRenderer } from "../src/components/ui/yayaw-table-calendar/calendar-renderer";
import { chartRenderer } from "../src/components/ui/yayaw-table-chart/chart-renderer";
import { guidedRequestFormView, requestFormView } from "./form-links";
import {
  chartViews,
  createViewsActions,
  initialViewsRows,
  updatesFeedView,
  viewsColumns,
  viewsTableOptions,
  viewsVisibleColumns,
} from "./views";

/**
 * Switch display modes and save views; the state lives in the URL. Without
 * `aggregate`, charts are computed over the rows the list action returns.
 */
export function ViewsExample({ aggregate = true }: { aggregate?: boolean }) {
  const config = useMemo(
    () =>
      defineTableConfig({
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
    []
  );
  const actions = useMemo<TableActions>(
    () => createViewsActions({ aggregate }),
    [aggregate]
  );
  const rows = useMemo(() => initialViewsRows(), []);
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <h1 className="font-semibold text-2xl">Views</h1>
      <DataTable
        displayModeRenderers={{
          calendar: calendarRenderer,
          chart: chartRenderer,
        }}
        getRowId={(row) => String(row.id)}
        getTableActions={() => actions}
        getTableConfig={() => config}
        initialData={rows}
        initialPageCount={1}
        initialRowCount={rows.length}
        initialViews={[
          requestFormView,
          guidedRequestFormView,
          ...chartViews,
          updatesFeedView,
        ]}
        tableType={config.id}
      />
    </main>
  );
}
