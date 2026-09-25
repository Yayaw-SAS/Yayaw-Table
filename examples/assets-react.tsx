"use client";

import { useMemo } from "react";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";
import {
  type AssetRequest,
  assetColumns,
  assetTableOptions,
  assetVisibleColumns,
  createAssetActions,
} from "./assets";
import type { TagRequest } from "./tags";

/** Requests the demo host received, read by the end-to-end tests. */
const requestLog = (): AssetRequest[] => {
  const host = globalThis as { __assetRequests?: AssetRequest[] };
  host.__assetRequests ??= [];
  return host.__assetRequests;
};
const tagLog = (): TagRequest[] => {
  const host = globalThis as { __assetTagRequests?: TagRequest[] };
  host.__assetTagRequests ??= [];
  return host.__assetTagRequests;
};

/**
 * Folders and media files browsed as a File tree next to a Gallery. Without
 * `scopes`, the host ignores the tree's scopes and the tree builds itself.
 */
export function AssetsExample({ scopes = true }: { scopes?: boolean }) {
  const config = useMemo(
    () =>
      defineTableConfig({
        id: "assets",
        columns: {
          definitions: assetColumns,
          order: assetColumns.map((column) => column.id),
          visible: assetVisibleColumns,
          mandatory: ["name"],
        },
        table: assetTableOptions,
        translations: { namespace: "assets", keys: { title: "Assets" } },
      }),
    []
  );
  const actions = useMemo(
    () =>
      createAssetActions({
        scopes,
        log: (request) => requestLog().push(request),
        logTags: (request) => tagLog().push(request),
      }) as unknown as TableActions,
    [scopes]
  );
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="font-semibold text-2xl">Assets</h1>
      <DataTable
        getRowId={(row) => String(row.id)}
        getTableActions={() => actions}
        getTableConfig={() => config}
        tableType={config.id}
      />
    </main>
  );
}
