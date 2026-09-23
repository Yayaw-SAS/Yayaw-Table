<script setup lang="ts">
import { DataTable, defineTableConfig, type TableActions, type TableRecord } from "../src";
import { createViewsActions, viewsColumns, viewsRows, viewsTableOptions } from "../../../examples/views";

const rows: TableRecord[] = viewsRows;
const actions = createViewsActions() as unknown as TableActions;
const config = defineTableConfig({
  id: "views",
  columns: {
    definitions: viewsColumns,
    order: viewsColumns.map(column => column.id),
    visible: viewsColumns.map(column => column.id),
    mandatory: ["name"],
  },
  table: viewsTableOptions,
  translations: { namespace: "views", keys: { title: "Projects" } },
});
</script>
<template>
  <main class="views-example">
    <h1>Views</h1>
    <DataTable :table-type="config.id" :config="config" :data="rows" :get-table-actions="() => actions" />
  </main>
</template>
<style scoped>
.views-example { max-width: 72rem; margin: auto; padding: 1.5rem; display: grid; gap: 1.5rem; }
.views-example h1 { font-size: 1.5rem; font-weight: 600; margin: 0; }
</style>
