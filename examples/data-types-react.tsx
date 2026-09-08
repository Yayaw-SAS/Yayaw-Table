"use client";

import { useRef, useState } from "react";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";
import { dataTypeColumns, dataTypeRow } from "./data-types";

const config = defineTableConfig({
  id: "data-types",
  columns: {
    definitions: dataTypeColumns,
    visible: dataTypeColumns.map((column) => column.id),
    order: dataTypeColumns.map((column) => column.id),
    mandatory: [],
  },
  table: {
    allowInlineEdit: true,
    inlineEdit: { enabled: true },
    allowCreate: true,
    allowEdit: true,
    syncUrl: false,
  },
  translations: {
    namespace: "data-types",
    keys: {
      title: "Declare each type once",
      description:
        "Cells, inline editing, filters and generated forms share the same declaration.",
    },
  },
});

/** Mount inside the application's NuqsAdapter. No form catalogue is needed. */
export function DataTypesExample() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([
    { ...dataTypeRow },
  ]);
  const current = useRef(rows);
  current.current = rows;
  const actions: TableActions = {
    list: async () => ({
      data: current.current,
      meta: { pageCount: 1, totalCount: current.current.length },
    }),
    create: (values) => {
      current.current = [
        ...current.current,
        { ...values, id: crypto.randomUUID() },
      ];
      setRows(current.current);
      return Promise.resolve({ success: true });
    },
    update: (id, values) => {
      current.current = current.current.map((row) =>
        row.id === id ? { ...row, ...values } : row
      );
      setRows(current.current);
      return Promise.resolve({ success: true });
    },
  };
  return (
    <section>
      <DataTable
        getTableActions={() => actions}
        getTableConfig={() => config}
        initialData={rows}
        initialPageCount={1}
        initialRowCount={rows.length}
        tableType="data-types"
      />
      <pre>{JSON.stringify(rows, null, 2)}</pre>
    </section>
  );
}
