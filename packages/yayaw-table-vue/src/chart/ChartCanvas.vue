<script setup lang="ts">
import { Donut, GroupedBar, Scatter, StackedBar } from "@unovis/ts";
import {
  VisArea,
  VisAxis,
  VisCrosshair,
  VisDonut,
  VisGroupedBar,
  VisLine,
  VisScatter,
  VisSingleContainer,
  VisStackedBar,
  VisTooltip,
  VisXYContainer,
  VisXYLabels,
} from "@unovis/vue";
import { computed, ref } from "vue";
import {
  type ChartCategory,
  type ChartFillLayout,
  type ChartLabelKey,
  type ChartModel,
  type ChartSeriesItem,
  chartBarLabelRoom,
  chartTickFormat,
  chartValueText,
  type ResolvedChartSettings,
} from "../chart-model";
import ChartFunnel from "./ChartFunnel.vue";

const props = defineProps<{
  model: ChartModel;
  settings: ResolvedChartSettings;
  clickable: boolean;
  label: (key: ChartLabelKey, params?: Record<string, number | string>) => string;
  /** Set when the chart fills a box (`fill`): its size and what it keeps. */
  fill?: ChartFillLayout;
}>();
const emit = defineEmits<{
  group: [category?: ChartCategory, series?: ChartSeriesItem];
}>();

const CHART_HEIGHT = 320;
const ROW_HEIGHT = 36;
const MARGIN = { top: 20, right: 24, bottom: 4, left: 8 };
/** A small donut's hole holds the total alone. */
const SMALL_DONUT = 200;
const DONUT_RADIUS = 0.8;
const DONUT_ARC = 0.45;

interface ChartRow {
  i: number;
  id: string;
  label: string;
  color: string;
  /** Plotted values by series: shares when areas are stacked to 100 %. */
  values: number[];
}

const rows = computed<ChartRow[]>(() =>
  props.model.categories.map((category, index) => ({
    i: index,
    id: category.id,
    label: category.label,
    color: category.color,
    values: props.model.series.map((item) =>
      props.model.percent
        ? (category.shares?.[item.id] ?? 0)
        : (category.values[item.id] ?? 0)
    ),
  }))
);
const horizontal = computed(() => props.model.type === "horizontalBar");
const stacked = computed(
  () => props.model.stacked || props.model.series.length === 1
);
const height = computed(() => {
  if (props.fill) return props.fill.plotHeight;
  return horizontal.value
    ? Math.max(CHART_HEIGHT, rows.value.length * ROW_HEIGHT)
    : CHART_HEIGHT;
});
/** Values on bars and points: the setting, or what a filled chart has room for. */
const dataLabels = computed(() => (props.fill ? props.fill.dataLabels : props.settings.showDataLabels));
const valueAxis = computed(() => (props.fill ? props.fill.valueAxis : true));
// Plot margins: roomy on a page, tight when the chart fills a small box.
const margin = computed(() =>
  props.fill ? { top: dataLabels.value ? 18 : 8, right: 16, bottom: 0, left: 4 } : MARGIN
);
const donutSize = computed(() => Math.min(height.value, props.fill?.plotWidth ?? height.value));
const smallDonut = computed(() => donutSize.value < SMALL_DONUT);
const donutRadius = computed(() => (props.fill ? (donutSize.value / 2) * DONUT_RADIUS : undefined));
const donutArc = computed(() => (donutRadius.value ? donutRadius.value * DONUT_ARC : 56));
// Horizontal bars list categories from the top, as in React.
const x = (row: ChartRow): number =>
  horizontal.value ? rows.value.length - 1 - row.i : row.i;
const categoryDomain = computed<[number, number]>(() => [
  -0.5,
  Math.max(0.5, rows.value.length - 0.5),
]);
const valueDomain = computed<[number, number]>(() => [
  props.model.valueTicks.at(0) ?? 0,
  props.model.valueTicks.at(-1) ?? 1,
]);
const ys = computed(() =>
  props.model.series.map((_, index) => (row: ChartRow) => row.values[index] ?? 0)
);
const seriesColor = (row: ChartRow, index: number): string =>
  props.model.single ? row.color : (props.model.series[index]?.color ?? row.color);
// A filled chart shows every `categoryStep`-th category label.
const ticks = computed(() =>
  rows.value
    .filter((row) => row.i % (props.fill?.categoryStep ?? 1) === 0)
    .map((row) => x(row))
);
const tickLabel = (value: number | Date): string =>
  rows.value.find((row) => x(row) === Number(value))?.label ?? "";
const tickFormat = computed(() => chartTickFormat(props.model));
const valueTick = (value: number | Date): string => tickFormat.value(Number(value));
const cursor = computed(() => (props.clickable ? "pointer" : "default"));
const curveType = computed(() =>
  props.settings.curve === "linear" ? "linear" : "monotoneX"
);

const escape = (text: string): string =>
  text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
const tooltipRows = (row: ChartRow, only?: number): string =>
  props.model.series
    .map((item, index) => ({ item, index }))
    .filter(({ index }) => only === undefined || index === only)
    .map(
      ({ item, index }) =>
        `<div class="yayaw-chart-tip-row"><span class="yayaw-chart-swatch" style="background:${seriesColor(row, index)}"></span><span class="yayaw-chart-muted">${escape(props.model.single ? props.model.valueLabel : item.label)}</span><strong>${escape(chartValueText(props.model, props.model.categories[row.i], item))}</strong></div>`
    )
    .join("");
const tooltip = (row: ChartRow, only?: number): string =>
  `<div class="yayaw-chart-tip"><div class="yayaw-chart-tip-title">${escape(row.label)}</div>${tooltipRows(row, only)}</div>`;

const group = (index: unknown, seriesIndex?: unknown): void => {
  const category = props.model.categories[Number(index)];
  const series =
    seriesIndex === undefined ? undefined : props.model.series[Number(seriesIndex)];
  emit("group", category, series);
};

const stackedEvents = computed(() => ({
  [StackedBar.selectors.bar]: {
    click: (datum: { i: number; stackIndex?: number }) =>
      group(datum.i, datum.stackIndex),
  },
}));
const groupedEvents = computed(() => ({
  [GroupedBar.selectors.bar]: {
    click: (datum: ChartRow, _event: Event, index: number) => group(datum.i, index),
  },
}));
const pointEvents = computed(() => ({
  [Scatter.selectors.point]: {
    click: (datum: ChartRow) => group(datum.i),
  },
}));
const donutRows = computed(() => rows.value.filter((row) => (row.values[0] ?? 0) > 0));
const donutEvents = computed(() => ({
  [Donut.selectors.segment]: {
    click: (arc: { data: ChartRow }) => group(arc.data.i),
  },
}));
const barTriggers = computed(() => ({
  [StackedBar.selectors.bar]: (datum: ChartRow & { stackIndex?: number }) =>
    tooltip(datum, props.model.single ? undefined : datum.stackIndex),
  [GroupedBar.selectors.bar]: (datum: ChartRow) => tooltip(datum),
  [Donut.selectors.segment]: (arc: { data: ChartRow }) => tooltip(arc.data),
}));
const crosshairTemplate = (row: ChartRow): string => tooltip(row);

// Horizontal bars keep room for the longest bar's value label.
const barMargin = computed(() =>
  horizontal.value && dataLabels.value && props.model.series.length === 1
    ? { ...margin.value, right: margin.value.right + chartBarLabelRoom(props.model) }
    : margin.value
);
// Single bars carry their label just past their end.
// Labels are centered on their point: past the end of a bar by half a label
// beside horizontal bars (the category axis takes part of the width), or
// 10px above vertical ones.
const LABEL_SIDE_PX = 48;
const LABEL_TOP_PX = 10;
const labelOffset = computed(() => {
  const span = (props.model.valueTicks.at(-1) ?? 1) - (props.model.valueTicks.at(0) ?? 0);
  if (props.fill) {
    return horizontal.value
      ? (span * LABEL_SIDE_PX) / Math.max(1, props.fill.plotWidth)
      : (span * LABEL_TOP_PX) / Math.max(1, props.fill.plotHeight);
  }
  return span * (horizontal.value ? 0.08 : 0.04);
});
/** Data labels: at the top of single bars, in the middle of stacked segments. */
const labelSets = computed(() => {
  if (!dataLabels.value) return [];
  const multiple = props.model.series.length > 1;
  if (multiple && !props.model.stacked) return [];
  return props.model.series.map((_, index) => ({
    index,
    y: (row: ChartRow) => {
      const value = row.values[index] ?? 0;
      if (!multiple) return value + labelOffset.value;
      const below = row.values.slice(0, index).reduce((sum, item) => sum + item, 0);
      return below + value / 2;
    },
    label: (row: ChartRow) => {
      const value = row.values[index] ?? 0;
      return value ? props.model.format(value) : "";
    },
  }));
});

// Areas and combo charts: a click anywhere in a category's band shows its
// records, as the React chart does, from the category under the crosshair.
// The crosshair follows the pointer on the next frame, so the click reads it
// then (a tap or a quick click moves and clicks within one frame).
const hovered = ref<number>();
const onCrosshairMove = (
  _x?: number | Date,
  _datum?: ChartRow,
  index?: number
): void => {
  hovered.value = index;
};
const onBandClick = (): void => {
  requestAnimationFrame(() => {
    if (hovered.value !== undefined) group(hovered.value);
  });
};

const areaStacked = computed(() => props.model.stacked && !props.model.single);
/** The top of each area: its stacked total when stacked, its value otherwise. */
const areaTops = computed(() =>
  props.model.series.map((_, index) => (row: ChartRow) =>
    areaStacked.value
      ? row.values.slice(0, index + 1).reduce((sum, item) => sum + item, 0)
      : (row.values[index] ?? 0)
  )
);
const areaColor = (_rows: ChartRow[], index: number): string =>
  props.model.series[index]?.color ?? "";
const areaLabels = computed(() =>
  dataLabels.value
    ? props.model.series.map((item, index) => ({
        id: item.id,
        y: (row: ChartRow) => (areaTops.value[index]?.(row) ?? 0) + labelOffset.value,
        label: (row: ChartRow) => {
          const value = row.values[index] ?? 0;
          return value ? tickFormat.value(value) : "";
        },
      }))
    : []
);

// Combo charts: the line on a right axis when its unit differs, drawn in the
// left axis' domain so both share the grid lines. A container holds one value
// axis, so the right one is text placed over fixed margins.
const barSeries = computed(() => props.model.series[0]);
const lineSeries = computed(() => props.model.series[1]);
const rightTicks = computed(() => props.model.secondaryTicks ?? []);
const toLeft = (value: number): number => {
  const right = rightTicks.value;
  const low = right.at(0);
  const high = right.at(-1);
  if (low === undefined || high === undefined || high === low) return value;
  const [start, end] = valueDomain.value;
  return start + ((value - low) / (high - low)) * (end - start);
};
const barY = (row: ChartRow): number => row.values[0] ?? 0;
const lineY = (row: ChartRow): number => toLeft(row.values[1] ?? 0);
const barTick = (value: number | Date): string =>
  (barSeries.value?.format ?? props.model.format)(Number(value));
const lineTick = (value: number): string =>
  (lineSeries.value?.format ?? props.model.format)(value);
/** Width of axis labels, estimated from their length at 12px. */
const AXIS_CHAR_WIDTH = 7.5;
const AXIS_PADDING = 14;
const X_AXIS_HEIGHT = 28;
const axisWidth = (labels: string[]): number =>
  AXIS_PADDING + Math.max(0, ...labels.map((text) => text.length)) * AXIS_CHAR_WIDTH;
const dualMargin = computed(() => ({
  top: MARGIN.top,
  bottom: X_AXIS_HEIGHT,
  left: MARGIN.left + axisWidth(props.model.valueTicks.map((tick) => barTick(tick))),
  right: MARGIN.left + axisWidth(rightTicks.value.map(lineTick)),
}));
/** The right axis' labels, at their ticks' heights in the plot. */
const rightLabels = computed(() => {
  const ticks = rightTicks.value;
  const low = ticks.at(0) ?? 0;
  const span = (ticks.at(-1) ?? 1) - low || 1;
  const { top, bottom, right } = dualMargin.value;
  const plot = height.value - top - bottom;
  return ticks.map((tick) => ({
    text: lineTick(tick),
    top: `${top + (1 - (tick - low) / span) * plot}px`,
    width: `${right - MARGIN.left}px`,
  }));
});
const comboBarLabel = (row: ChartRow): string => {
  const value = barY(row);
  return value ? barTick(value) : "";
};
const comboLineLabel = (row: ChartRow): string =>
  (lineSeries.value?.format ?? props.model.format)(row.values[1] ?? 0);
</script>

<template>
  <div
    class="yayaw-chart-canvas"
    :data-chart-clickable="props.clickable ? 'true' : undefined"
    :data-small-donut="props.model.type === 'donut' && smallDonut ? '' : undefined"
  >
    <div v-if="props.model.type === 'number'" class="yayaw-chart-figure" :data-fill="props.fill ? '' : undefined">
      <output class="yayaw-chart-figure-value" data-chart-number>{{ props.model.format(props.model.total) }}</output>
      <span class="yayaw-chart-muted">{{ props.model.valueLabel }}</span>
    </div>
    <ChartFunnel
      v-else-if="props.model.type === 'funnel'"
      :model="props.model"
      :clickable="props.clickable"
      :label="props.label"
      @group="(category) => emit('group', category)"
    />
    <VisSingleContainer v-else-if="props.model.type === 'donut'" :data="donutRows" :height="height">
      <VisDonut
        :value="(row: ChartRow) => row.values[0] ?? 0"
        :color="(row: ChartRow) => row.color"
        :radius="donutRadius"
        :arc-width="donutArc"
        :pad-angle="0.01"
        :central-label="props.model.format(props.model.total)"
        :central-sub-label="smallDonut ? '' : props.label('total')"
        :events="donutEvents"
      />
      <VisTooltip :triggers="barTriggers" />
    </VisSingleContainer>
    <VisXYContainer
      v-else-if="props.model.type === 'line'"
      :data="rows"
      :height="height"
      :margin="margin"
      :x-domain="categoryDomain"
      :y-domain="valueDomain"
    >
      <VisLine :x="x" :y="ys" :color="(_rows: ChartRow[], index: number) => props.model.series[index]?.color" :line-width="2" :curve-type="curveType" />
      <VisScatter
        v-for="(item, index) in props.model.series"
        :key="item.id"
        :x="x"
        :y="ys[index]"
        :color="item.color"
        :size="8"
        :cursor="cursor"
        :label="dataLabels ? (row: ChartRow) => props.model.format(row.values[index] ?? 0) : undefined"
        label-position="top"
        :events="pointEvents"
      />
      <VisAxis type="x" :tick-values="ticks" :tick-format="tickLabel" :tick-text-hide-overlapping="true" :grid-line="false" :tick-line="false" :domain-line="false" />
      <VisAxis v-if="valueAxis" type="y" :tick-values="props.model.valueTicks" :tick-format="valueTick" :tick-line="false" :domain-line="false" />
      <VisCrosshair :template="crosshairTemplate" :color="(_row: ChartRow, index: number) => props.model.series[index]?.color" />
      <VisTooltip />
    </VisXYContainer>
    <div
      v-else-if="props.model.type === 'area'"
      class="yayaw-chart-band"
      data-chart-area
      @click="onBandClick"
    >
      <VisXYContainer
        :data="rows"
        :height="height"
        :margin="margin"
        :x-domain="categoryDomain"
        :y-domain="valueDomain"
      >
        <VisArea
          v-if="areaStacked"
          :x="x"
          :y="ys"
          :color="areaColor"
          :opacity="0.6"
          :curve-type="curveType"
          :line="true"
          :line-width="2"
        />
        <template v-else>
          <VisArea
            v-for="(item, index) in props.model.series"
            :key="item.id"
            :x="x"
            :y="ys[index]"
            :color="item.color"
            :opacity="0.3"
            :curve-type="curveType"
            :line="true"
            :line-width="2"
          />
        </template>
        <VisXYLabels
          v-for="set in areaLabels"
          :key="set.id"
          :x="x"
          :y="set.y"
          :label="set.label"
          background-color="transparent"
          color="var(--yayaw-foreground)"
          :label-font-size="11"
        />
        <VisAxis type="x" :tick-values="ticks" :tick-format="tickLabel" :tick-text-hide-overlapping="true" :grid-line="false" :tick-line="false" :domain-line="false" />
        <VisAxis v-if="valueAxis" type="y" :tick-values="props.model.valueTicks" :tick-format="valueTick" :tick-line="false" :domain-line="false" />
        <!-- Crosshair options are passed as they are named (camelCase). -->
        <VisCrosshair
          :template="crosshairTemplate"
          :x="x"
          :y="areaStacked ? undefined : ys"
          :yStacked="areaStacked ? ys : undefined"
          :color="(_row: ChartRow, index: number) => props.model.series[index]?.color"
          :onCrosshairMove="onCrosshairMove"
        />
        <VisTooltip />
      </VisXYContainer>
    </div>
    <div
      v-else-if="props.model.type === 'combo'"
      class="yayaw-chart-band"
      data-chart-combo
      @click="onBandClick"
    >
      <VisXYContainer
        :data="rows"
        :height="height"
        :margin="rightTicks.length ? dualMargin : margin"
        :auto-margin="!rightTicks.length"
        :x-domain="categoryDomain"
        :y-domain="valueDomain"
      >
        <VisStackedBar
          :x="x"
          :y="[barY]"
          :color="barSeries?.color"
          :rounded-corners="4"
          :bar-padding="0.2"
          :bar-max-width="64"
          :cursor="cursor"
        />
        <VisLine :x="x" :y="lineY" :color="lineSeries?.color" :line-width="2" :curve-type="curveType" />
        <VisScatter
          :x="x"
          :y="lineY"
          :color="lineSeries?.color"
          :size="8"
          :cursor="cursor"
          :label="dataLabels ? comboLineLabel : undefined"
          label-position="top"
        />
        <VisXYLabels
          v-if="dataLabels"
          :x="x"
          :y="(row: ChartRow) => barY(row) + labelOffset"
          :label="comboBarLabel"
          background-color="transparent"
          color="var(--yayaw-foreground)"
          :label-font-size="11"
        />
        <!-- Fixed margins (two value axes) keep category labels on one line. -->
        <VisAxis
          type="x"
          :tick-values="ticks"
          :tick-format="tickLabel"
          :tick-text-fit-mode="rightTicks.length ? 'trim' : 'wrap'"
          :grid-line="false"
          :tick-line="false"
          :domain-line="false"
        />
        <VisAxis type="y" :tick-values="props.model.valueTicks" :tick-format="barTick" :tick-line="false" :domain-line="false" />
        <VisCrosshair
          :template="crosshairTemplate"
          :x="x"
          :y="[lineY]"
          :color="() => lineSeries?.color"
          :onCrosshairMove="onCrosshairMove"
        />
        <VisTooltip />
      </VisXYContainer>
      <div v-if="rightTicks.length" class="yayaw-chart-right-axis" aria-hidden="true">
        <span
          v-for="tick in rightLabels"
          :key="tick.text"
          :style="{ top: tick.top, width: tick.width }"
        >{{ tick.text }}</span>
      </div>
    </div>
    <VisXYContainer
      v-else
      :data="rows"
      :height="height"
      :margin="barMargin"
      :x-domain="horizontal ? valueDomain : categoryDomain"
      :y-domain="horizontal ? categoryDomain : valueDomain"
    >
      <VisStackedBar
        v-if="stacked"
        :x="x"
        :y="ys"
        :color="seriesColor"
        :orientation="horizontal ? 'horizontal' : 'vertical'"
        :rounded-corners="props.model.series.length > 1 ? 0 : 4"
        :bar-padding="0.2"
        :bar-max-width="64"
        :cursor="cursor"
        :events="stackedEvents"
      />
      <VisGroupedBar
        v-else
        :x="x"
        :y="ys"
        :color="seriesColor"
        :orientation="horizontal ? 'horizontal' : 'vertical'"
        :rounded-corners="4"
        :group-padding="0.2"
        :bar-max-width="64"
        :cursor="cursor"
        :events="groupedEvents"
      />
      <template v-if="labelSets.length">
        <VisXYLabels
          v-for="set in labelSets"
          :key="set.index"
          :x="horizontal ? set.y : x"
          :y="horizontal ? x : set.y"
          :label="set.label"
          background-color="transparent"
          color="var(--yayaw-foreground)"
          :label-font-size="11"
        />
      </template>
      <VisAxis
        :type="horizontal ? 'y' : 'x'"
        :tick-values="ticks"
        :tick-format="tickLabel"
        :grid-line="false"
        :tick-line="false"
        :domain-line="false"
        :tick-text-hide-overlapping="Boolean(props.fill)"
      />
      <VisAxis v-if="valueAxis" :type="horizontal ? 'x' : 'y'" :tick-values="props.model.valueTicks" :tick-format="valueTick" :tick-line="false" :domain-line="false" />
      <VisTooltip :triggers="barTriggers" />
    </VisXYContainer>
  </div>
</template>
