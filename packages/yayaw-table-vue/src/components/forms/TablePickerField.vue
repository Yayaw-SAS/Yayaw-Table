<script setup lang="ts">
import { computed, defineAsyncComponent } from "vue";
import type {
  FormFieldContext,
  FormFieldDefinition,
  TableActions,
  TableConfig,
  TablePickerFieldConfig,
  TableRecord,
} from "../../types";

const YayawDataTable = defineAsyncComponent(
  () => import("../YayawDataTable.vue")
);

const props = defineProps<{
  id: string;
  field: FormFieldDefinition;
  modelValue: unknown;
  context: FormFieldContext;
  disabled?: boolean;
}>();
const emit = defineEmits<{
  "update:modelValue": [value: unknown];
}>();

const picker = computed<TablePickerFieldConfig>(() => {
  if (!props.field.tablePicker) {
    throw new Error(
      `YaYaw Table: tablePicker field "${props.field.name}" requires a tablePicker configuration.`
    );
  }
  return props.field.tablePicker;
});
const resolveConfig = (): TableConfig => {
  const source =
    typeof picker.value.config === "function"
      ? picker.value.config(props.context)
      : picker.value.config;
  const canSelectRow = source.table.canSelectRow;
  return {
    ...source,
    table: {
      ...source.table,
      allowCreate: false,
      allowDelete: false,
      allowDuplicate: false,
      allowEdit: false,
      allowBulkDelete: false,
      allowBulkEdit: false,
      allowInlineEdit: false,
      bulkExport: false,
      export: false,
      enableRowSelection: true,
      enableMultiRowSelection: picker.value.multiple !== false,
      preserveSelectionOnQuery: true,
      rowClickMode:
        props.disabled || picker.value.selectOnRowClick === false
          ? "none"
          : "activate",
      canSelectRow: props.disabled ? () => false : canSelectRow,
    },
  };
};
const config = computed(resolveConfig);
const data = computed<TableRecord[]>(() => {
  const source = picker.value.data;
  return typeof source === "function" ? source(props.context) : (source ?? []);
});
const getTableActions = (): TableActions | undefined => {
  const source = picker.value.actions;
  const resolved =
    typeof source === "function" ? source(props.context) : source;
  if (!resolved) return undefined;
  return {
    aggregate: resolved.aggregate,
    list: resolved.list,
    views: resolved.views,
  };
};
const currentValues = computed<unknown[]>(() =>
  picker.value.multiple === false
    ? props.modelValue === undefined || props.modelValue === null
      ? []
      : [props.modelValue]
    : Array.isArray(props.modelValue)
      ? props.modelValue
      : []
);
const rowSelection = computed<Record<string, boolean>>(() =>
  Object.fromEntries(currentValues.value.map((value) => [String(value), true]))
);
const parseValue = (id: string): unknown => picker.value.parseValue?.(id) ?? id;
const updateSelection = (next: Record<string, boolean>): void => {
  if (props.disabled) return;
  const active = Object.keys(next).filter((id) => next[id]);
  if (picker.value.multiple === false) {
    const current = currentValues.value[0];
    const selected = active.find((id) => id !== String(current)) ?? active[0];
    emit("update:modelValue", selected === undefined ? null : parseValue(selected));
    return;
  }
  const activeSet = new Set(active);
  const previous = currentValues.value
    .map(String)
    .filter((id) => activeSet.delete(id));
  emit("update:modelValue", [...previous, ...activeSet].map(parseValue));
};
const rowId = (row: TableRecord): string | undefined => {
  if (picker.value.getRowId) return picker.value.getRowId(row);
  const value = row.id ?? row._id ?? row.key;
  return value === undefined || value === null ? undefined : String(value);
};
const toggleRow = (row: TableRecord): void => {
  if (props.disabled || picker.value.selectOnRowClick === false) return;
  const id = rowId(row);
  if (!id || config.value.table.canSelectRow?.(row) === false) return;
  if (picker.value.multiple === false) {
    updateSelection(rowSelection.value[id] ? {} : { [id]: true });
    return;
  }
  updateSelection({
    ...rowSelection.value,
    [id]: !rowSelection.value[id],
  });
};
const instanceKey = computed(() =>
  JSON.stringify([
    picker.value.tableType,
    props.disabled,
    ...(props.field.optionDependencies ?? []).map(
      (name) => props.context.values[name]
    ),
  ])
);
</script>

<template>
  <div
    :id="id"
    class="yayaw-table-picker"
    role="group"
    :aria-labelledby="`${id}-label`"
    :style="
      picker.maxHeight
        ? { '--yayaw-table-picker-max-height': picker.maxHeight }
        : undefined
    "
  >
    <YayawDataTable
      :key="instanceKey"
      :table-type="picker.tableType"
      :config="config"
      :data="data"
      :get-table-actions="getTableActions"
      :get-row-id="picker.getRowId"
      :row-selection="rowSelection"
      :sync-url="picker.syncUrl ?? false"
      :locale="picker.locale ?? context.locale"
      :translations="picker.translations ?? context.translations"
      :initial-views="picker.initialViews"
      :initial-active-view-id="picker.initialActiveViewId"
      @row-selection-change="updateSelection"
      @row-activate="toggleRow"
    />
  </div>
</template>
