"use client";

import { Table2 } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { Button } from "@/src/components/ui/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/src/components/ui/chart";
import type { DisplayModeRenderContext } from "@/src/components/ui/yayaw-table/types/display-mode-renderer";
import {
  buildChartModel,
  type ChartCategory,
  type ChartDataResult,
  type ChartFillLayout,
  type ChartLabelKey,
  type ChartModel,
  type ChartSeriesItem,
  type ChartViewSettings,
  canAddChartFilters,
  chartAggregateRequest,
  chartBarLabelRoom,
  chartFillLayout,
  chartGroupFilters,
  chartLabel,
  chartTickFormat,
  chartValueText,
  loadChartData,
  type ResolvedChartSettings,
  resolveChartSettings,
} from "@/src/components/ui/yayaw-table/utils/chart-model";
import { FunnelChart, FunnelDataTable } from "./chart-funnel";

/** The host's shadcn chart tokens, light and dark. */
const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
const OTHER_COLOR = "var(--muted-foreground)";
const CHART_HEIGHT = 320;
const ROW_HEIGHT = 36;
const AXIS_WIDTH = 120;
/** A filled chart's category axis takes at most this share of its width. */
const FILL_AXIS_SHARE = 0.35;
const SMALL_DONUT = 200;

// Layout effects measure before paint in the browser; the server skips them.
const useBrowserLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/** The size of an element, kept up to date. */
function useBoxSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useBrowserLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      setSize((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height }
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, size };
}

const valueDomain = (model: ChartModel): [number, number] => [
  model.valueTicks.at(0) ?? 0,
  model.valueTicks.at(-1) ?? 1,
];

type Label = (
  key: ChartLabelKey,
  params?: Record<string, number | string>
) => string;
type GroupClick = (category?: ChartCategory, series?: ChartSeriesItem) => void;

interface ChartState {
  result?: ChartDataResult;
  error?: string;
  loading: boolean;
}

/** Groups from `actions.aggregate`, or computed over the rows matching the query. */
function useChartResult(
  context: DisplayModeRenderContext,
  settings: ResolvedChartSettings
): ChartState {
  const [state, setState] = useState<ChartState>({ loading: true });
  const { aggregate, columns, list, listParams, locale, revision } = context;
  const pageRows = list ? undefined : context.rows;
  const request = useMemo(
    () => chartAggregateRequest(settings, columns),
    [columns, settings]
  );
  const requestKey = JSON.stringify(request ?? null);
  useEffect(() => {
    const parsed = JSON.parse(requestKey) as ReturnType<
      typeof chartAggregateRequest
    > | null;
    if (!parsed || revision < 0) {
      setState({ loading: false });
      return;
    }
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true }));
    loadChartData({
      aggregate: aggregate as
        | ((params: Record<string, unknown>) => unknown)
        | undefined,
      list,
      rows: pageRows,
      params: listParams,
      request: parsed,
      locale,
      signal: controller.signal,
    })
      .then((result) => setState({ result, loading: false }))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            error: reason instanceof Error ? reason.message : String(reason),
            loading: false,
          });
        }
      });
    return () => controller.abort();
  }, [aggregate, list, listParams, locale, pageRows, requestKey, revision]);
  return state;
}

/** Series keys safe as Recharts data keys and CSS names. */
const seriesKey = (index: number) => `s${index}`;
/** Recharts curve of lines and areas. */
const curveOf = (settings: ResolvedChartSettings) =>
  settings.curve === "linear" ? "linear" : "monotone";

/** One row per category; areas stacked to 100 % plot each series' share. */
function chartRows(model: ChartModel) {
  return model.categories.map((category) => {
    const row: Record<string, number | string> = {
      id: category.id,
      label: category.label,
    };
    for (const [index, item] of model.series.entries()) {
      row[seriesKey(index)] = model.percent
        ? (category.shares?.[item.id] ?? 0)
        : (category.values[item.id] ?? 0);
    }
    return row;
  });
}

/**
 * Clicking a category's band (bars, points, areas) shows its records. The
 * charts using it process pointer moves as they come (`throttledEvents`
 * empty), so a tap or a quick click reads the category under the pointer.
 */
const categoryClick =
  (model: ChartModel, onGroup: GroupClick) =>
  (state: { activeTooltipIndex?: unknown } | null) => {
    const active = state?.activeTooltipIndex;
    const index =
      active === null || active === undefined || active === ""
        ? Number.NaN
        : Number(active);
    if (Number.isInteger(index)) {
      onGroup(model.categories.at(index));
    }
  };
/** No throttled pointer events: see `categoryClick`. */
const IMMEDIATE_EVENTS: [] = [];

function chartConfig(model: ChartModel): ChartConfig {
  return Object.fromEntries(
    model.series.map((item, index) => [
      seriesKey(index),
      { label: item.label, color: item.color },
    ])
  );
}

function TooltipBody({
  active,
  label,
  model,
  payload,
}: {
  active?: boolean;
  label?: unknown;
  model: ChartModel;
  payload?: readonly {
    dataKey?: unknown;
    value?: unknown;
    payload?: Record<string, unknown>;
  }[];
}) {
  if (!(active && payload?.length)) {
    return null;
  }
  const title =
    typeof label === "string" || typeof label === "number"
      ? String(label)
      : String(payload.at(0)?.payload?.label ?? "");
  return (
    <div className="grid min-w-32 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{title}</div>
      {payload.map((entry) => {
        const index = Number(String(entry.dataKey ?? "s0").slice(1));
        const series = model.series.at(Number.isFinite(index) ? index : 0);
        const category = model.categories.find(
          (item) => item.id === entry.payload?.id
        );
        const color =
          model.type === "donut" || model.single
            ? (category?.color ?? series?.color)
            : series?.color;
        return (
          <div
            className="flex items-center gap-2"
            key={String(entry.dataKey ?? entry.payload?.id)}
          >
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-[2px]"
              style={{ background: color }}
            />
            <span className="text-muted-foreground">
              {model.single ? model.valueLabel : series?.label}
            </span>
            <span className="ml-auto font-medium font-mono tabular-nums">
              {category
                ? chartValueText(model, category, series)
                : model.format(Number(entry.value ?? 0))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Plot margins: roomy on a page, tight when the chart fills a small box. */
const chartMargin = (
  fill: ChartFillLayout | undefined,
  labels: boolean,
  right = fill ? 16 : 24
) =>
  fill
    ? { top: labels ? 18 : 8, right, left: 4, bottom: 0 }
    : { top: 20, right, left: 8, bottom: 4 };
/** In a filled chart, category labels that would overlap are skipped. */
const FILL_INTERVAL = "preserveStartEnd";

function BarsChart({
  model,
  settings,
  onGroup,
  clickable,
  fill,
}: {
  model: ChartModel;
  settings: ResolvedChartSettings;
  onGroup: GroupClick;
  clickable: boolean;
  /** Set when the chart fills a box (`fill`): its size and what it keeps. */
  fill?: ChartFillLayout;
}) {
  const horizontal = model.type === "horizontalBar";
  const rows = chartRows(model);
  const stacked = model.stacked && model.series.length > 1;
  const labels = fill ? fill.dataLabels : settings.showDataLabels;
  let labelPosition: "center" | "right" | "top" = "top";
  if (stacked) {
    labelPosition = "center";
  } else if (horizontal) {
    labelPosition = "right";
  }
  let height = horizontal
    ? Math.max(CHART_HEIGHT, rows.length * ROW_HEIGHT)
    : CHART_HEIGHT;
  if (fill) {
    height = fill.plotHeight;
  }
  const categoryInterval = fill ? FILL_INTERVAL : undefined;
  return (
    <ChartContainer
      className="aspect-auto w-full"
      config={chartConfig(model)}
      style={{ height }}
    >
      <BarChart
        accessibilityLayer
        data={rows}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={chartMargin(
          fill,
          labels,
          // Horizontal bars keep room for the longest bar's value label.
          (fill ? 16 : 24) +
            (horizontal && labels && !stacked ? chartBarLabelRoom(model) : 0)
        )}
      >
        {/* Without a value axis (values on the bars), no grid lines either. */}
        {fill && !fill.valueAxis ? null : (
          <CartesianGrid horizontal={!horizontal} vertical={horizontal} />
        )}
        {horizontal ? (
          <>
            <XAxis
              axisLine={false}
              domain={valueDomain(model)}
              hide={fill ? !fill.valueAxis : false}
              tickFormatter={(value: number) => model.format(value)}
              tickLine={false}
              ticks={model.valueTicks}
              type="number"
            />
            <YAxis
              axisLine={false}
              dataKey="label"
              interval={categoryInterval}
              tickLine={false}
              type="category"
              width={
                fill
                  ? Math.min(AXIS_WIDTH, fill.plotWidth * FILL_AXIS_SHARE)
                  : AXIS_WIDTH
              }
            />
          </>
        ) : (
          <>
            <XAxis
              axisLine={false}
              dataKey="label"
              interval={categoryInterval}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              axisLine={false}
              domain={valueDomain(model)}
              hide={fill ? !fill.valueAxis : false}
              tickFormatter={(value: number) => model.format(value)}
              tickLine={false}
              ticks={model.valueTicks}
              type="number"
              width="auto"
            />
          </>
        )}
        <ChartTooltip
          content={<TooltipBody model={model} />}
          cursor={{ fillOpacity: 0.4 }}
        />
        {model.series.map((item, index) => (
          <Bar
            className={clickable ? "cursor-pointer" : undefined}
            dataKey={seriesKey(index)}
            fill={item.color}
            isAnimationActive={false}
            key={item.id}
            maxBarSize={64}
            name={item.label}
            onClick={(_data: unknown, categoryIndex: number) =>
              onGroup(model.categories.at(categoryIndex), item)
            }
            radius={stacked ? 0 : 4}
            stackId={stacked ? "stack" : undefined}
          >
            {model.single
              ? model.categories.map((category) => (
                  <Cell fill={category.color} key={category.id} />
                ))
              : null}
            {labels ? (
              <LabelList
                className="fill-foreground"
                dataKey={seriesKey(index)}
                fontSize={11}
                formatter={(value: unknown) =>
                  Number(value) ? model.format(Number(value)) : ""
                }
                position={labelPosition}
              />
            ) : null}
          </Bar>
        ))}
      </BarChart>
    </ChartContainer>
  );
}

/** Space before the first and after the last point of a line. */
const LINE_PADDING = 40;
const FILL_LINE_PADDING = 24;

function LinesChart({
  model,
  settings,
  onGroup,
  fill,
}: {
  model: ChartModel;
  settings: ResolvedChartSettings;
  onGroup: GroupClick;
  fill?: ChartFillLayout;
}) {
  const labels = fill?.dataLabels ?? settings.showDataLabels;
  const padding = fill ? FILL_LINE_PADDING : LINE_PADDING;
  return (
    <ChartContainer
      className="aspect-auto w-full"
      config={chartConfig(model)}
      style={{ height: fill ? fill.plotHeight : CHART_HEIGHT }}
    >
      <LineChart
        accessibilityLayer
        data={chartRows(model)}
        margin={chartMargin(fill, labels)}
        onClick={categoryClick(model, onGroup)}
        throttledEvents={IMMEDIATE_EVENTS}
      >
        {fill && !fill.valueAxis ? null : <CartesianGrid vertical={false} />}
        {/* Labels that would overlap on narrow charts are skipped. */}
        <XAxis
          axisLine={false}
          dataKey="label"
          interval={fill ? FILL_INTERVAL : undefined}
          padding={{ left: padding, right: padding }}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          axisLine={false}
          domain={valueDomain(model)}
          hide={fill ? !fill.valueAxis : false}
          tickFormatter={(value: number) => model.format(value)}
          tickLine={false}
          ticks={model.valueTicks}
          type="number"
          width="auto"
        />
        <ChartTooltip content={<TooltipBody model={model} />} />
        {model.series.map((item, index) => (
          <Line
            activeDot={{ r: 6, className: "cursor-pointer" }}
            dataKey={seriesKey(index)}
            dot={{ r: 3, fill: item.color }}
            isAnimationActive={false}
            key={item.id}
            name={item.label}
            stroke={item.color}
            strokeWidth={2}
            type={curveOf(settings)}
          >
            {labels ? (
              <LabelList
                className="fill-foreground"
                dataKey={seriesKey(index)}
                fontSize={11}
                formatter={(value: unknown) => model.format(Number(value))}
                offset={10}
                position="top"
              />
            ) : null}
          </Line>
        ))}
      </LineChart>
    </ChartContainer>
  );
}

/** Areas: one per series, stacked (as values or shares of 100 %) or overlapping. */
function AreasChart({
  model,
  settings,
  onGroup,
  fill,
}: {
  model: ChartModel;
  settings: ResolvedChartSettings;
  onGroup: GroupClick;
  fill?: ChartFillLayout;
}) {
  const stacked = model.stacked && !model.single;
  const tickFormat = chartTickFormat(model);
  const labels = fill?.dataLabels ?? settings.showDataLabels;
  const padding = fill ? FILL_LINE_PADDING : LINE_PADDING;
  return (
    <ChartContainer
      className="aspect-auto w-full"
      config={chartConfig(model)}
      style={{ height: fill ? fill.plotHeight : CHART_HEIGHT }}
    >
      <AreaChart
        accessibilityLayer
        data={chartRows(model)}
        margin={chartMargin(fill, labels)}
        onClick={categoryClick(model, onGroup)}
        throttledEvents={IMMEDIATE_EVENTS}
      >
        {fill && !fill.valueAxis ? null : <CartesianGrid vertical={false} />}
        {/* Labels that would overlap on narrow charts are skipped. */}
        <XAxis
          axisLine={false}
          dataKey="label"
          interval={fill ? FILL_INTERVAL : undefined}
          padding={{ left: padding, right: padding }}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          axisLine={false}
          domain={valueDomain(model)}
          hide={fill ? !fill.valueAxis : false}
          tickFormatter={(value: number) => tickFormat(value)}
          tickLine={false}
          ticks={model.valueTicks}
          type="number"
          width="auto"
        />
        <ChartTooltip content={<TooltipBody model={model} />} />
        {model.series.map((item, index) => (
          <Area
            activeDot={{ r: 5, className: "cursor-pointer" }}
            dataKey={seriesKey(index)}
            fill={item.color}
            fillOpacity={stacked ? 0.6 : 0.3}
            isAnimationActive={false}
            key={item.id}
            name={item.label}
            stackId={stacked ? "stack" : undefined}
            stroke={item.color}
            strokeWidth={2}
            type={curveOf(settings)}
          >
            {labels ? (
              <LabelList
                className="fill-foreground"
                dataKey={seriesKey(index)}
                fontSize={11}
                formatter={(value: unknown) =>
                  Number(value) ? tickFormat(Number(value)) : ""
                }
                offset={8}
                position="top"
              />
            ) : null}
          </Area>
        ))}
      </AreaChart>
    </ChartContainer>
  );
}

/** A combo chart's series, formats and axes, as a filled chart has room for. */
function comboLayout(
  model: ChartModel,
  settings: ResolvedChartSettings,
  fill: ChartFillLayout | undefined
) {
  const [bars, line] = model.series;
  const valueAxis = fill?.valueAxis ?? true;
  const secondary = model.secondaryTicks;
  return {
    bars,
    line,
    valueAxis,
    secondary,
    right: valueAxis && secondary,
    lineAxis: secondary ? ("right" as const) : ("left" as const),
    barFormat: bars?.format ?? model.format,
    lineFormat: line?.format ?? model.format,
    labels: fill?.dataLabels ?? settings.showDataLabels,
  };
}

/** Bars for one metric and a line for another, on a second axis when their units differ. */
function ComboChart({
  model,
  settings,
  onGroup,
  clickable,
  fill,
}: {
  model: ChartModel;
  settings: ResolvedChartSettings;
  onGroup: GroupClick;
  clickable: boolean;
  fill?: ChartFillLayout;
}) {
  const {
    bars,
    barFormat,
    labels,
    line,
    lineAxis,
    lineFormat,
    right,
    secondary,
    valueAxis,
  } = comboLayout(model, settings, fill);
  return (
    <ChartContainer
      className="aspect-auto w-full"
      config={chartConfig(model)}
      style={{ height: fill ? fill.plotHeight : CHART_HEIGHT }}
    >
      <ComposedChart
        accessibilityLayer
        data={chartRows(model)}
        margin={chartMargin(fill, labels, right ? 8 : undefined)}
        onClick={categoryClick(model, onGroup)}
        throttledEvents={IMMEDIATE_EVENTS}
      >
        {valueAxis ? <CartesianGrid vertical={false} /> : null}
        <XAxis
          axisLine={false}
          dataKey="label"
          interval={fill ? FILL_INTERVAL : undefined}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          axisLine={false}
          domain={valueDomain(model)}
          hide={!valueAxis}
          tickFormatter={(value: number) => barFormat(value)}
          tickLine={false}
          ticks={model.valueTicks}
          type="number"
          width="auto"
          yAxisId="left"
        />
        {secondary ? (
          <YAxis
            axisLine={false}
            domain={[secondary.at(0) ?? 0, secondary.at(-1) ?? 1]}
            hide={!right}
            orientation="right"
            tickFormatter={(value: number) => lineFormat(value)}
            tickLine={false}
            ticks={secondary}
            type="number"
            width="auto"
            yAxisId="right"
          />
        ) : null}
        <ChartTooltip
          content={<TooltipBody model={model} />}
          cursor={{ fillOpacity: 0.4 }}
        />
        {bars ? (
          <Bar
            className={clickable ? "cursor-pointer" : undefined}
            dataKey={seriesKey(0)}
            fill={bars.color}
            isAnimationActive={false}
            maxBarSize={64}
            name={bars.label}
            radius={4}
            yAxisId="left"
          >
            {labels ? (
              <LabelList
                className="fill-foreground"
                dataKey={seriesKey(0)}
                fontSize={11}
                formatter={(value: unknown) =>
                  Number(value) ? barFormat(Number(value)) : ""
                }
                position="top"
              />
            ) : null}
          </Bar>
        ) : null}
        {line ? (
          <Line
            activeDot={{ r: 6, className: "cursor-pointer" }}
            dataKey={seriesKey(1)}
            dot={{ r: 3, fill: line.color }}
            isAnimationActive={false}
            name={line.label}
            stroke={line.color}
            strokeWidth={2}
            type={curveOf(settings)}
            yAxisId={lineAxis}
          >
            {labels ? (
              <LabelList
                className="fill-foreground"
                dataKey={seriesKey(1)}
                fontSize={11}
                formatter={(value: unknown) => lineFormat(Number(value))}
                offset={10}
                position="top"
              />
            ) : null}
          </Line>
        ) : null}
      </ComposedChart>
    </ChartContainer>
  );
}

function DonutChart({
  model,
  onGroup,
  clickable,
  label,
  fill,
}: {
  model: ChartModel;
  onGroup: GroupClick;
  clickable: boolean;
  label: Label;
  fill?: ChartFillLayout;
}) {
  const data = model.categories
    .filter((category) => category.total > 0)
    .map((category) => ({
      id: category.id,
      label: category.label,
      value: category.total,
    }));
  const height = fill ? fill.plotHeight : CHART_HEIGHT;
  // A small donut's hole holds the total alone.
  const small = Math.min(height, fill?.plotWidth ?? height) < SMALL_DONUT;
  return (
    <ChartContainer
      className="aspect-auto w-full"
      config={chartConfig(model)}
      style={{ height }}
    >
      <PieChart accessibilityLayer>
        <ChartTooltip content={<TooltipBody model={model} />} />
        <Pie
          className={clickable ? "cursor-pointer" : undefined}
          data={data}
          dataKey="value"
          innerRadius="55%"
          isAnimationActive={false}
          nameKey="label"
          onClick={(_data: unknown, index: number) =>
            onGroup(
              model.categories.find((category) => category.id === data.at(index)?.id)
            )
          }
          outerRadius="80%"
          strokeWidth={2}
        >
          {data.map((item) => (
            <Cell
              fill={
                model.categories.find((category) => category.id === item.id)
                  ?.color
              }
              key={item.id}
              stroke="var(--background)"
            />
          ))}
        </Pie>
        <text
          className={cn(
            "fill-foreground font-semibold",
            small ? "text-base" : "text-2xl"
          )}
          dominantBaseline="middle"
          dy={small ? 0 : -6}
          textAnchor="middle"
          x="50%"
          y="50%"
        >
          {model.format(model.total)}
        </text>
        {small ? null : (
          <text
            className="fill-muted-foreground text-xs"
            dominantBaseline="middle"
            dy={16}
            textAnchor="middle"
            x="50%"
            y="50%"
          >
            {label("total")}
          </text>
        )}
      </PieChart>
    </ChartContainer>
  );
}

function NumberChart({
  model,
  fill,
}: {
  model: ChartModel;
  fill?: ChartFillLayout;
}) {
  return (
    <div
      className={cn(
        "grid place-items-center gap-1 text-center",
        fill ? "h-full content-center" : "py-12"
      )}
    >
      <output
        className={cn(
          "font-semibold tabular-nums tracking-tight",
          fill ? "text-4xl" : "text-5xl"
        )}
        data-chart-number
      >
        {model.format(model.total)}
      </output>
      <span className="text-muted-foreground text-sm">{model.valueLabel}</span>
    </div>
  );
}

/** Legend entries: a donut's slices with their values, else the series. */
/** Legend entries: donut slices and funnel stages with their values, else the series. */
function legendItems(
  model: ChartModel
): { id: string; label: string; color: string; value?: number }[] {
  if (model.type === "donut") {
    return model.categories
      .filter((category) => category.total > 0)
      .map((category) => ({ ...category, value: category.total }));
  }
  if (model.type === "funnel") {
    return model.stages ?? [];
  }
  return model.series.map((item) => ({ ...item, value: undefined }));
}

function ChartLegend({
  model,
  values,
  side,
}: {
  model: ChartModel;
  /** Show each entry's value (donut slices). */
  values: boolean;
  /** Beside the chart, one entry per line, this wide (px). */
  side?: number;
}) {
  return (
    <ul
      className={cn(
        "flex text-xs",
        side
          ? "shrink-0 flex-col justify-center gap-1"
          : "flex-wrap items-center justify-center gap-x-4 gap-y-1"
      )}
      data-chart-legend
      data-placement={side ? "right" : "bottom"}
      style={side ? { width: side } : undefined}
    >
      {legendItems(model).map((item) => (
        <li className="flex min-w-0 items-center gap-1.5" key={item.id}>
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-[2px]"
            style={{ background: item.color }}
          />
          <span className={side ? "min-w-0 truncate" : undefined}>
            {item.label}
          </span>
          {values && item.value !== undefined ? (
            <span
              className={cn(
                "text-muted-foreground tabular-nums",
                side && "ml-auto"
              )}
            >
              {model.format(item.value)}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** The chart's numbers as a table; each group opens its records. */
function ChartDataTable({
  model,
  onGroup,
  clickable,
  label,
}: {
  model: ChartModel;
  onGroup: GroupClick;
  clickable: boolean;
  label: Label;
}) {
  const withSeries = !model.single;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm" data-chart-table>
        <caption className="sr-only">{model.title}</caption>
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium" scope="col">
              {model.xLabel || label("group")}
            </th>
            {model.series.map((item) => (
              <th className="px-3 py-2 text-right font-medium" key={item.id} scope="col">
                {withSeries ? item.label : model.valueLabel}
              </th>
            ))}
            {model.totalColumn ? (
              <th className="px-3 py-2 text-right font-medium" scope="col">
                {label("total")}
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {model.categories.map((category) => (
            <tr className="border-t" key={category.id}>
              <th className="px-3 py-1.5 text-left font-normal" scope="row">
                {clickable && !category.other ? (
                  <Button
                    aria-label={label("showRecords", { group: category.label })}
                    className="h-auto px-0 py-0 font-normal"
                    onClick={() => onGroup(category)}
                    type="button"
                    variant="link"
                  >
                    {category.label}
                  </Button>
                ) : (
                  category.label
                )}
              </th>
              {model.series.map((item) => (
                <td className="px-3 py-1.5 text-right tabular-nums" key={item.id}>
                  {chartValueText(model, category, item)}
                </td>
              ))}
              {model.totalColumn ? (
                <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                  {model.format(category.total)}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartBody({
  model,
  settings,
  onGroup,
  clickable,
  label,
  fill,
}: {
  model: ChartModel;
  settings: ResolvedChartSettings;
  onGroup: GroupClick;
  clickable: boolean;
  label: Label;
  fill?: ChartFillLayout;
}) {
  switch (model.type) {
    case "number":
      return <NumberChart fill={fill} model={model} />;
    case "donut":
      return (
        <DonutChart
          clickable={clickable}
          fill={fill}
          label={label}
          model={model}
          onGroup={onGroup}
        />
      );
    case "line":
      return (
        <LinesChart
          fill={fill}
          model={model}
          onGroup={onGroup}
          settings={settings}
        />
      );
    case "area":
      return (
        <AreasChart
          fill={fill}
          model={model}
          onGroup={onGroup}
          settings={settings}
        />
      );
    case "combo":
      return (
        <ComboChart
          clickable={clickable}
          fill={fill}
          model={model}
          onGroup={onGroup}
          settings={settings}
        />
      );
    case "funnel":
      return (
        <FunnelChart
          clickable={clickable}
          label={label}
          model={model}
          onGroup={onGroup}
        />
      );
    default:
      return (
        <BarsChart
          clickable={clickable}
          fill={fill}
          model={model}
          onGroup={onGroup}
          settings={settings}
        />
      );
  }
}

/** Whether the chart shows a legend: a donut's slices, or several series. */
const hasLegend = (model: ChartModel, settings: ResolvedChartSettings) =>
  settings.showLegend &&
  (model.type === "donut" ||
    model.type === "funnel" ||
    (model.type !== "number" && !model.single));

/**
 * A chart filling its box (`fill`): the legend beside, under or out of the
 * chart and data labels as the room allows; no title, toggle or hint.
 */
function FilledChart({
  model,
  settings,
  clickable,
  loading,
  onGroup,
  label,
}: {
  model: ChartModel;
  settings: ResolvedChartSettings;
  clickable: boolean;
  loading: boolean;
  onGroup: GroupClick;
  label: Label;
}) {
  const box = useBoxSize();
  const legend = hasLegend(model, settings) ? legendItems(model).length : 0;
  const layout = chartFillLayout({
    width: box.size.width,
    height: box.size.height,
    type: model.type,
    categories: model.categories.length,
    legendItems: legend,
    showDataLabels: settings.showDataLabels,
  });
  const ready = box.size.width > 0 && box.size.height > 0;
  return (
    <div
      className={cn("relative min-h-0 flex-1", loading && "opacity-60")}
      data-chart-legend-placement={layout.legend}
      ref={box.ref}
    >
      {ready ? (
        <div
          className={cn(
            "absolute inset-0 flex gap-2",
            layout.legend === "right" ? "flex-row items-center" : "flex-col"
          )}
        >
          <div
            className="min-w-0"
            style={{ height: layout.plotHeight, width: layout.plotWidth }}
          >
            <ChartBody
              clickable={clickable}
              fill={layout}
              label={label}
              model={model}
              onGroup={onGroup}
              settings={settings}
            />
          </div>
          {layout.legend === "none" ? null : (
            <ChartLegend
              model={model}
              side={layout.legend === "right" ? layout.legendWidth : undefined}
              values={layout.dataLabels}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

function ChartMessage({ children, alert }: { children: string; alert?: boolean }) {
  return alert ? (
    <div className="text-destructive text-sm" role="alert">
      {children}
    </div>
  ) : (
    <output className="block text-muted-foreground text-sm">{children}</output>
  );
}

/** Chart, or its table fallback, with the legend and the click hint. */
function ChartContent({
  model,
  settings,
  asTable,
  clickable,
  loading,
  onGroup,
  label,
}: {
  model: ChartModel;
  settings: ResolvedChartSettings;
  asTable: boolean;
  clickable: boolean;
  loading: boolean;
  onGroup: GroupClick;
  label: Label;
}) {
  const hasTable = model.type !== "number";
  const funnel = model.type === "funnel";
  const showLegend = !asTable && hasLegend(model, settings);
  let hint: ChartLabelKey = "filterUnavailable";
  if (clickable) {
    hint = funnel ? "funnelHint" : "filterHint";
  }
  const Table = funnel ? FunnelDataTable : ChartDataTable;
  return (
    <div className={cn("grid gap-3", loading && "opacity-60")}>
      {asTable && hasTable ? (
        <Table
          clickable={clickable}
          label={label}
          model={model}
          onGroup={onGroup}
        />
      ) : (
        <ChartBody
          clickable={clickable}
          label={label}
          model={model}
          onGroup={onGroup}
          settings={settings}
        />
      )}
      {showLegend ? (
        <ChartLegend model={model} values={settings.showDataLabels} />
      ) : null}
      {hasTable && !asTable ? (
        <p className="text-muted-foreground text-xs" data-chart-hint>
          {label(hint)}
        </p>
      ) : null}
    </div>
  );
}

function ChartHeader({
  title,
  asTable,
  onToggle,
  label,
}: {
  title?: string;
  /** Undefined when the chart has no table fallback (number charts). */
  asTable?: boolean;
  onToggle: () => void;
  label: Label;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-medium text-sm" data-chart-title>
        {title}
      </h3>
      {asTable === undefined ? null : (
        <Button
          aria-pressed={asTable}
          className="h-8 font-normal text-xs"
          onClick={onToggle}
          size="sm"
          type="button"
          variant="outline"
        >
          <Table2 aria-hidden="true" className="size-4" />
          {label(asTable ? "showChart" : "showTable")}
        </Button>
      )}
    </div>
  );
}

/** Loading, error, partial and empty states above the chart. */
function ChartMessages({
  state,
  model,
  notice,
  label,
}: {
  state: ChartState;
  model?: ChartModel;
  notice?: string;
  label: Label;
}) {
  const messages: { key: string; text: string; alert?: boolean }[] = [];
  if (state.error) {
    messages.push({ key: "error", text: state.error, alert: true });
  }
  if (notice) {
    messages.push({ key: "notice", text: notice, alert: true });
  }
  if (state.result?.truncated) {
    messages.push({ key: "truncated", text: label("truncated") });
  }
  if (!model && state.loading) {
    messages.push({ key: "loading", text: label("loading") });
  }
  if (model?.empty && model.type !== "number") {
    messages.push({ key: "empty", text: label("empty") });
  }
  return (
    <>
      {messages.map((message) => (
        <ChartMessage alert={message.alert} key={message.key}>
          {message.text}
        </ChartMessage>
      ))}
    </>
  );
}

/** Chart display mode for YaYaw Table, rendered with shadcn/ui charts (Recharts). */
export function ChartView({ context }: { context: DisplayModeRenderContext }) {
  const { columns, locale, coloredTags, translate } = context;
  const label: Label = (key, params) =>
    chartLabel(
      key,
      locale,
      (name, fallback) => translate(`chart.${name}`, fallback),
      params
    );
  const settings = useMemo(
    () =>
      resolveChartSettings(
        columns,
        context.defaults as ChartViewSettings,
        context.settings as ChartViewSettings
      ),
    [columns, context.defaults, context.settings]
  );
  const state = useChartResult(context, settings);
  const [asTable, setAsTable] = useState(false);
  const [notice, setNotice] = useState<string>();
  const { result } = state;
  const model = useMemo(
    () =>
      result
        ? buildChartModel({
            result,
            settings,
            columns,
            locale,
            translate: (name, fallback) => translate(`chart.${name}`, fallback),
            palette: PALETTE,
            otherColor: OTHER_COLOR,
            coloredTags,
          })
        : undefined,
    [coloredTags, columns, locale, result, settings, translate]
  );
  const clickable =
    settings.type !== "number" && canAddChartFilters(context.advancedFilters);
  const onGroup: GroupClick = (category, series) => {
    const rules = chartGroupFilters(settings, columns, { category, series });
    if (
      rules &&
      !context.showRecords(rules as unknown as Record<string, unknown>[])
    ) {
      setNotice(label("filterUnavailable"));
    }
  };

  if (!(settings.xColumn || settings.type === "number")) {
    return <ChartMessage>{label("noColumn")}</ChartMessage>;
  }
  const visible = model && !(model.empty && model.type !== "number");
  if (settings.fill) {
    return (
      <section
        aria-busy={state.loading}
        aria-label={model?.title}
        className="flex h-[100cqh] min-h-0 flex-col gap-2 overflow-hidden"
        data-chart-fill=""
        data-chart-type={settings.type}
      >
        <ChartMessages
          label={label}
          model={model}
          notice={notice}
          state={state}
        />
        {visible ? (
          <FilledChart
            clickable={clickable}
            label={label}
            loading={state.loading}
            model={model}
            onGroup={onGroup}
            settings={settings}
          />
        ) : null}
      </section>
    );
  }
  return (
    <section
      aria-busy={state.loading}
      aria-label={model?.title}
      className="grid gap-3"
      data-chart-type={settings.type}
    >
      <ChartHeader
        asTable={model && model.type !== "number" ? asTable : undefined}
        label={label}
        onToggle={() => setAsTable((current) => !current)}
        title={model?.title}
      />
      <ChartMessages
        label={label}
        model={model}
        notice={notice}
        state={state}
      />
      {visible ? (
        <ChartContent
          asTable={asTable}
          clickable={clickable}
          label={label}
          loading={state.loading}
          model={model}
          onGroup={onGroup}
          settings={settings}
        />
      ) : null}
    </section>
  );
}
