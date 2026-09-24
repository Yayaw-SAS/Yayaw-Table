<script setup lang="ts">
import { Donut, GroupedBar, Scatter, StackedBar } from "@unovis/ts";
import {
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
import { computed } from "vue";
import type {
  ChartCategory,
  ChartLabelKey,
  ChartModel,
  ChartSeriesItem,
  ResolvedChartSettings,
} from "../chart-model";

const props = defineProps<{
  model: ChartModel;
  settings: ResolvedChartSettings;
  clickable: boolean;
  label: (key: ChartLabelKey, params?: Record<string, number | string>) => string;
}>();
const emit = defineEmits<{
  group: [category?: ChartCategory, series?: ChartSeriesItem];
}>();

const CHART_HEIGHT = 320;
const ROW_HEIGHT = 36;
const MARGIN = { top: 20, right: 24, bottom: 4, left: 8 };

interface ChartRow {
  i: number;
  id: string;
  label: string;
  color: string;
  values: number[];
}

const rows = computed<ChartRow[]>(() =>
  props.model.categories.map((category, index) => ({
    i: index,
    id: category.id,
    label: category.label,
    color: category.color,
    values: props.model.series.map((item) => category.values[item.id] ?? 0),
  }))
);
const horizontal = computed(() => props.model.type === "horizontalBar");
const stacked = computed(
  () => props.model.stacked || props.model.series.length === 1
);
const height = computed(() =>
  horizontal.value
    ? Math.max(CHART_HEIGHT, rows.value.length * ROW_HEIGHT)
    : CHART_HEIGHT
);
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
const ticks = computed(() => rows.value.map((row) => x(row)));
const tickLabel = (value: number | Date): string =>
  rows.value.find((row) => x(row) === Number(value))?.label ?? "";
const valueTick = (value: number | Date): string => props.model.format(Number(value));
const cursor = computed(() => (props.clickable ? "pointer" : "default"));

const escape = (text: string): string =>
  text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
const tooltipRows = (row: ChartRow, only?: number): string =>
  props.model.series
    .map((item, index) => ({ item, index }))
    .filter(({ index }) => only === undefined || index === only)
    .map(
      ({ item, index }) =>
        `<div class="yayaw-chart-tip-row"><span class="yayaw-chart-swatch" style="background:${seriesColor(row, index)}"></span><span class="yayaw-chart-muted">${escape(props.model.single ? props.model.valueLabel : item.label)}</span><strong>${escape(props.model.format(row.values[index] ?? 0))}</strong></div>`
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

// Single bars carry their label just past their end.
const labelOffset = computed(
  () => ((props.model.valueTicks.at(-1) ?? 1) - (props.model.valueTicks.at(0) ?? 0)) * (horizontal.value ? 0.08 : 0.04)
);
/** Data labels: at the top of single bars, in the middle of stacked segments. */
const labelSets = computed(() => {
  if (!props.settings.showDataLabels) return [];
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
</script>

<template>
  <div class="yayaw-chart-canvas" :data-chart-clickable="props.clickable ? 'true' : undefined">
    <div v-if="props.model.type === 'number'" class="yayaw-chart-figure">
      <output class="yayaw-chart-figure-value" data-chart-number>{{ props.model.format(props.model.total) }}</output>
      <span class="yayaw-chart-muted">{{ props.model.valueLabel }}</span>
    </div>
    <VisSingleContainer v-else-if="props.model.type === 'donut'" :data="donutRows" :height="CHART_HEIGHT">
      <VisDonut
        :value="(row: ChartRow) => row.values[0] ?? 0"
        :color="(row: ChartRow) => row.color"
        :arc-width="56"
        :pad-angle="0.01"
        :central-label="props.model.format(props.model.total)"
        :central-sub-label="props.label('total')"
        :events="donutEvents"
      />
      <VisTooltip :triggers="barTriggers" />
    </VisSingleContainer>
    <VisXYContainer
      v-else-if="props.model.type === 'line'"
      :data="rows"
      :height="CHART_HEIGHT"
      :margin="MARGIN"
      :x-domain="categoryDomain"
      :y-domain="valueDomain"
    >
      <VisLine :x="x" :y="ys" :color="(_rows: ChartRow[], index: number) => props.model.series[index]?.color" :line-width="2" curve-type="monotoneX" />
      <VisScatter
        v-for="(item, index) in props.model.series"
        :key="item.id"
        :x="x"
        :y="ys[index]"
        :color="item.color"
        :size="8"
        :cursor="cursor"
        :label="props.settings.showDataLabels ? (row: ChartRow) => props.model.format(row.values[index] ?? 0) : undefined"
        label-position="top"
        :events="pointEvents"
      />
      <VisAxis type="x" :tick-values="ticks" :tick-format="tickLabel" :grid-line="false" :tick-line="false" :domain-line="false" />
      <VisAxis type="y" :tick-values="props.model.valueTicks" :tick-format="valueTick" :tick-line="false" :domain-line="false" />
      <VisCrosshair :template="crosshairTemplate" :color="(_row: ChartRow, index: number) => props.model.series[index]?.color" />
      <VisTooltip />
    </VisXYContainer>
    <VisXYContainer
      v-else
      :data="rows"
      :height="height"
      :margin="MARGIN"
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
      />
      <VisAxis :type="horizontal ? 'x' : 'y'" :tick-values="props.model.valueTicks" :tick-format="valueTick" :tick-line="false" :domain-line="false" />
      <VisTooltip :triggers="barTriggers" />
    </VisXYContainer>
  </div>
</template>
