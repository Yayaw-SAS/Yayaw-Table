"use client";

import { useMemo, useState } from "react";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import {
  RecordSurface,
  RecordSurfaceHeader,
} from "../src/components/ui/yayaw-table/components/records/record-surface";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";
import {
  createProductActions,
  productColumns,
  productTableOptions,
  productVisibleColumns,
} from "./products";

/** A catalogue browsed with the facet panel: category and tags, counted by `aggregate`. */
export function ProductsExample({ depth = 0 }: { depth?: number }) {
  const [nested, setNested] = useState(false);
  const nestedTitle = depth === 0 ? "Products in drawer" : "Products in dialog";
  const config = useMemo(
    () =>
      defineTableConfig({
        id: depth === 0 ? "products" : `products-nested-${depth}`,
        columns: {
          definitions: productColumns,
          order: productColumns.map((column) => column.id),
          visible: productVisibleColumns,
          mandatory: ["name"],
        },
        table: { ...productTableOptions, syncUrl: depth === 0 },
        translations: {
          namespace: "products",
          keys: {
            title: "Products",
            description: "Browse the product catalogue.",
          },
        },
      }),
    [depth]
  );
  const actions = useMemo(
    () => createProductActions() as unknown as TableActions,
    []
  );
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      {depth === 0 && <h1 className="font-semibold text-2xl">Products</h1>}
      {depth < 2 && (
        <button
          className="rounded-md border px-3 py-2"
          onClick={() => setNested(true)}
          type="button"
        >
          {depth === 0 ? "Open table in drawer" : "Open table in dialog"}
        </button>
      )}
      <DataTable
        getRowId={(row) => String(row.id)}
        getTableActions={() => actions}
        getTableConfig={() => config}
        tableType={config.id}
      />
      {nested && (
        <RecordSurface
          onClose={() => setNested(false)}
          presentation={depth === 0 ? "drawer" : "modal"}
          title={nestedTitle}
          width="85vw"
        >
          <RecordSurfaceHeader
            closeLabel="Close"
            onClose={() => setNested(false)}
            title={nestedTitle}
          />
          <ProductsExample depth={depth + 1} />
        </RecordSurface>
      )}
    </main>
  );
}
