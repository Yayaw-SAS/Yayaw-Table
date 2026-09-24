<script setup lang="ts">
import { X } from "lucide-vue-next";
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from "reka-ui";
import { computed, ref, useId } from "vue";
import {
  type DashboardFilter,
  type DashboardFilterType,
  type DashboardTableInfo,
  filterableColumns,
} from "./dashboard-model";
import type { DashboardLabel } from "./dashboard-types";

/** A new dashboard filter: its type, name and the column of each table it applies to. */
const props = defineProps<{
  open: boolean;
  /** Tables of the dashboard's widgets, which a filter can apply to. */
  tables: Record<string, DashboardTableInfo>;
  label: DashboardLabel;
}>();
const emit = defineEmits<{
  "update:open": [open: boolean];
  add: [filter: Omit<DashboardFilter, "id">];
}>();

const prefix = useId();
const type = ref<DashboardFilterType>("dateRange");
const name = ref("");
const columns = ref<Record<string, string>>({});
const choices = computed(() =>
  Object.entries(props.tables).map(([tableId, table]) => ({
    tableId,
    table,
    options: filterableColumns(type.value, table.columns),
  }))
);
const columnOf = (tableId: string, options: { id: string }[]) =>
  columns.value[tableId] ?? options[0]?.id ?? "";
const targets = computed(() =>
  choices.value
    .map(({ tableId, options }) => ({ tableId, columnId: columnOf(tableId, options) }))
    .filter((target) => target.columnId)
);
const chooseType = (value: string) => {
  type.value = value as DashboardFilterType;
  columns.value = {};
};
const submit = () => {
  emit("add", {
    type: type.value,
    label: name.value.trim() || props.label(type.value === "dateRange" ? "filterDateRange" : "filterSelect"),
    targets: targets.value,
  });
  name.value = "";
  columns.value = {};
  emit("update:open", false);
};
</script>

<template>
  <DialogRoot :open="props.open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="yayaw-dashboard-dialog-backdrop" />
      <DialogContent class="yayaw-dashboard-dialog" data-dashboard-dialog="add-filter" :aria-describedby="undefined">
        <DialogTitle as="h2">{{ props.label("addFilterTitle") }}</DialogTitle>
        <DialogClose class="yayaw-dashboard-icon-button yayaw-dashboard-dialog-close" aria-label="Close"><X :size="16" aria-hidden="true" /></DialogClose>
        <form class="yayaw-dashboard-form" @submit.prevent="submit">
          <div class="yayaw-dashboard-field">
            <label :for="`${prefix}-type`">{{ props.label("filterType") }}</label>
            <select :id="`${prefix}-type`" class="yayaw-select" :value="type" @change="chooseType(($event.target as HTMLSelectElement).value)">
              <option value="dateRange">{{ props.label("filterDateRange") }}</option>
              <option value="select">{{ props.label("filterSelect") }}</option>
            </select>
          </div>
          <div class="yayaw-dashboard-field">
            <label :for="`${prefix}-name`">{{ props.label("filterName") }}</label>
            <input :id="`${prefix}-name`" v-model="name" class="yayaw-input">
          </div>
          <div v-for="choice in choices" :key="choice.tableId" class="yayaw-dashboard-field">
            <label :for="`${prefix}-${choice.tableId}`">{{ props.label("filterColumn", { table: choice.table.name }) }}</label>
            <select
              :id="`${prefix}-${choice.tableId}`"
              class="yayaw-select"
              :value="columnOf(choice.tableId, choice.options)"
              @change="columns = { ...columns, [choice.tableId]: ($event.target as HTMLSelectElement).value }"
            >
              <option value="">{{ props.label("notApplied") }}</option>
              <option v-for="column in choice.options" :key="column.id" :value="column.id">{{ column.header ?? column.id }}</option>
            </select>
          </div>
          <p v-if="!targets.length" class="yayaw-dashboard-muted">{{ props.label("noFilterColumns") }}</p>
          <footer class="yayaw-dashboard-dialog-footer">
            <button type="button" class="yayaw-button yayaw-button-outline" @click="emit('update:open', false)">{{ props.label("cancel") }}</button>
            <button type="submit" class="yayaw-button" :disabled="!targets.length">{{ props.label("add") }}</button>
          </footer>
        </form>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
