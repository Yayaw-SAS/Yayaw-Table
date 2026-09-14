<script setup lang="ts">
import { DataTable, defineTableConfig } from "../src";
import { createMemoryPlanningAdapter } from "../src/planning/adapter";
import { createGanttDemoViews, demoGanttConfig, demoPlanningConfig, demoPlanningSnapshot, ganttDemoColumns, ganttDemoForm, listPlanningDemo } from "../../../examples/gantt-data";
import type { TableListParams } from "../src/types";
const adapter = createMemoryPlanningAdapter({snapshot: demoPlanningSnapshot(), config: demoPlanningConfig});
const config = defineTableConfig({
  id: "gantt-demo", columns: {definitions: ganttDemoColumns, visible: ["name", "start", "end", "status"], order: ["name", "start", "end", "status"], mandatory: ["name"]},
  table: {enableViews: true, displayModes: ["table", "gantt", "kanban", "gallery"], defaultDisplayMode: "gantt", planning: demoPlanningConfig, gantt: demoGanttConfig, kanban: {groupBy: "status", titleColumn: "name"}, gallery: {titleColumn: "name"}, allowCreate: false, allowDelete: false, allowDuplicate: false, allowEdit: true, allowInlineEdit: true, inlineEdit: {enabled: true}, rowClickMode: "default", defaultPageSize: 20},
  translations: {namespace: "gantt-demo", keys: {title: "Autumn launch", description: "Tasks and releases share one planning graph."}},
});
const actions = {views: createGanttDemoViews(), planning: adapter.actions, list: async (params: TableListParams) => listPlanningDemo(adapter.getSnapshot(), {...params})};
</script>
<template><DataTable table-type="gantt-demo" :config="config" :get-form-config="() => ganttDemoForm" :get-table-actions="() => actions" :details="{presentation: 'drawer', title: row => String(row.name)}" /></template>
