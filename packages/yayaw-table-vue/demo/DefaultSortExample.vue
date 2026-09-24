<script setup lang="ts">
import { DataTable, defineTableConfig } from "../src";
import type { TableListParams, TableRecord } from "../src/types";
import {
  defaultSortConfig,
  listRestockRows,
  withoutDefaultSort,
} from "../../../examples/default-sort";

// `?example=default-sort`: the default order, as in the React demo.
const config = defineTableConfig(defaultSortConfig(!withoutDefaultSort()));
const actions = {
  list: (params: TableListParams) => listRestockRows({ ...params }),
  update: () => Promise.resolve({ success: true }),
};
</script>

<template>
  <DataTable
    :config="config"
    :table-type="config.id"
    :get-row-id="(row: TableRecord) => String(row.id)"
    :get-table-actions="() => actions"
  />
</template>
