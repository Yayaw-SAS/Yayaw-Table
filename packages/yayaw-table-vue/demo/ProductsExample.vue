<script setup lang="ts">
import { Toaster } from "vue-sonner";
import { ref } from "vue";
import { DataTable, defineTableConfig, type TableActions } from "../src";
import FormDialog from "../src/components/forms/FormDialog.vue";
import {
  createProductActions,
  productColumns,
  productTableOptions,
  productVisibleColumns,
} from "../../../examples/products";

/** A catalogue browsed with the facet panel: category and tags, counted by `aggregate`. */
const props = withDefaults(defineProps<{ depth?: number }>(), { depth: 0 });
const nested = ref(false);
const actions = createProductActions() as unknown as TableActions;
const config = defineTableConfig({
  id: props.depth === 0 ? "products" : `products-nested-${props.depth}`,
  columns: {
    definitions: productColumns,
    order: productColumns.map((column) => column.id),
    visible: productVisibleColumns,
    mandatory: ["name"],
  },
  table: { ...productTableOptions, syncUrl: props.depth === 0 },
  translations: { namespace: "products", keys: { title: "Products", description: "Browse the product catalogue." } },
});
</script>
<template>
  <main class="products-example">
    <h1 v-if="depth === 0">Products</h1>
    <button v-if="depth < 2" type="button" class="yayaw-button yayaw-button-outline" @click="nested = true">{{ depth === 0 ? "Open table in drawer" : "Open table in dialog" }}</button>
    <DataTable :table-type="config.id" :config="config" :get-table-actions="() => actions" :get-row-id="(row) => String(row.id)" />
    <FormDialog v-if="nested" :open="true" :title="depth === 0 ? 'Products in drawer' : 'Products in dialog'" :presentation="depth === 0 ? 'drawer' : 'modal'" width="85vw" @close="nested = false">
      <ProductsExample :depth="depth + 1" />
    </FormDialog>
    <Toaster v-if="depth === 0" position="bottom-right" />
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
.products-example > button { justify-self: start; }
</style>
