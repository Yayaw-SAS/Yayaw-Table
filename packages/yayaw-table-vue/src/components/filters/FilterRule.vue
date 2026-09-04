<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useTableContext } from "../../context";
import {
  filterHasValue,
  filterIsMultiple,
  filterNeedsValue,
  filterOperators,
  filterType,
  operatorTranslationKeys,
} from "../../filter-config";
import { cloneFormValue, formValuesEqual } from "../../form-runtime";
import type {
  AdvancedFilter,
  AdvancedFilterOperator,
  ColumnDefinition,
  PrimitiveValue,
  SelectOption,
} from "../../types";

const props = defineProps<{
  filter: AdvancedFilter;
  columns: ColumnDefinition[];
}>();
const emit = defineEmits<{ update: [filter: AdvancedFilter]; remove: [] }>();
const context = useTableContext();
const draft = ref(cloneFormValue(props.filter));
const search = ref("");
watch(
  () => props.filter,
  (filter) => {
    draft.value = cloneFormValue(filter);
    search.value = "";
  },
  { deep: true }
);
const column = computed(() =>
  props.columns.find((item) => item.id === draft.value.columnId)
);
const type = computed(() => filterType(column.value));
const multiple = computed(() =>
  filterIsMultiple(type.value, draft.value.operator)
);
const range = computed(() => draft.value.operator === "between");
const dirty = computed(() => !formValuesEqual(props.filter, draft.value));
const valid = computed(
  () =>
    Boolean(column.value) &&
    filterHasValue({ ...draft.value, type: type.value })
);
const t = (key: string, fallback: string): string => {
  const value = context.translations.value[`filters.${key}`];
  return typeof value === "string" ? value : fallback;
};
const values = computed<unknown[]>(() =>
  Array.isArray(draft.value.values) ? draft.value.values : [draft.value.values]
);
const options = computed(() => {
  const result: SelectOption[] = [...(column.value?.options ?? [])];
  const add = (value: unknown) => {
    if (
      !["string", "number", "boolean"].includes(typeof value) ||
      result.some((option) => Object.is(option.value, value))
    )
      return;
    result.push({ value: value as PrimitiveValue, label: String(value) });
  };
  if (!column.value?.options?.length) {
    for (const row of context.data.rows.value) {
      const value = column.value?.accessorFn
        ? column.value.accessorFn(row)
        : row[column.value?.accessorKey ?? draft.value.columnId];
      for (const item of Array.isArray(value) ? value : [value]) add(item);
    }
  }
  // A selected value can be absent from the current server page's facets.
  for (const value of values.value) add(value);
  return result;
});
const visibleOptions = computed(() =>
  options.value.filter((option) =>
    option.label.toLocaleLowerCase().includes(search.value.toLocaleLowerCase())
  )
);
const selectedIndex = computed(() =>
  options.value.findIndex((option) => Object.is(option.value, values.value[0]))
);
const changeColumn = (event: Event): void => {
  const id = (event.target as HTMLSelectElement).value;
  const nextColumn = props.columns.find((item) => item.id === id);
  if (!nextColumn) return;
  draft.value = {
    ...draft.value,
    columnId: id,
    type: filterType(nextColumn),
    operator: filterOperators(nextColumn)[0] ?? "contains",
    values: undefined,
  };
  search.value = "";
};
const changeOperator = (event: Event): void => {
  const operator = (event.target as HTMLSelectElement)
    .value as AdvancedFilterOperator;
  const previous = values.value;
  let value: unknown = previous[0];
  if (operator === "between") value = [previous[0], previous[1]];
  else if (filterIsMultiple(type.value, operator))
    value = previous.filter((item) => item !== undefined);
  if (!filterNeedsValue(operator)) value = undefined;
  draft.value = { ...draft.value, operator, values: value };
};
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const inputValue = (index: number): string | number => {
  const value = values.value[index];
  if (type.value !== "date" || !value)
    return typeof value === "string" || typeof value === "number" ? value : "";
  if (typeof value === "string" && DATE_ONLY.test(value)) return value;
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const changeValue = (event: Event, index = 0): void => {
  const raw = (event.target as HTMLInputElement).value;
  const value =
    type.value === "number" ? (raw === "" ? undefined : Number(raw)) : raw;
  if (range.value) {
    const next = [...values.value];
    next[index] = value;
    draft.value.values = next;
  } else draft.value.values = value;
};
const toggleOption = (option: SelectOption, event: Event): void => {
  draft.value.values = (event.target as HTMLInputElement).checked
    ? [...values.value.filter((value) => value !== undefined), option.value]
    : values.value.filter((value) => !Object.is(value, option.value));
};
const apply = (): void => {
  if (!valid.value) return;
  emit("update", {
    ...cloneFormValue(draft.value),
    type: type.value,
    isActive: true,
  });
};
const toggleActive = (): void => {
  if (props.filter.isActive === false && !filterHasValue(props.filter)) return;
  emit("update", {
    ...props.filter,
    isActive: props.filter.isActive === false,
  });
};
const revert = async (): Promise<void> => {
  draft.value = cloneFormValue(props.filter);
  await nextTick();
  document.getElementById(`filter-column-${props.filter.id}`)?.focus();
};
</script>

<template>
  <form class="yayaw-filter-rule" :data-active="filter.isActive !== false" :aria-label="`${t('advanced.edit_filter_for', 'Filter for')} ${column?.header ?? draft.columnId}`" @submit.prevent="apply" @keydown.esc.stop.prevent="revert">
    <div class="yayaw-filter-row">
      <label class="yayaw-field-inline">
        <span>{{ t('column', 'Filter column') }}</span>
        <select :id="`filter-column-${filter.id}`" class="yayaw-select" :value="draft.columnId" @change="changeColumn">
          <option v-if="!column" :value="draft.columnId" disabled>{{ draft.columnId }}</option>
          <option v-for="item in columns" :key="item.id" :value="item.id">{{ item.header }}</option>
        </select>
      </label>
      <label class="yayaw-field-inline">
        <span>{{ t('select_operator', 'Filter operator') }}</span>
        <select class="yayaw-select" :value="draft.operator" @change="changeOperator">
          <option v-for="operator in filterOperators(column, draft.operator)" :key="operator" :value="operator">{{ t(`operators.${operatorTranslationKeys[operator]}`, operator) }}</option>
        </select>
      </label>
      <template v-if="filterNeedsValue(draft.operator)">
        <fieldset v-if="multiple" class="yayaw-filter-options">
          <legend>{{ t('value', 'Filter value') }}</legend>
          <input v-if="options.length > 6" v-model="search" type="search" class="yayaw-input" :aria-label="t('search', 'Search values')" :placeholder="t('search', 'Search values')" />
          <div class="yayaw-filter-option-list">
            <label v-for="option in visibleOptions" :key="`${typeof option.value}:${option.value}`" class="yayaw-checkbox-label">
              <input type="checkbox" :checked="values.some((value) => Object.is(value, option.value))" :disabled="option.disabled" @change="toggleOption(option, $event)" />
              {{ option.label }}
            </label>
            <span v-if="!visibleOptions.length">{{ t('noResults', 'No values available') }}</span>
          </div>
        </fieldset>
        <label v-else-if="type === 'select'" class="yayaw-field-inline">
          <span>{{ t('value', 'Filter value') }}</span>
          <select class="yayaw-select" :value="selectedIndex" @change="draft.values = options[Number(($event.target as HTMLSelectElement).value)]?.value">
            <option :value="-1">{{ t('choose', 'Choose…') }}</option>
            <option v-for="(option, index) in options" :key="`${typeof option.value}:${option.value}`" :value="index" :disabled="option.disabled">{{ option.label }}</option>
          </select>
        </label>
        <template v-else>
          <label v-for="index in range ? 2 : 1" :key="index" class="yayaw-field-inline">
            <span>{{ index === 2 ? t('value_to', 'Filter value to') : t('value', 'Filter value') }}</span>
            <input :type="type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'" :value="inputValue(index - 1)" class="yayaw-input" :step="type === 'number' ? 'any' : undefined" @input="changeValue($event, index - 1)" />
          </label>
        </template>
      </template>
      <div class="yayaw-filter-buttons">
        <button type="submit" class="yayaw-button yayaw-button-outline" :disabled="!valid || (!dirty && filter.isActive !== false)">{{ t('apply', 'Apply') }}</button>
        <button type="button" class="yayaw-icon-button" :aria-label="filter.isActive === false ? t('advanced.enable_filter', 'Enable filter') : t('advanced.disable_filter', 'Disable filter')" :aria-pressed="filter.isActive !== false" :disabled="filter.isActive === false && !filterHasValue(filter)" @click="toggleActive">{{ filter.isActive === false ? '○' : '●' }}</button>
        <button type="button" class="yayaw-icon-button" :aria-label="t('remove', 'Remove filter')" @click="emit('remove')">×</button>
      </div>
    </div>
    <p v-if="dirty && !valid" class="yayaw-filter-hint">{{ t('complete_values', 'Complete the filter values before applying.') }}</p>
  </form>
</template>
