<script setup lang="ts">
import { Table2 } from "lucide-vue-next";
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import {
  buildChartModel,
  type ChartCategory,
  type ChartDataResult,
  type ChartLabelKey,
  type ChartSeriesItem,
  type ChartViewSettings,
  canAddChartFilters,
  chartAggregateRequest,
  chartFillLayout,
  chartGroupFilters,
  chartLabel,
  loadChartData,
  resolveChartSettings,
} from "../chart-model";
import type { DisplayModeRenderContext } from "../display-mode-renderer";
import ChartCanvas from "./ChartCanvas.vue";
import ChartTable from "./ChartTable.vue";
import "./chart.css";

const props = defineProps<{ context: DisplayModeRenderContext }>();

/** The host's shadcn chart tokens (with YaYaw fallbacks), light and dark. */
const PALETTE = [
  "var(--yayaw-chart-1)",
  "var(--yayaw-chart-2)",
  "var(--yayaw-chart-3)",
  "var(--yayaw-chart-4)",
  "var(--yayaw-chart-5)",
];
const OTHER_COLOR = "var(--yayaw-muted-foreground)";

const translate = (key: string, fallback: string): string =>
  props.context.translate(`chart.${key}`, fallback);
const label = (
  key: ChartLabelKey,
  params?: Record<string, number | string>
): string => chartLabel(key, props.context.locale, translate, params);

const settings = computed(() =>
  resolveChartSettings(
    props.context.columns,
    props.context.defaults as ChartViewSettings,
    props.context.settings as ChartViewSettings
  )
);
const request = computed(() =>
  chartAggregateRequest(settings.value, props.context.columns)
);
const result = shallowRef<ChartDataResult>();
const error = ref<string>();
const loading = ref(true);
const asTable = ref(false);
const notice = ref<string>();

let pending: AbortController | undefined;
// Groups from `actions.aggregate`, or computed over the rows matching the query.
watch(
  () => [
    JSON.stringify(request.value ?? null),
    props.context.aggregate,
    props.context.list,
    props.context.listParams,
    props.context.list ? undefined : props.context.rows,
    props.context.revision,
    props.context.locale,
  ],
  async () => {
    pending?.abort();
    const current = request.value;
    if (!current) {
      loading.value = false;
      return;
    }
    const controller = new AbortController();
    pending = controller;
    loading.value = true;
    try {
      result.value = await loadChartData({
        aggregate: props.context.aggregate,
        list: props.context.list,
        rows: props.context.list ? undefined : props.context.rows,
        params: props.context.listParams,
        request: current,
        locale: props.context.locale,
        signal: controller.signal,
      });
      error.value = undefined;
      loading.value = false;
    } catch (cause) {
      if (!controller.signal.aborted) {
        error.value = cause instanceof Error ? cause.message : String(cause);
        loading.value = false;
      }
    }
  },
  { immediate: true }
);

const model = computed(() =>
  result.value
    ? buildChartModel({
        result: result.value,
        settings: settings.value,
        columns: props.context.columns,
        locale: props.context.locale,
        translate,
        palette: PALETTE,
        otherColor: OTHER_COLOR,
        coloredTags: props.context.coloredTags,
      })
    : undefined
);
const clickable = computed(
  () =>
    settings.value.type !== "number" &&
    canAddChartFilters(props.context.advancedFilters)
);
const hasTable = computed(() => Boolean(model.value) && model.value?.type !== "number");
const visible = computed(
  () => model.value && !(model.value.empty && model.value.type !== "number")
);
/** Legend entries: a donut's slices with their values, else the series. */
const legendEntries = computed(() => {
  const current = model.value;
  if (!current) return [];
  if (current.type === "donut") {
    return current.categories
      .filter((category) => category.total > 0)
      .map((category) => ({
        id: category.id,
        label: category.label,
        color: category.color,
        value: category.total as number | undefined,
      }));
  }
  if (current.type === "funnel") {
    return (current.stages ?? []).map((stage) => ({
      id: stage.id,
      label: stage.label,
      color: stage.color,
      value: stage.value as number | undefined,
    }));
  }
  if (current.single || current.type === "number") return [];
  return current.series.map((item) => ({
    id: item.id,
    label: item.label,
    color: item.color,
    value: undefined as number | undefined,
  }));
});
const legendItems = computed(() => (settings.value.showLegend ? legendEntries.value : []));

// A chart filling its box (`fill`): the legend beside, under or out of the
// chart and data labels as the room allows; no title, toggle or hint.
const fillBox = ref<HTMLElement>();
const fillSize = ref({ width: 0, height: 0 });
let fillObserver: ResizeObserver | undefined;
watch(
  fillBox,
  (element) => {
    fillObserver?.disconnect();
    fillObserver = undefined;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      if (fillSize.value.width !== width || fillSize.value.height !== height) {
        fillSize.value = { width, height };
      }
    };
    measure();
    fillObserver = new ResizeObserver(measure);
    fillObserver.observe(element);
  },
  { flush: "post" }
);
onBeforeUnmount(() => fillObserver?.disconnect());
const fillLayout = computed(() => {
  const current = model.value;
  if (!(current && settings.value.fill)) return undefined;
  const legend = legendItems.value.length;
  return chartFillLayout({
    width: fillSize.value.width,
    height: fillSize.value.height,
    type: current.type,
    categories: current.categories.length,
    legendItems: legend,
    showDataLabels: settings.value.showDataLabels,
  });
});
const fillReady = computed(() => fillSize.value.width > 0 && fillSize.value.height > 0);

const hint = computed<ChartLabelKey>(() => {
  if (!clickable.value) return "filterUnavailable";
  return model.value?.type === "funnel" ? "funnelHint" : "filterHint";
});

const onGroup = (category?: ChartCategory, series?: ChartSeriesItem): void => {
  const rules = chartGroupFilters(settings.value, props.context.columns, {
    category,
    series,
  });
  if (!rules) return;
  if (!props.context.showRecords(rules as unknown as Record<string, unknown>[])) {
    notice.value = label("filterUnavailable");
  }
};
</script>

<template>
  <output v-if="!(settings.xColumn || settings.type === 'number')" class="yayaw-chart-message">
    {{ label("noColumn") }}
  </output>
  <section
    v-else-if="settings.fill"
    class="yayaw-chart-view yayaw-chart-fill"
    :aria-busy="loading"
    :aria-label="model?.title"
    :data-chart-type="settings.type"
    data-chart-fill=""
  >
    <div v-if="error" class="yayaw-chart-message yayaw-chart-error" role="alert">{{ error }}</div>
    <div v-if="notice" class="yayaw-chart-message yayaw-chart-error" role="alert">{{ notice }}</div>
    <output v-if="result?.truncated" class="yayaw-chart-message">{{ label("truncated") }}</output>
    <output v-if="!model && loading" class="yayaw-chart-message">{{ label("loading") }}</output>
    <output v-if="model?.empty && model.type !== 'number'" class="yayaw-chart-message">{{ label("empty") }}</output>
    <div
      v-if="model && visible"
      ref="fillBox"
      class="yayaw-chart-fill-box"
      :class="{ 'yayaw-chart-loading': loading }"
      :data-chart-legend-placement="fillLayout?.legend"
    >
      <div v-if="fillReady && fillLayout" class="yayaw-chart-fill-content" :data-legend="fillLayout.legend">
        <div class="yayaw-chart-fill-plot" :style="{ height: `${fillLayout.plotHeight}px`, width: `${fillLayout.plotWidth}px` }">
          <ChartCanvas :model="model" :settings="settings" :clickable="clickable" :label="label" :fill="fillLayout" @group="onGroup" />
        </div>
        <ul
          v-if="fillLayout.legend !== 'none'"
          class="yayaw-chart-legend"
          data-chart-legend
          :data-placement="fillLayout.legend"
          :style="fillLayout.legend === 'right' ? { width: `${fillLayout.legendWidth}px` } : undefined"
        >
          <li v-for="item in legendItems" :key="item.id">
            <span class="yayaw-chart-swatch" :style="{ background: item.color }" aria-hidden="true" />
            <span class="yayaw-chart-legend-label">{{ item.label }}</span>
            <span v-if="fillLayout.dataLabels && item.value !== undefined" class="yayaw-chart-muted">{{ model.format(item.value) }}</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
  <section
    v-else
    class="yayaw-chart-view"
    :aria-busy="loading"
    :aria-label="model?.title"
    :data-chart-type="settings.type"
  >
    <div class="yayaw-chart-header">
      <h3 class="yayaw-chart-title" data-chart-title>{{ model?.title }}</h3>
      <button
        v-if="hasTable"
        type="button"
        class="yayaw-button yayaw-button-outline"
        :aria-pressed="asTable"
        @click="asTable = !asTable"
      >
        <Table2 :size="16" aria-hidden="true" />
        {{ label(asTable ? "showChart" : "showTable") }}
      </button>
    </div>
    <div v-if="error" class="yayaw-chart-message yayaw-chart-error" role="alert">{{ error }}</div>
    <div v-if="notice" class="yayaw-chart-message yayaw-chart-error" role="alert">{{ notice }}</div>
    <output v-if="result?.truncated" class="yayaw-chart-message">{{ label("truncated") }}</output>
    <output v-if="!model && loading" class="yayaw-chart-message">{{ label("loading") }}</output>
    <output v-if="model?.empty && model.type !== 'number'" class="yayaw-chart-message">{{ label("empty") }}</output>
    <div v-if="model && visible" class="yayaw-chart-body" :class="{ 'yayaw-chart-loading': loading }">
      <ChartTable
        v-if="asTable && hasTable"
        :model="model"
        :clickable="clickable"
        :label="label"
        @group="onGroup"
      />
      <ChartCanvas
        v-else
        :model="model"
        :settings="settings"
        :clickable="clickable"
        :label="label"
        @group="onGroup"
      />
      <ul v-if="legendItems.length && !asTable" class="yayaw-chart-legend" data-chart-legend>
        <li v-for="item in legendItems" :key="item.id">
          <span class="yayaw-chart-swatch" :style="{ background: item.color }" aria-hidden="true" />
          <span>{{ item.label }}</span>
          <span v-if="settings.showDataLabels && item.value !== undefined" class="yayaw-chart-muted">{{ model.format(item.value) }}</span>
        </li>
      </ul>
      <p v-if="hasTable && !asTable" class="yayaw-chart-hint" data-chart-hint>
        {{ label(hint) }}
      </p>
    </div>
  </section>
</template>
