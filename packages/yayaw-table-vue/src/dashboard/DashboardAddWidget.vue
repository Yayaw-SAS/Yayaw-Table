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
  type DashboardWidgetDraft,
  dashboardCompareDayOptions,
  dashboardDateColumns,
  dashboardMetricOptions,
  dashboardWidgetFromDraft,
  emptyWidgetDraft,
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
const draft = ref<DashboardWidgetDraft>(emptyWidgetDraft(firstTable()));
const numberColumns = computed(() =>
  (props.tables[draft.value.tableId]?.columns ?? []).filter((column) => NUMBER_TYPES.has(String(column.type)))
);
const dateColumns = computed(() => dashboardDateColumns(props.tables[draft.value.tableId]?.columns ?? []));
const metricOptions = computed(() => dashboardMetricOptions(props.locale, props.translate));
const dayOptions = computed(() => dashboardCompareDayOptions(props.locale, props.translate));

const chooseTable = (value: string) => {
  draft.value = { ...draft.value, tableId: value, viewId: "", metricColumn: "", dateColumn: "" };
};
const chooseMetric = (value: string) => {
  draft.value = {
    ...draft.value,
    metric: value as DashboardKpiMetric,
    metricColumn: draft.value.metricColumn || (numberColumns.value[0]?.id ?? ""),
  };
};
const submit = () => {
  emit("add", dashboardWidgetFromDraft(draft.value));
  draft.value = emptyWidgetDraft(firstTable());
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
            <select :id="`${prefix}-type`" v-model="draft.type" class="yayaw-select">
              <option value="view">{{ props.label("typeView") }}</option>
              <option value="kpi">{{ props.label("typeKpi") }}</option>
              <option value="note">{{ props.label("typeNote") }}</option>
            </select>
          </div>
          <template v-if="draft.type !== 'note'">
            <div class="yayaw-dashboard-field">
              <label :for="`${prefix}-table`">{{ props.label("table") }}</label>
              <select :id="`${prefix}-table`" class="yayaw-select" :value="draft.tableId" @change="chooseTable(($event.target as HTMLSelectElement).value)">
                <option v-for="(table, id) in props.tables" :key="id" :value="id">{{ table.name }}</option>
              </select>
            </div>
            <div class="yayaw-dashboard-field">
              <label :for="`${prefix}-view`">{{ props.label("view") }}</label>
              <select :id="`${prefix}-view`" v-model="draft.viewId" class="yayaw-select">
                <option value="">{{ props.label("defaultView") }}</option>
                <option v-for="view in props.views[draft.tableId] ?? []" :key="view.id" :value="view.id">{{ view.name }}</option>
              </select>
            </div>
          </template>
          <div v-if="draft.type === 'view'" class="yayaw-dashboard-field">
            <label :for="`${prefix}-overflow`">{{ props.label("overflow") }}</label>
            <select :id="`${prefix}-overflow`" v-model="draft.overflow" class="yayaw-select">
              <option value="fit">{{ props.label("overflowFit") }}</option>
              <option value="scroll">{{ props.label("overflowScroll") }}</option>
            </select>
          </div>
          <template v-if="draft.type === 'kpi'">
            <div class="yayaw-dashboard-field">
              <label :for="`${prefix}-metric`">{{ props.label("metric") }}</label>
              <select :id="`${prefix}-metric`" class="yayaw-select" :value="draft.metric" @change="chooseMetric(($event.target as HTMLSelectElement).value)">
                <option v-for="option in metricOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            </div>
            <div v-if="draft.metric !== 'count'" class="yayaw-dashboard-field">
              <label :for="`${prefix}-column`">{{ props.label("metricColumn") }}</label>
              <select :id="`${prefix}-column`" v-model="draft.metricColumn" class="yayaw-select">
                <option v-for="column in numberColumns" :key="column.id" :value="column.id">{{ column.header ?? column.id }}</option>
              </select>
            </div>
            <template v-if="dateColumns.length">
              <div class="yayaw-dashboard-field">
                <label :for="`${prefix}-date`">{{ props.label("dateColumn") }}</label>
                <select :id="`${prefix}-date`" v-model="draft.dateColumn" class="yayaw-select">
                  <option value="">{{ props.label("noDateColumn") }}</option>
                  <option v-for="column in dateColumns" :key="column.id" :value="column.id">{{ column.header ?? column.id }}</option>
                </select>
              </div>
              <div class="yayaw-dashboard-check">
                <input :id="`${prefix}-compare`" v-model="draft.compare" type="checkbox" :disabled="!draft.dateColumn">
                <label :for="`${prefix}-compare`">{{ props.label("compare") }}</label>
              </div>
              <div v-if="draft.compare && draft.dateColumn" class="yayaw-dashboard-field-row">
                <div class="yayaw-dashboard-field">
                  <label :for="`${prefix}-days`">{{ props.label("compareDays") }}</label>
                  <select :id="`${prefix}-days`" v-model.number="draft.compareDays" class="yayaw-select">
                    <option v-for="option in dayOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                  </select>
                </div>
                <div class="yayaw-dashboard-field">
                  <label :for="`${prefix}-better`">{{ props.label("compareBetter") }}</label>
                  <select :id="`${prefix}-better`" v-model="draft.compareBetter" class="yayaw-select">
                    <option value="up">{{ props.label("compareUp") }}</option>
                    <option value="down">{{ props.label("compareDown") }}</option>
                  </select>
                </div>
              </div>
              <div class="yayaw-dashboard-check">
                <input :id="`${prefix}-sparkline`" v-model="draft.sparkline" type="checkbox" :disabled="!draft.dateColumn">
                <label :for="`${prefix}-sparkline`">{{ props.label("sparkline") }}</label>
              </div>
            </template>
          </template>
          <div class="yayaw-dashboard-field">
            <label :for="`${prefix}-title`">{{ props.label("widgetTitle") }}</label>
            <input :id="`${prefix}-title`" v-model="draft.title" class="yayaw-input">
          </div>
          <div v-if="draft.type === 'note'" class="yayaw-dashboard-field">
            <label :for="`${prefix}-text`">{{ props.label("noteText") }}</label>
            <textarea :id="`${prefix}-text`" v-model="draft.text" class="yayaw-textarea" rows="4" />
          </div>
          <footer class="yayaw-dashboard-dialog-footer">
            <button type="button" class="yayaw-button yayaw-button-outline" @click="emit('update:open', false)">{{ props.label("cancel") }}</button>
            <button type="submit" class="yayaw-button" :disabled="draft.type !== 'note' && !draft.tableId">{{ props.label("add") }}</button>
          </footer>
        </form>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
