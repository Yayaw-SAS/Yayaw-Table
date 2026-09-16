<script setup lang="ts">
import { computed, ref } from "vue";
import { DataTable, defineTableConfig, type RecordPresentation, type TableActions, type TableRecord } from "../src";
import { presentationColumns, presentationDetails, presentationForm, presentationGallery, presentationRows } from "../../../examples/record-presentation";
import { createRecordActivity } from "../../../examples/record-activity";
const params = new URLSearchParams(window.location.search);
const desktop = ref<RecordPresentation>((params.get("desktop") as RecordPresentation) || "drawer");
const mobile = ref<RecordPresentation>((params.get("mobile") as RecordPresentation) || "drawer");
const rows = ref<TableRecord[]>(structuredClone(presentationRows));
const config = computed(() => defineTableConfig({
  id: "record-presentation", presentation: { desktop: desktop.value, mobile: mobile.value },
  columns: { definitions: presentationColumns, order: presentationColumns.map(column => column.id), visible: ["name", "category", "status", "price", "active"], mandatory: [] },
  table: { syncUrl: false, gallery: presentationGallery, coloredTags: false, defaultDisplayMode: "gallery", rowClickMode: "activate", displayModes: ["table", "gallery", "kanban"], kanban: { groupBy: "status" } },
  translations: { namespace: "records", keys: { title: "Products" } },
}));
const activity = createRecordActivity(presentationRows, next => { rows.value = next; });
const actions: TableActions = activity;
const details = { ...presentationDetails, history: activity.history, labels: { deleteDescription: "Move this demo record to the trash. Ctrl/Cmd+Z restores it." } };
</script>
<template>
  <main class="record-example">
    <header><p>YaYaw Table · Vue</p><h1>Record presentation</h1><p>Open a product to view and edit it. Select multiple products to edit shared properties. Ctrl/Cmd+A selects records; Ctrl/Cmd+Z undoes your latest change, including deletion.</p></header>
    <div class="record-example-controls">
      <label>Desktop <select v-model="desktop" aria-label="Desktop presentation"><option value="drawer">Drawer</option><option value="modal">Modal</option><option value="inline">Inline</option></select></label>
      <label>Mobile <select v-model="mobile" aria-label="Mobile presentation"><option value="drawer">Drawer</option><option value="modal">Modal</option><option value="inline">Inline</option></select></label>
    </div>
    <DataTable :table-type="config.id" :config="config" :data="rows" :get-form-config="() => presentationForm" :get-table-actions="() => actions" :details="details" :on-revert-activity="activity.revert" :translations="{ deleteRowDescription: details.labels.deleteDescription }" />
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
