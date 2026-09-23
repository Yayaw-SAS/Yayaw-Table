"use client";

import { useMemo } from "react";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";
import { calendarRenderer } from "../src/components/ui/yayaw-table-calendar/calendar-renderer";
import {
  createViewsActions,
  viewsColumns,
  viewsRows,
  viewsTableOptions,
} from "./views";

/** Switch display modes and save views; the state lives in the URL. */
export function ViewsExample() {
  const config = useMemo(
    () =>
      defineTableConfig({
        id: "views",
        columns: {
          definitions: viewsColumns,
          order: viewsColumns.map((column) => column.id),
          visible: viewsColumns.map((column) => column.id),
          mandatory: ["name"],
        },
        table: viewsTableOptions,
        translations: { namespace: "views", keys: { title: "Projects" } },
      }),
    []
  );
  const actions = useMemo<TableActions>(() => createViewsActions(), []);
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="font-semibold text-2xl">Views</h1>
      <DataTable
        displayModeRenderers={{ calendar: calendarRenderer }}
        getRowId={(row) => String(row.id)}
        getTableActions={() => actions}
        getTableConfig={() => config}
        initialData={viewsRows}
        initialPageCount={1}
        initialRowCount={viewsRows.length}
        tableType={config.id}
      />
    </main>
  );
}
