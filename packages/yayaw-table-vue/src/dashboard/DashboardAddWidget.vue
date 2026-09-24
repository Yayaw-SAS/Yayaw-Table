<script setup lang="ts">
import { X } from "lucide-vue-next";
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from "reka-ui";
import { computed, ref, useId } from "vue";
import {
  type DashboardKpiMetric,
  type DashboardTableInfo,
  type DashboardTranslate,
  type DashboardView,
  type DashboardWidget,
  type DashboardWidgetType,
  dashboardMetricOptions,
} from "./dashboard-model";
import type { DashboardLabel } from "./dashboard-types";

/** Picker: a table's saved view, a number or a note. */
const props = defineProps<{
  open: boolean;
  tables: Record<string, DashboardTableInfo>;
  views: Record<string, DashboardView[] | undefined>;
  label: DashboardLabel;
  locale: string;
  translate: DashboardTranslate;
}>();
const emit = defineEmits<{
  "update:open": [open: boolean];
  add: [widget: Omit<DashboardWidget, "id">];
}>();

const NUMBER_TYPES = new Set(["number", "currency", "percent"]);
const prefix = useId();
const firstTable = () => Object.keys(props.tables)[0] ?? "";
const type = ref<DashboardWidgetType>("view");
const tableId = ref(firstTable());
const viewId = ref("");
const metric = ref<DashboardKpiMetric>("count");
const metricColumn = ref("");
const title = ref("");
const text = ref("");
const numberColumns = computed(() =>
  (props.tables[tableId.value]?.columns ?? []).filter((column) => NUMBER_TYPES.has(String(column.type)))
);
const metricOptions = computed(() => dashboardMetricOptions(props.locale, props.translate));

const chooseTable = (value: string) => {
  tableId.value = value;
  viewId.value = "";
  metricColumn.value = "";
};
const chooseMetric = (value: string) => {
  metric.value = value as DashboardKpiMetric;
  metricColumn.value ||= numberColumns.value[0]?.id ?? "";
};
const widget = (): Omit<DashboardWidget, "id"> => {
  const name = title.value.trim();
  if (type.value === "note") {
    return { type: "note", ...(name ? { title: name } : {}), settings: { text: text.value } };
  }
  const base = { type: type.value, tableId: tableId.value, ...(viewId.value ? { viewId: viewId.value } : {}) };
  if (type.value === "view") {
    return { ...base, ...(name ? { title: name } : {}), settings: {} };
  }
  return {
    ...base,
    settings: {
      metric: metric.value,
      ...(metric.value !== "count" && metricColumn.value ? { metricColumn: metricColumn.value } : {}),
      ...(name ? { label: name } : {}),
    },
  };
};
const reset = () => {
  type.value = "view";
  tableId.value = firstTable();
  viewId.value = "";
  metric.value = "count";
  metricColumn.value = "";
  title.value = "";
  text.value = "";
};
const submit = () => {
  emit("add", widget());
  reset();
  emit("update:open", false);
};
</script>

<template>
  <DialogRoot :open="props.open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="yayaw-dashboard-dialog-backdrop" />
      <DialogContent class="yayaw-dashboard-dialog" data-dashboard-dialog="add-widget" :aria-describedby="undefined">
        <DialogTitle as="h2">{{ props.label("addWidgetTitle") }}</DialogTitle>
        <DialogClose class="yayaw-dashboard-icon-button yayaw-dashboard-dialog-close" aria-label="Close"><X :size="16" aria-hidden="true" /></DialogClose>
        <form class="yayaw-dashboard-form" @submit.prevent="submit">
          <div class="yayaw-dashboard-field">
            <label :for="`${prefix}-type`">{{ props.label("widgetType") }}</label>
            <select :id="`${prefix}-type`" v-model="type" class="yayaw-select">
              <option value="view">{{ props.label("typeView") }}</option>
              <option value="kpi">{{ props.label("typeKpi") }}</option>
              <option value="note">{{ props.label("typeNote") }}</option>
            </select>
          </div>
          <template v-if="type !== 'note'">
            <div class="yayaw-dashboard-field">
              <label :for="`${prefix}-table`">{{ props.label("table") }}</label>
              <select :id="`${prefix}-table`" class="yayaw-select" :value="tableId" @change="chooseTable(($event.target as HTMLSelectElement).value)">
                <option v-for="(table, id) in props.tables" :key="id" :value="id">{{ table.name }}</option>
              </select>
            </div>
            <div class="yayaw-dashboard-field">
              <label :for="`${prefix}-view`">{{ props.label("view") }}</label>
              <select :id="`${prefix}-view`" v-model="viewId" class="yayaw-select">
                <option value="">{{ props.label("defaultView") }}</option>
                <option v-for="view in props.views[tableId] ?? []" :key="view.id" :value="view.id">{{ view.name }}</option>
              </select>
            </div>
          </template>
          <template v-if="type === 'kpi'">
            <div class="yayaw-dashboard-field">
              <label :for="`${prefix}-metric`">{{ props.label("metric") }}</label>
              <select :id="`${prefix}-metric`" class="yayaw-select" :value="metric" @change="chooseMetric(($event.target as HTMLSelectElement).value)">
                <option v-for="option in metricOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            </div>
            <div v-if="metric !== 'count'" class="yayaw-dashboard-field">
              <label :for="`${prefix}-column`">{{ props.label("metricColumn") }}</label>
              <select :id="`${prefix}-column`" v-model="metricColumn" class="yayaw-select">
                <option v-for="column in numberColumns" :key="column.id" :value="column.id">{{ column.header ?? column.id }}</option>
              </select>
            </div>
          </template>
          <div class="yayaw-dashboard-field">
            <label :for="`${prefix}-title`">{{ props.label("widgetTitle") }}</label>
            <input :id="`${prefix}-title`" v-model="title" class="yayaw-input">
          </div>
          <div v-if="type === 'note'" class="yayaw-dashboard-field">
            <label :for="`${prefix}-text`">{{ props.label("noteText") }}</label>
            <textarea :id="`${prefix}-text`" v-model="text" class="yayaw-textarea" rows="4" />
          </div>
          <footer class="yayaw-dashboard-dialog-footer">
            <button type="button" class="yayaw-button yayaw-button-outline" @click="emit('update:open', false)">{{ props.label("cancel") }}</button>
            <button type="submit" class="yayaw-button" :disabled="type !== 'note' && !tableId">{{ props.label("add") }}</button>
          </footer>
        </form>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
