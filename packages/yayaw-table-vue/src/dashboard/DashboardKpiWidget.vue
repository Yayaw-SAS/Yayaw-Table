<script setup lang="ts">
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-vue-next";
import { computed, ref, shallowRef, watch } from "vue";
import type { ChartColumn } from "../chart-model";
import {
  type Dashboard,
  type DashboardKpiPlan,
  type DashboardKpiResult,
  type DashboardNotice,
  type DashboardTranslate,
  type DashboardView,
  type DashboardWidget,
  dashboardDayValue,
  dashboardKpiDisplay,
  dashboardKpiPlan,
  dashboardViewParams,
  loadDashboardKpi,
  widgetViewConfig,
} from "./dashboard-model";
import type { DashboardLabel, DashboardTableSource } from "./dashboard-types";

/**
 * A number over a table or a view's records, in the column's format, with
 * its change against the previous period and a trend line when the widget
 * asks for them. Aggregated by the host (`aggregate`), else over `list`.
 */
const props = defineProps<{
  dashboard: Pick<Dashboard, "filters">;
  widget: DashboardWidget;
  source: DashboardTableSource;
  view?: DashboardView;
  /** Changes with "Refresh all": the numbers load again. */
  revision: number;
  locale: string;
  label: DashboardLabel;
  translate: DashboardTranslate;
  /** What a source's `meta.notice` says (`dashboardNoticeText`). */
  noticeText: (notice: DashboardNotice) => string;
}>();

type KpiState =
  | { status: "loading" }
  | { status: "ready"; result: DashboardKpiResult }
  | { status: "error"; message: string };

const TREND_ICONS = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus };

const columns = computed(() => props.source.config.columns.definitions as unknown as readonly ChartColumn[]);
const attempt = ref(0);
const state = shallowRef<KpiState>({ status: "loading" });
// Periods end today; the plan changes (and loads again) with the day.
const planKey = computed(() =>
  JSON.stringify(dashboardKpiPlan(props.dashboard, props.widget, dashboardDayValue(new Date()), columns.value))
);
const plan = computed(() => JSON.parse(planKey.value) as DashboardKpiPlan);
// Inline settings, else the saved view's: its filters and search.
const paramsKey = computed(() => JSON.stringify(dashboardViewParams(widgetViewConfig(props.widget, props.view))));

let pending: AbortController | undefined;
watch(
  () => [planKey.value, paramsKey.value, props.locale, props.source.actions, props.revision, attempt.value],
  async () => {
    pending?.abort();
    const controller = new AbortController();
    pending = controller;
    state.value = { status: "loading" };
    try {
      const result = await loadDashboardKpi({
        plan: plan.value,
        actions: props.source.actions as Parameters<typeof loadDashboardKpi>[0]["actions"],
        params: JSON.parse(paramsKey.value) as Record<string, unknown>,
        locale: props.locale,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) state.value = { status: "ready", result };
    } catch (error) {
      if (!controller.signal.aborted) {
        state.value = { status: "error", message: error instanceof Error ? error.message : String(error) };
      }
    }
  },
  { immediate: true }
);

const notice = computed(() =>
  state.value.status === "ready" ? state.value.result.notice : undefined
);
const display = computed(() => {
  const current = state.value;
  return current.status === "ready"
    ? dashboardKpiDisplay({
        plan: plan.value,
        result: current.result,
        columns: columns.value,
        locale: props.locale,
        translate: props.translate,
      })
    : undefined;
});
const trendIcon = computed(() => (display.value?.comparison ? TREND_ICONS[display.value.comparison.trend] : undefined));
const errorMessage = computed(() => (state.value.status === "error" ? state.value.message : ""));
</script>

<template>
  <div v-if="state.status === 'error'" data-kpi="">
    <p data-kpi-state="error" role="alert">{{ props.label("widgetError", { error: errorMessage }) }}</p>
    <button type="button" class="yayaw-button yayaw-button-outline yayaw-dashboard-kpi-retry" @click="attempt += 1">
      {{ props.label("retry") }}
    </button>
  </div>
  <div
    v-else-if="notice"
    class="yayaw-dashboard-message yayaw-dashboard-notice"
    data-widget-state="notice"
    :data-widget-reason="notice.code"
  >
    <p>{{ props.noticeText(notice) }}</p>
  </div>
  <div v-else-if="!display" aria-busy="true" data-kpi="">
    <output data-kpi-state="loading">{{ props.label("widgetLoading") }}</output>
  </div>
  <div v-else data-kpi="">
    <div data-kpi-main="">
      <output data-chart-number="" data-kpi-value="" :title="display.caption">{{ display.value }}</output>
      <svg v-if="display.trend" data-kpi-trend="" preserveAspectRatio="none" role="img" viewBox="0 0 100 32">
        <title>{{ display.trend.title }}</title>
        <polyline :points="display.trend.points" />
      </svg>
    </div>
    <p
      v-if="display.comparison && trendIcon"
      data-kpi-compare=""
      :data-tone="display.comparison.tone"
      :data-trend="display.comparison.trend"
      :title="display.comparison.periods"
    >
      <component :is="trendIcon" aria-hidden="true" />
      <span>{{ display.comparison.text }}</span>
    </p>
  </div>
</template>
