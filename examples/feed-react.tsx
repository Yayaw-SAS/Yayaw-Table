import { useMemo } from "react";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";
import { createFeedActions, feedExampleConfig } from "./feed";

/** `?example=feed`: 120 posts loaded as you scroll, as in the Vue demo. */
export function FeedExample() {
  const config = useMemo(() => defineTableConfig(feedExampleConfig()), []);
  const actions = useMemo<TableActions>(
    () => createFeedActions() as unknown as TableActions,
    []
  );
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <h1 className="font-semibold text-2xl">Feed</h1>
      <DataTable
        getRowId={(row) => String(row.id)}
        getTableActions={() => actions}
        getTableConfig={() => config}
        tableType={config.id}
      />
    </main>
  );
}
