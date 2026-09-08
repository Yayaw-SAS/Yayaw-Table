"use client";

import { useRef, useState } from "react";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import type { FormBlock } from "../src/components/ui/yayaw-table/components/forms/types";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";
import { productFormBlocks } from "./form-layout";

const blocks: FormBlock[] = productFormBlocks();
const identity = blocks.find((block) => block.type === "section");
if (identity?.type === "section") {
  identity.blocks = identity.blocks.map((block) =>
    block.type === "custom"
      ? {
          ...block,
          render: ({ values }) => (
            <output>
              Preview: {String(values?.name || "Untitled")} ·{" "}
              {String(values?.price ?? 0)} €
            </output>
          ),
        }
      : block
  );
}
const config = defineTableConfig({
  id: "form-layout",
  columns: {
    definitions: [
      { id: "name", header: "Name", type: "text" },
      { id: "price", header: "Price", type: "number" },
      { id: "description", header: "Description", type: "text" },
    ],
    visible: ["name", "price", "description"],
    order: ["name", "price", "description"],
    mandatory: [],
  },
  table: { syncUrl: false, defaultPageSize: 10 },
  form: { blocks, layout: { mode: "modal", width: "960px" } },
  translations: {
    namespace: "form-layout",
    keys: { title: "Structured generated forms" },
  },
});

/** Mount inside the application's NuqsAdapter and QueryClientProvider. */
export function FormLayoutExample() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([
    { id: "1", name: "Product", price: 29, description: "A generated form" },
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
    <DataTable
      getTableActions={() => actions}
      getTableConfig={() => config}
      initialData={rows}
      initialPageCount={1}
      initialRowCount={rows.length}
      tableType={config.id}
    />
  );
}
