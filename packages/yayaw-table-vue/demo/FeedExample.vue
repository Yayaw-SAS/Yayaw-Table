<script setup lang="ts">
import { Toaster } from "vue-sonner";
import { DataTable, defineTableConfig, type TableActions, type TableRecord } from "../src";
import { createFeedActions, feedExampleConfig } from "../../../examples/feed";

// `?example=feed`: 120 posts loaded as you scroll, as in the React demo.
const config = defineTableConfig(feedExampleConfig());
const actions = createFeedActions() as unknown as TableActions;
</script>

<template>
  <main class="feed-example">
    <h1>Feed</h1>
    <DataTable
      :table-type="config.id"
      :config="config"
      :get-row-id="(row: TableRecord) => String(row.id)"
      :get-table-actions="() => actions"
    />
    <Toaster position="bottom-right" />
  </main>
</template>

<style>
/* Same page as the React preview, so the two editions compare on equal terms. */
body:has(.feed-example) {
  background: #fff;
  color: oklch(0.145 0 0);
  font-family: system-ui, sans-serif;
}
</style>
<style scoped>
.feed-example { box-sizing: border-box; max-width: 80rem; margin: auto; padding: 1.5rem; display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
.feed-example h1 { font-size: 1.5rem; line-height: 2rem; font-weight: 600; margin: 0; }
</style>
