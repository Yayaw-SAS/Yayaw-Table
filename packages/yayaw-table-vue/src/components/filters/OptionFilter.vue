<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronDown, Filter } from "lucide-vue-next";
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui";
import { useTableContext, useTableTranslation } from "../../context";
import { filterBarOptions, filterValueKey, filterValues, replaceColumnFilter } from "../../filter-bar";
import type { ColumnDefinition } from "../../types";

const props = defineProps<{ column: ColumnDefinition }>();
const context = useTableContext();
const translate = useTableTranslation();
const search = ref("");
const value = computed(() => context.state.filters.value.find(filter => filter.id === props.column.id)?.value);
const selected = computed(() => filterValues(value.value));
const options = computed(() => filterBarOptions(props.column, value.value, {
  yes: translate("common.true", "True"), no: translate("common.false", "False"),
}));
const visibleOptions = computed(() => options.value.filter(option => option.label.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())));
const update = (values: unknown[]): void => {
  context.state.filters.value = replaceColumnFilter(context.state.filters.value, props.column.id, values);
};
const checked = (candidate: unknown): boolean => selected.value.some(item => filterValueKey(item) === filterValueKey(candidate));
const toggle = (candidate: unknown): void => update(checked(candidate)
  ? selected.value.filter(item => filterValueKey(item) !== filterValueKey(candidate))
  : [...selected.value, candidate]);
</script>

<template>
  <PopoverRoot @update:open="search = ''">
    <PopoverTrigger as-child>
      <button type="button" class="yayaw-button yayaw-button-outline yayaw-filter-trigger" :aria-label="column.header">
        <Filter :size="16" aria-hidden="true" />
        <span>{{ column.header }}</span>
        <span v-if="selected.length" class="yayaw-filter-count">{{ selected.length }}</span>
        <ChevronDown :size="14" aria-hidden="true" />
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent class="yayaw-filter-picker" :data-yayaw-filter-picker="context.config.id" :aria-label="column.header" align="start" :side-offset="4" :collision-padding="8">
        <p class="yayaw-filter-heading">{{ column.header }}</p>
        <input v-model="search" type="search" class="yayaw-input" :aria-label="translate('searchOptions', 'Search options…')" :placeholder="translate('searchOptions', 'Search options…')" autocomplete="off" />
        <div class="yayaw-filter-choices" role="group" :aria-label="column.header">
          <label v-for="option in visibleOptions" :key="filterValueKey(option.value)" class="yayaw-filter-choice">
            <input type="checkbox" :checked="checked(option.value)" :disabled="option.disabled" @change="toggle(option.value)" />
            <span>{{ option.label }}</span>
          </label>
          <p v-if="!visibleOptions.length" class="yayaw-help" role="status">{{ translate('noResults', 'No results') }}</p>
        </div>
        <button type="button" class="yayaw-button yayaw-button-outline" :disabled="!selected.length" @click="update([])">{{ translate('clearFilters', 'Clear filters') }}</button>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
