<script setup lang="ts">
import { Toaster } from "vue-sonner";
import { DataTable, defineTableConfig, type TableActions } from "../src";
import {
  createProductActions,
  productColumns,
  productTableOptions,
  productVisibleColumns,
} from "../../../examples/products";

/** A catalogue browsed with the facet panel: category and tags, counted by `aggregate`. */
const actions = createProductActions() as unknown as TableActions;
const config = defineTableConfig({
  id: "products",
  columns: {
    definitions: productColumns,
    order: productColumns.map((column) => column.id),
    visible: productVisibleColumns,
    mandatory: ["name"],
  },
  table: productTableOptions,
  translations: { namespace: "products", keys: { title: "Products" } },
});
</script>
<template>
  <main class="products-example">
    <h1>Products</h1>
    <DataTable :table-type="config.id" :config="config" :get-table-actions="() => actions" :get-row-id="(row) => String(row.id)" />
    <Toaster position="bottom-right" />
  </main>
</template>
<style>
/* Same page as the React preview, so the two editions compare on equal terms. */
body:has(.products-example) {
  margin: 0;
  background: var(--yayaw-background);
  color: var(--yayaw-foreground);
  font-family: system-ui, sans-serif;
}
</style>
<style scoped>
.products-example { box-sizing: border-box; max-width: 80rem; margin: auto; padding: 1.5rem; display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
.products-example h1 { font-size: 1.5rem; line-height: 2rem; font-weight: 600; margin: 0; }
</style>
