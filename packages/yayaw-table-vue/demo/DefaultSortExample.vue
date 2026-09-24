<script setup lang="ts">
import { DataTable, defineTableConfig } from "../src";
import type { TableListParams, TableRecord } from "../src/types";
import {
  defaultSortConfig,
  initialRestockPage,
  listRestockRows,
  listRestockRowsLater,
  withoutDefaultSort,
} from "../../../examples/default-sort";

// `?example=default-sort`: the default order, as in the React demo.
const config = defineTableConfig(defaultSortConfig(!withoutDefaultSort()));
// `&initial=…`: the host's first page shows while the list answers.
const firstPage = initialRestockPage();
const list = firstPage ? listRestockRowsLater : listRestockRows;
const actions = {
  list: (params: TableListParams) => list({ ...params }),
  update: () => Promise.resolve({ success: true }),
};
</script>

<template>
  <DataTable
    :config="config"
    :table-type="config.id"
    :get-row-id="(row: TableRecord) => String(row.id)"
    :get-table-actions="() => actions"
    :initial-data="firstPage?.initialData"
    :initial-data-sort="firstPage?.initialDataSort"
    :initial-page-count="firstPage?.initialPageCount"
    :initial-row-count="firstPage?.initialRowCount"
  />
</template>
