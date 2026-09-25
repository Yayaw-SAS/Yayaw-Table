"use client";

import { useMemo } from "react";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";
import {
  createProductActions,
  productColumns,
  productTableOptions,
  productVisibleColumns,
} from "./products";

/** A catalogue browsed with the facet panel: category and tags, counted by `aggregate`. */
export function ProductsExample() {
  const config = useMemo(
    () =>
      defineTableConfig({
        id: "products",
        columns: {
          definitions: productColumns,
          order: productColumns.map((column) => column.id),
          visible: productVisibleColumns,
          mandatory: ["name"],
        },
        table: productTableOptions,
        translations: { namespace: "products", keys: { title: "Products" } },
      }),
    []
  );
  const actions = useMemo(
    () => createProductActions() as unknown as TableActions,
    []
  );
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <h1 className="font-semibold text-2xl">Products</h1>
      <DataTable
        getRowId={(row) => String(row.id)}
        getTableActions={() => actions}
        getTableConfig={() => config}
        tableType={config.id}
      />
    </main>
  );
}
