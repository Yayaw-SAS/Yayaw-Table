<script setup lang="ts">
import { computed } from "vue";
import { useTableContext, useTableTranslation } from "../../context";
import { filterBarColumns } from "../../filter-bar";
import OptionFilter from "./OptionFilter.vue";

const context = useTableContext();
const translate = useTableTranslation();
const columns = computed(() => filterBarColumns(context.config.columns.definitions, context.config.table.filterBarColumns));
</script>

<template>
  <div v-if="context.config.table.enableColumnFilters && columns.length" class="yayaw-filter-bar" role="group" :aria-label="translate('filters', 'Filters')">
    <OptionFilter v-for="column in columns" :key="column.id" :column="column" />
  </div>
</template>
