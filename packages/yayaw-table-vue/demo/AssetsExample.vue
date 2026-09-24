<script setup lang="ts">
import { DataTable, defineTableConfig, type TableActions } from "../src";
import { Toaster } from "vue-sonner";
import {
  type AssetRequest,
  assetColumns,
  assetTableOptions,
  assetVisibleColumns,
  createAssetActions,
} from "../../../examples/assets";

/**
 * Folders and media files browsed as a File tree next to a Gallery. Without
 * `scopes`, the host ignores the tree's scopes and the tree builds itself.
 */
const props = withDefaults(defineProps<{ scopes?: boolean }>(), { scopes: true });
// Requests the demo host received, read by the end-to-end tests.
const host = globalThis as { __assetRequests?: AssetRequest[] };
host.__assetRequests ??= [];
const actions = createAssetActions({
  scopes: props.scopes,
  log: (request) => host.__assetRequests?.push(request),
}) as unknown as TableActions;
const config = defineTableConfig({
  id: "assets",
  columns: {
    definitions: assetColumns,
    order: assetColumns.map((column) => column.id),
    visible: assetVisibleColumns,
    mandatory: ["name"],
  },
  table: assetTableOptions,
  translations: { namespace: "assets", keys: { title: "Assets" } },
});
</script>
<template>
  <main class="assets-example">
    <h1>Assets</h1>
    <DataTable :table-type="config.id" :config="config" :get-table-actions="() => actions" />
    <Toaster position="bottom-right" />
  </main>
</template>
<style>
/* Same page as the React preview, so the two editions compare on equal terms. */
body:has(.assets-example) {
  background: var(--yayaw-background);
  color: var(--yayaw-foreground);
  font-family: system-ui, sans-serif;
}
</style>
<style scoped>
.assets-example { box-sizing: border-box; max-width: 72rem; margin: auto; padding: 1.5rem; display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
.assets-example h1 { font-size: 1.5rem; line-height: 2rem; font-weight: 600; margin: 0; }
</style>
