<script setup lang="ts">
import { ref } from "vue";
import { DataTable, defineTableConfig } from "../src";
import { exampleServerKanban } from "../../../examples/server-kanban";
const opened = ref("");
const config = defineTableConfig({ id: "server-board-demo", columns: { definitions: [{ id: "name", header: "Name", type: "text" }, { id: "owner", header: "Owner", type: "text" }, { id: "stage", header: "Stage", type: "text", enableGrouping: true }], order: ["name", "owner", "stage"], visible: ["name", "owner"], mandatory: [] }, table: { syncUrl: false, defaultDisplayMode: "kanban", displayModes: ["kanban"], allowCreate: false, allowEdit: false, allowDelete: false, enableRowSelection: false, kanban: { groupBy: "stage", titleColumn: "name", cardColumnIds: ["owner"], server: exampleServerKanban(row => { opened.value = String(row.name); }) } }, translations: { namespace: "demo", keys: { title: "Server Kanban" } } });
</script>
<template><main><h1>Server Kanban · Vue</h1><p>Five records, independent pages, an empty lane and a recoverable error.</p><output>{{ opened }}</output><DataTable :config="config" :table-type="config.id" :data="[]" /></main></template>
