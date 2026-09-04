<script setup lang="ts">
import { computed, nextTick } from "vue";
import { useTableContext } from "../../context";
import type { AdvancedFilter } from "../../types";
import FilterRule from "./FilterRule.vue";

const context = useTableContext();
const state = context.state.advancedFilters;
const columns = computed(() =>
  context.config.columns.definitions.filter(
    (column) =>
      column.enableFiltering !== false &&
      column.type !== "actions" &&
      !["actions", "select"].includes(column.id)
  )
);
const t = (key: string, fallback: string): string => {
  const value = context.translations.value[`filters.${key}`];
  return typeof value === "string" ? value : fallback;
};
const update = (filter: AdvancedFilter): void => {
  state.value = {
    ...state.value,
    filters: state.value.filters.map((item) =>
      item.id === filter.id ? filter : item
    ),
  };
};
const remove = async (id: string): Promise<void> => {
  const index = state.value.filters.findIndex((filter) => filter.id === id);
  const filters = state.value.filters.filter((filter) => filter.id !== id);
  state.value = { ...state.value, filters };
  await nextTick();
  const nextFilter = filters[Math.min(index, filters.length - 1)];
  const target = nextFilter
    ? document.getElementById(`filter-column-${nextFilter.id}`)
    : document.getElementById(`table-options-${context.config.id}`);
  target?.focus();
};
</script>

<template>
  <section class="yayaw-advanced-filters" :aria-label="t('advanced.title', 'Advanced filters')">
    <label class="yayaw-filter-join">
      <span>{{ t('match', 'Match') }}</span>
      <select class="yayaw-select" :value="state.joinOperator" :aria-label="t('combination', 'Filter combination')" @change="state = { ...state, joinOperator: ($event.target as HTMLSelectElement).value as 'and' | 'or' }">
        <option value="and">{{ t('match_all', 'all conditions') }}</option>
        <option value="or">{{ t('match_any', 'any condition') }}</option>
      </select>
    </label>
    <FilterRule v-for="filter in state.filters" :key="filter.id" :filter="filter" :columns="columns" @update="update" @remove="remove(filter.id)" />
  </section>
</template>
