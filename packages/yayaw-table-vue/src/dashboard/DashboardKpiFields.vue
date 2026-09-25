<script setup lang="ts">
import { computed } from "vue";
import {
  type DashboardColumn,
  type DashboardKpiMetric,
  type DashboardTranslate,
  type DashboardWidgetDraft,
  dashboardCompareDayOptions,
  dashboardDateColumns,
  dashboardMetricOptions,
} from "./dashboard-model";
import type { DashboardLabel } from "./dashboard-types";

/** A number's value, its date column, its comparison with the previous period and its trend. */
const props = defineProps<{
  draft: DashboardWidgetDraft;
  columns: readonly DashboardColumn[];
  prefix: string;
  label: DashboardLabel;
  locale: string;
  translate: DashboardTranslate;
}>();
const emit = defineEmits<{ "update:draft": [draft: DashboardWidgetDraft] }>();

const NUMBER_TYPES = new Set(["number", "currency", "percent"]);
const numberColumns = computed(() => props.columns.filter((column) => NUMBER_TYPES.has(String(column.type))));
const dateColumns = computed(() => dashboardDateColumns(props.columns));
const metricOptions = computed(() => dashboardMetricOptions(props.locale, props.translate));
const dayOptions = computed(() => dashboardCompareDayOptions(props.locale, props.translate));
const set = (patch: Partial<DashboardWidgetDraft>) => emit("update:draft", { ...props.draft, ...patch });
const chooseMetric = (value: string) =>
  set({
    metric: value as DashboardKpiMetric,
    metricColumn: props.draft.metricColumn || (numberColumns.value[0]?.id ?? ""),
  });
</script>

<template>
  <div class="yayaw-dashboard-field">
    <label :for="`${props.prefix}-metric`">{{ props.label("metric") }}</label>
    <select :id="`${props.prefix}-metric`" class="yayaw-select" :value="props.draft.metric" @change="chooseMetric(($event.target as HTMLSelectElement).value)">
      <option v-for="option in metricOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>
  </div>
  <div v-if="props.draft.metric !== 'count'" class="yayaw-dashboard-field">
    <label :for="`${props.prefix}-column`">{{ props.label("metricColumn") }}</label>
    <select :id="`${props.prefix}-column`" class="yayaw-select" :value="props.draft.metricColumn" @change="set({ metricColumn: ($event.target as HTMLSelectElement).value })">
      <option v-for="column in numberColumns" :key="column.id" :value="column.id">{{ column.header ?? column.id }}</option>
    </select>
  </div>
  <template v-if="dateColumns.length">
    <div class="yayaw-dashboard-field">
      <label :for="`${props.prefix}-date`">{{ props.label("dateColumn") }}</label>
      <select :id="`${props.prefix}-date`" class="yayaw-select" :value="props.draft.dateColumn" @change="set({ dateColumn: ($event.target as HTMLSelectElement).value })">
        <option value="">{{ props.label("noDateColumn") }}</option>
        <option v-for="column in dateColumns" :key="column.id" :value="column.id">{{ column.header ?? column.id }}</option>
      </select>
    </div>
    <div class="yayaw-dashboard-check">
      <input
        :id="`${props.prefix}-compare`"
        type="checkbox"
        :checked="props.draft.compare"
        :disabled="!props.draft.dateColumn"
        @change="set({ compare: ($event.target as HTMLInputElement).checked })"
      >
      <label :for="`${props.prefix}-compare`">{{ props.label("compare") }}</label>
    </div>
    <div v-if="props.draft.compare && props.draft.dateColumn" class="yayaw-dashboard-field-row">
      <div class="yayaw-dashboard-field">
        <label :for="`${props.prefix}-days`">{{ props.label("compareDays") }}</label>
        <select :id="`${props.prefix}-days`" class="yayaw-select" :value="String(props.draft.compareDays)" @change="set({ compareDays: Number(($event.target as HTMLSelectElement).value) })">
          <option v-for="option in dayOptions" :key="option.value" :value="String(option.value)">{{ option.label }}</option>
        </select>
      </div>
      <div class="yayaw-dashboard-field">
        <label :for="`${props.prefix}-better`">{{ props.label("compareBetter") }}</label>
        <select
          :id="`${props.prefix}-better`"
          class="yayaw-select"
          :value="props.draft.compareBetter"
          @change="set({ compareBetter: ($event.target as HTMLSelectElement).value === 'down' ? 'down' : 'up' })"
        >
          <option value="up">{{ props.label("compareUp") }}</option>
          <option value="down">{{ props.label("compareDown") }}</option>
        </select>
      </div>
    </div>
    <div class="yayaw-dashboard-check">
      <input
        :id="`${props.prefix}-sparkline`"
        type="checkbox"
        :checked="props.draft.sparkline"
        :disabled="!props.draft.dateColumn"
        @change="set({ sparkline: ($event.target as HTMLInputElement).checked })"
      >
      <label :for="`${props.prefix}-sparkline`">{{ props.label("sparkline") }}</label>
    </div>
  </template>
</template>
