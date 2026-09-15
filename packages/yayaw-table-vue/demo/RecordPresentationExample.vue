<script setup lang="ts">
import { computed, ref } from "vue";
import { DataTable, defineTableConfig, type RecordPresentation, type TableActions, type TableRecord } from "../src";
import { presentationColumns, presentationForm, presentationRows } from "../../../examples/record-presentation";
const params = new URLSearchParams(window.location.search);
const desktop = ref<RecordPresentation>((params.get("desktop") as RecordPresentation) || "drawer");
const mobile = ref<RecordPresentation>((params.get("mobile") as RecordPresentation) || "drawer");
const rows = ref<TableRecord[]>(structuredClone(presentationRows));
const config = computed(() => defineTableConfig({
  id: "record-presentation", presentation: { desktop: desktop.value, mobile: mobile.value },
  columns: { definitions: presentationColumns, order: presentationColumns.map(column => column.id), visible: ["name", "category", "status", "price", "active"], mandatory: [] },
  table: { syncUrl: false, rowClickMode: "activate", displayModes: ["table", "gallery", "kanban"], kanban: { groupBy: "status" } },
  translations: { namespace: "records", keys: { title: "Products" } },
}));
const change = (next: TableRecord[]) => { rows.value = next; return Promise.resolve({ success: true }); };
const actions: TableActions = {
  create: values => change([...rows.value, { ...values, id: crypto.randomUUID() }]),
  update: (id, values) => change(rows.value.map(row => row.id === id ? { ...row, ...values } : row)),
  bulkUpdate: (ids, values) => change(rows.value.map(row => ids.includes(String(row.id)) ? { ...row, ...values } : row)),
  delete: id => change(rows.value.filter(row => row.id !== id)),
};
</script>
<template>
  <main class="record-example">
    <header><p>YaYaw Table · Vue</p><h1>Record presentation</h1><p>Open a product to view and edit it. Select multiple products to edit shared properties.</p></header>
    <div class="record-example-controls">
      <label>Desktop <select v-model="desktop" aria-label="Desktop presentation"><option value="drawer">Drawer</option><option value="modal">Modal</option><option value="inline">Inline</option></select></label>
      <label>Mobile <select v-model="mobile" aria-label="Mobile presentation"><option value="drawer">Drawer</option><option value="modal">Modal</option><option value="inline">Inline</option></select></label>
    </div>
    <DataTable :table-type="config.id" :config="config" :data="rows" :get-form-config="() => presentationForm" :get-table-actions="() => actions" :details="{ title: row => String(row.name), description: () => 'Product details', updatedAt: row => String(row.createdAt) }" />
  </main>
</template>
<style scoped>
.record-example { max-width: 72rem; margin: auto; padding: 1.5rem; display: grid; gap: 1.5rem; }
.record-example h1 { font-size: 1.5rem; font-weight: 600; margin: 0.5rem 0; }
.record-example p { margin: 0.5rem 0; font-size: 0.875rem; color: var(--muted-foreground); }
.record-example-controls { display: flex; flex-wrap: wrap; gap: 1rem; font-size: 0.875rem; }
.record-example-controls label { display: flex; align-items: center; gap: 0.5rem; }
.record-example-controls select { border: 1px solid var(--border); border-radius: var(--radius); padding: 0.5rem 0.75rem; background: var(--background); }
</style>
