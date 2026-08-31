<script setup lang="ts">
import { ref } from "vue";
import { z } from "zod";
import {
  DataTable,
  defineFormConfig,
  defineTableConfig,
  type FormConfig,
  type TableActions,
  type TableConfig,
  type TableRecord,
} from "../src";

interface Product extends TableRecord {
  id: string;
  name: string;
  category: string;
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
  price: 29 + index * 7.5,
  status: ["In Stock", "Low Stock", "Out of Stock"][index % 3] ?? "In Stock",
  active: index % 4 !== 0,
  imageUrl: `https://picsum.photos/seed/yayaw-${index}/640/480`,
  createdAt: new Date(2026, index % 8, (index % 27) + 1).toISOString(),
}));
const products = ref<Product[]>(seed);

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
      "price",
      "status",
      "active",
      "createdAt",
      "imageUrl",
      "actions",
    ],
    visible: ["name", "category", "price", "status", "active", "createdAt"],
    sort: [{ id: "name", desc: false }],
  },
  table: {
    displayModes: ["table", "kanban", "gallery"],
    defaultDisplayMode: "table",
    allowInlineEdit: true,
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
    { name: "active", label: "Active", type: "switch" },
    { name: "imageUrl", label: "Image URL", type: "url" },
    { name: "createdAt", label: "Created", type: "date" },
  ],
  sections: [
    {
      id: "main",
      title: "Product",
      fields: ["name", "category", "price", "status"],
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
</script>

<template>
  <main class="demo-shell">
    <h1 class="yayaw-sr-only">YaYaw Table Vue demo</h1>
    <DataTable
      table-type="products"
      :config="config as unknown as TableConfig"
      :data="products"
      :get-table-actions="() => actions"
      :get-form-config="() => formConfig as unknown as FormConfig"
      locale="en"
      @row-activate="(row) => console.info('Activated', row.id)"
    />
  </main>
</template>

<style>
body { margin: 0; background: #f7f7f8; color: #18181b; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
.demo-shell { max-width: 1500px; margin: 0 auto; padding: 40px 24px 100px; }
</style>
