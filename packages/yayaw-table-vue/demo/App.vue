<script setup lang="ts">
import { ref } from "vue";
import { Archive } from "lucide-vue-next";
import { Toaster } from "vue-sonner";
import "vue-sonner/style.css";
import { productFormBlocks } from "../../../examples/form-layout";
import { dataTypeColumns, dataTypeRow } from "../../../examples/data-types";
import { z } from "zod";
import {
  DataTable,
  defineFormConfig,
  defineTableConfig,
  type FormConfig,
  type TableActions,
  type TableConfig,
  type TableRecord,
  type ToolbarActionsInput,
} from "../src";

interface Product extends TableRecord {
  id: string;
  name: string;
  category: string;
  tags: string[];
  price: number;
  status: string;
  active: boolean;
  imageUrl: string;
  createdAt: string;
}

const seed: Product[] = Array.from({ length: 34 }, (_, index) => ({
  id: `product-${index + 1}`,
  name: `Product ${index + 1}`,
  category: ["Hardware", "Software", "Service"][index % 3] ?? "Hardware",
  tags: index % 2 ? ["Popular"] : ["Featured", "New"],
  price: 29 + index * 7.5,
  status: ["In Stock", "Low Stock", "Out of Stock"][index % 3] ?? "In Stock",
  active: index % 4 !== 0,
  imageUrl: `https://picsum.photos/seed/yayaw-${index}/640/480`,
  createdAt: new Date(2026, index % 8, (index % 27) + 1).toISOString(),
}));
const products = ref<Product[]>(seed);
const activity = ref("Select rows to try the catalogue toolbar action.");

const config = defineTableConfig<Product>({
  id: "products",
  columns: {
    definitions: [
      {
        id: "name",
        header: "Name",
        type: "text",
        inlineEdit: true,
        enableGrouping: false,
      },
      {
        id: "category",
        header: "Category",
        type: "select",
        displayVariant: "tag",
        options: ["Hardware", "Software", "Service"].map((value) => ({
          label: value,
          value,
        })),
        inlineEdit: true,
      },
      {
        id: "price",
        header: "Price",
        type: "number",
        numberFormat: { currency: "EUR", locale: "fr-FR" },
        defaultCalculation: "sum",
        inlineEdit: true,
      },
      {
        id: "status",
        header: "Status",
        type: "select",
        displayVariant: "tag",
        options: ["In Stock", "Low Stock", "Out of Stock"].map((value) => ({
          label: value,
          value,
        })),
        inlineEdit: true,
      },
      { id: "tags", header: "Tags", type: "multiSelect", inlineEdit: true,
        options: ["Featured", "New", "Popular"].map(value => ({ label: value, value })) },
      { id: "active", header: "Active", type: "boolean", inlineEdit: true },
      { id: "imageUrl", header: "Image", type: "image", enableSorting: false },
      {
        id: "createdAt",
        header: "Created",
        type: "date",
        dateDisplayPreset: "short",
      },
    ],
    mandatory: ["name"],
    order: [
      "select",
      "name",
      "category",
      "tags",
      "price",
      "status",
      "active",
      "createdAt",
      "imageUrl",
      "actions",
    ],
    visible: ["name", "category", "tags", "price", "status", "active", "createdAt"],
    sort: [{ id: "name", desc: false }],
  },
  table: {
    filterBarColumns: ["category", "status", "tags"],
    showFilterBar: true,
    enableAutoPageSize: true,
    defaultAutoPageSize: true,
    displayModes: ["table", "kanban", "gallery"],
    defaultDisplayMode: "table",
    allowInlineEdit: true,
    enableColumnDnd: true,
    enableColumnDragDropByDefault: true,
    enableColumnResizing: true,
    inlineEdit: { enabled: true, optimistic: true },
    enableCalculations: true,
    kanban: {
      groupBy: "status",
      titleColumn: "name",
      cardColumnIds: ["category", "price", "active"],
      groups: ["In Stock", "Low Stock", "Out of Stock"].map((value) => ({
        value,
      })),
      allowDragUpdate: true,
    },
    gallery: {
      imageColumn: "imageUrl",
      titleColumn: "name",
      cardColumnIds: ["category", "price", "status"],
      aspectRatio: "video",
    },
  },
  form: {
    createFormType: "product",
    editFormType: "product",
    presentation: "drawer",
    blocks: productFormBlocks(),
  },
  translations: {
    namespace: "products",
    keys: { title: "Products", description: "Vue 3 feature-parity demo" },
  },
});

const formConfig = defineFormConfig<Product>({
  id: "product",
  title: (mode, row) =>
    mode === "create" ? "Create product" : `Edit ${row?.name ?? "product"}`,
  presentation: "drawer",
  fields: [
    {
      name: "name",
      label: "Name",
      type: "text",
      required: true,
      schema: z.string().min(2),
    },
    {
      name: "category",
      label: "Category",
      type: "select",
      required: true,
      options: ["Hardware", "Software", "Service"].map((value) => ({
        label: value,
        value,
      })),
    },
    { name: "price", label: "Price", type: "number", required: true, min: 0 },
    {
      name: "status",
      label: "Status",
      type: "radio",
      options: ["In Stock", "Low Stock", "Out of Stock"].map((value) => ({
        label: value,
        value,
      })),
    },
    { name: "tags", label: "Tags", type: "multiSelect",
      options: ["Featured", "New", "Popular"].map(value => ({ label: value, value })) },
    { name: "active", label: "Active", type: "switch" },
    { name: "imageUrl", label: "Image URL", type: "url" },
    { name: "createdAt", label: "Created", type: "date" },
  ],
  sections: [
    {
      id: "main",
      title: "Product",
      fields: ["name", "category", "tags", "price", "status"],
      columns: 2,
    },
    {
      id: "details",
      title: "Details",
      fields: ["active", "imageUrl", "createdAt"],
      columns: 2,
    },
  ],
});

const actions: TableActions<Product> = {
  create: (data) => {
    const row = { ...data, id: crypto.randomUUID() } as Product;
    products.value = [row, ...products.value];
    return { success: true, data: row };
  },
  update: (id, patch) => {
    const source = products.value.find((row) => row.id === id);
    if (!source) {
      return { success: false, error: "Product not found" };
    }
    const updated = { ...source, ...patch };
    products.value = products.value.map((row) =>
      row.id === id ? updated : row
    );
    return { success: true, data: updated };
  },
  delete: (id) => {
    products.value = products.value.filter((row) => row.id !== id);
    return { success: true };
  },
  duplicate: (id) => {
    const source = products.value.find((row) => row.id === id);
    if (!source) {
      return { success: false, error: "Product not found" };
    }
    const copy = {
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} copy`,
    };
    products.value = [copy, ...products.value];
    return { success: true, data: copy };
  },
  bulkDelete: (ids) => {
    products.value = products.value.filter((row) => !ids.includes(row.id));
    return { success: true };
  },
  bulkUpdate: (ids, patch) => {
    products.value = products.value.map((row) =>
      ids.includes(row.id) ? { ...row, ...patch } : row
    );
    return {
      success: true,
      data: products.value.filter((row) => ids.includes(row.id)),
    };
  },
  bulkCopy: (ids) => {
    const copies = products.value
      .filter((row) => ids.includes(row.id))
      .map((row) => ({
        ...row,
        id: crypto.randomUUID(),
        name: `${row.name} copy`,
      }));
    products.value = [...copies, ...products.value];
    return { success: true, data: copies };
  },
};
// Archives is an application action; the library does not implement archiving.
const toolbarActions: ToolbarActionsInput = (context) => [
  { id: "archives", label: "Archives", icon: Archive, onClick: () => { activity.value = "Archives is supplied by the application."; } },
  {
    id: "selection-summary",
    label: `Use ${context.selectedCount} selected`,
    disabled: context.selectedCount === 0,
    onClick: () => {
      activity.value = `Selected: ${context.selectedRowIds.join(", ")}`;
    },
    variant: "secondary",
  },
];
const activateProduct = (row: TableRecord): void => {
  activity.value = `Activated: ${String(row.name ?? row.id)}`;
};
// This table deliberately has no form catalogue: column types generate every standard editor.
const typeRows = ref<TableRecord[]>([{ ...dataTypeRow }]);
const typesConfig = defineTableConfig({
  id: "data-types", columns: { definitions: dataTypeColumns, visible: dataTypeColumns.map(column => column.id), order: dataTypeColumns.map(column => column.id), mandatory: [] },
  table: { allowInlineEdit: true, inlineEdit: { enabled: true }, allowCreate: true, allowEdit: true, syncUrl: false },
  translations: { namespace: "data-types", keys: { title: "Declare each type once", description: "Cells, inline editing, filters and generated forms share the same declaration." } },
});
const typesActions: TableActions = {
  create: values => { typeRows.value = [...typeRows.value, { ...values, id: crypto.randomUUID() }]; return { success: true }; },
  update: (id, values) => { typeRows.value = typeRows.value.map(row => row.id === id ? { ...row, ...values } : row); return { success: true }; },
};
</script>

<template>
  <Toaster position="bottom-right" close-button />
  <main class="demo-shell">
    <header class="demo-header">
      <p class="demo-eyebrow">YaYaw Table · Vue 3</p>
      <h1>Interactive Vue example</h1>
      <p>
        Explore the table, Kanban, gallery, forms, filters, saved views, and bulk
        actions. Column drag and drop can be changed from any column menu or from
        View → Properties, and every data column can be resized. On mobile, open the view for settings and the data actions menu for search, export and sharing.
      </p>
      <p class="demo-status" role="status">{{ activity }}</p>
    </header>
    <DataTable
      table-type="products"
      :config="config as unknown as TableConfig"
      :data="products"
      :get-table-actions="() => actions"
      :get-form-config="() => formConfig as unknown as FormConfig"
      :toolbar-actions="toolbarActions"
      toolbar-actions-placement="after-export"
      locale="en"
      @row-activate="activateProduct"
    >
      <template #form-preview="{ values }"><output>Preview: {{ values.name || "Untitled" }} · {{ values.price ?? 0 }} €</output></template>
    </DataTable>
    <section style="margin-top: 48px">
      <DataTable table-type="data-types" :config="typesConfig" :data="typeRows" :get-table-actions="() => typesActions" locale="en" />
      <pre aria-label="Saved typed values">{{ JSON.stringify(typeRows, null, 2) }}</pre>
    </section>
  </main>
</template>

<style>
body { margin: 0; background: #f7f7f8; color: #18181b; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
.demo-shell { max-width: 1500px; margin: 0 auto; padding: 40px 24px 100px; }
.demo-header { max-width: 760px; margin-bottom: 28px; }
.demo-header h1 { margin: 6px 0 10px; font-size: clamp(2rem, 5vw, 3.5rem); letter-spacing: -0.04em; line-height: 1; }
.demo-header p { margin: 0; color: #52525b; line-height: 1.6; }
.demo-eyebrow { color: #2563eb !important; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
.demo-status { margin-top: 12px !important; font-weight: 600; }
</style>
