<script setup lang="ts">
import { computed } from "vue";
import { useTableContext } from "../../context";
import type {
  AdvancedFilter,
  AdvancedFilterOperator,
  ColumnDefinition,
} from "../../types";

const context = useTableContext();
const state = computed({
  get: () => context.state.advancedFilters.value,
  set: (value) => {
    context.state.advancedFilters.value = value;
  },
});

const operatorOptions: Array<{ value: AdvancedFilterOperator; label: string }> =
  [
    { value: "contains", label: "contains" },
    { value: "notContains", label: "does not contain" },
    { value: "equals", label: "is" },
    { value: "notEquals", label: "is not" },
    { value: "in", label: "is any of" },
    { value: "notIn", label: "is none of" },
    { value: "startsWith", label: "starts with" },
    { value: "endsWith", label: "ends with" },
    { value: "greaterThan", label: ">" },
    { value: "greaterThanOrEqual", label: "≥" },
    { value: "lessThan", label: "<" },
    { value: "lessThanOrEqual", label: "≤" },
    { value: "between", label: "between" },
    { value: "after", label: "is after" },
    { value: "before", label: "is before" },
    { value: "isEmpty", label: "is empty" },
    { value: "isNotEmpty", label: "is not empty" },
    { value: "isTrue", label: "is true" },
    { value: "isFalse", label: "is false" },
  ];

const columnFor = (filter: AdvancedFilter): ColumnDefinition | undefined =>
  context.config.columns.definitions.find(
    (column) => column.id === filter.columnId
  );
const noValue = (operator: AdvancedFilterOperator): boolean =>
  ["isEmpty", "isNotEmpty", "isTrue", "isFalse"].includes(operator);
const update = (id: string, patch: Partial<AdvancedFilter>): void => {
  state.value = {
    ...state.value,
    filters: state.value.filters.map((filter) =>
      filter.id === id ? { ...filter, ...patch } : filter
    ),
  };
};
const remove = (id: string): void => {
  state.value = {
    ...state.value,
    filters: state.value.filters.filter((filter) => filter.id !== id),
  };
};
const valueFromEvent = (event: Event, filter: AdvancedFilter): unknown => {
  const input = event.target as HTMLInputElement;
  const column = columnFor(filter);
  if (column?.type === "number") {
    return input.value === "" ? undefined : Number(input.value);
  }
  if (filter.operator === "between") {
    return input.value.split("..").map((value) => value.trim());
  }
  return input.value;
};
const optionValueFromEvent = (
  event: Event,
  filter: AdvancedFilter
): unknown => {
  const raw = (event.target as HTMLSelectElement).value;
  const option = columnFor(filter)?.options?.find(
    (item) => String(item.value) === raw
  );
  return option?.value ?? raw;
};
</script>

<template>
  <div class="yayaw-advanced-filters" aria-label="Advanced filters">
    <div class="yayaw-filter-join">
      <span>Match</span>
      <select v-model="state.joinOperator" class="yayaw-select" aria-label="Filter combination">
        <option value="and">all</option>
        <option value="or">any</option>
      </select>
      <span>conditions</span>
    </div>
    <div v-for="filter in state.filters" :key="filter.id" class="yayaw-filter-row">
      <select
        :value="filter.columnId"
        class="yayaw-select"
        aria-label="Filter column"
        @change="update(filter.id, { columnId: ($event.target as HTMLSelectElement).value })"
      >
        <option v-for="column in context.config.columns.definitions.filter((item) => !['actions'].includes(item.type ?? '') && item.id !== 'select')" :key="column.id" :value="column.id">
          {{ column.header }}
        </option>
      </select>
      <select
        :value="filter.operator"
        class="yayaw-select"
        aria-label="Filter operator"
        @change="update(filter.id, { operator: ($event.target as HTMLSelectElement).value as AdvancedFilterOperator })"
      >
        <option v-for="operator in operatorOptions" :key="operator.value" :value="operator.value">{{ operator.label }}</option>
      </select>
      <template v-if="!noValue(filter.operator)">
        <select
          v-if="columnFor(filter)?.options?.length"
          :value="filter.values"
          class="yayaw-select"
          aria-label="Filter value"
          @change="update(filter.id, { values: optionValueFromEvent($event, filter) })"
        >
          <option value="">Choose…</option>
          <option v-for="option in columnFor(filter)?.options" :key="String(option.value)" :value="option.value">{{ option.label }}</option>
        </select>
        <input
          v-else
          :type="columnFor(filter)?.type === 'number' ? 'number' : columnFor(filter)?.type === 'date' ? 'date' : 'text'"
          :value="Array.isArray(filter.values) ? filter.values.join('..') : filter.values"
          class="yayaw-input"
          :placeholder="filter.operator === 'between' ? 'start..end' : 'Value'"
          aria-label="Filter value"
          @input="update(filter.id, { values: valueFromEvent($event, filter) })"
        />
      </template>
      <button type="button" class="yayaw-icon-button" aria-label="Remove filter" @click="remove(filter.id)">×</button>
    </div>
  </div>
</template>
