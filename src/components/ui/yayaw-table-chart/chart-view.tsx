"use client";

import { Table2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  type ChartLabelKey,
  type ChartModel,
  type ChartSeriesItem,
  type ChartViewSettings,
  canAddChartFilters,
  chartAggregateRequest,
  chartBarLabelRoom,
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

function BarsChart({
  model,
  settings,
  onGroup,
  clickable,
}: {
  model: ChartModel;
  settings: ResolvedChartSettings;
  onGroup: GroupClick;
  clickable: boolean;
}) {
  const horizontal = model.type === "horizontalBar";
  const rows = chartRows(model);
  const stacked = model.stacked && model.series.length > 1;
  let labelPosition: "center" | "right" | "top" = "top";
  if (stacked) {
    labelPosition = "center";
  } else if (horizontal) {
    labelPosition = "right";
  }
  const height = horizontal
    ? Math.max(CHART_HEIGHT, rows.length * ROW_HEIGHT)
    : CHART_HEIGHT;
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
        margin={{
          top: 20,
          // Horizontal bars keep room for the longest bar's value label.
          right:
            horizontal && settings.showDataLabels && !stacked
              ? 24 + chartBarLabelRoom(model)
              : 24,
          left: 8,
          bottom: 4,
        }}
      >
        <CartesianGrid horizontal={!horizontal} vertical={horizontal} />
        {horizontal ? (
          <>
            <XAxis
              axisLine={false}
              domain={valueDomain(model)}
              tickFormatter={(value: number) => model.format(value)}
              tickLine={false}
              ticks={model.valueTicks}
              type="number"
            />
            <YAxis
              axisLine={false}
              dataKey="label"
              tickLine={false}
              type="category"
              width={AXIS_WIDTH}
            />
          </>
        ) : (
          <>
            <XAxis
              axisLine={false}
              dataKey="label"
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              axisLine={false}
              domain={valueDomain(model)}
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
            {settings.showDataLabels ? (
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

function LinesChart({
  model,
  settings,
  onGroup,
}: {
  model: ChartModel;
  settings: ResolvedChartSettings;
  onGroup: GroupClick;
}) {
  return (
    <ChartContainer
      className="aspect-auto w-full"
      config={chartConfig(model)}
      style={{ height: CHART_HEIGHT }}
    >
      <LineChart
        accessibilityLayer
        data={chartRows(model)}
        margin={{ top: 20, right: 24, left: 8, bottom: 4 }}
        onClick={categoryClick(model, onGroup)}
        throttledEvents={IMMEDIATE_EVENTS}
      >
        <CartesianGrid vertical={false} />
        {/* Labels that would overlap on narrow charts are skipped. */}
        <XAxis
          axisLine={false}
          dataKey="label"
          padding={{ left: 40, right: 40 }}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          axisLine={false}
          domain={valueDomain(model)}
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
            {settings.showDataLabels ? (
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
}: {
  model: ChartModel;
  settings: ResolvedChartSettings;
  onGroup: GroupClick;
}) {
  const stacked = model.stacked && !model.single;
  const tickFormat = chartTickFormat(model);
  return (
    <ChartContainer
      className="aspect-auto w-full"
      config={chartConfig(model)}
      style={{ height: CHART_HEIGHT }}
    >
      <AreaChart
        accessibilityLayer
        data={chartRows(model)}
        margin={{ top: 20, right: 24, left: 8, bottom: 4 }}
        onClick={categoryClick(model, onGroup)}
        throttledEvents={IMMEDIATE_EVENTS}
      >
        <CartesianGrid vertical={false} />
        {/* Labels that would overlap on narrow charts are skipped. */}
        <XAxis
          axisLine={false}
          dataKey="label"
          padding={{ left: 40, right: 40 }}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          axisLine={false}
          domain={valueDomain(model)}
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
            {settings.showDataLabels ? (
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

/** Bars for one metric and a line for another, on a second axis when their units differ. */
function ComboChart({
  model,
  settings,
  onGroup,
  clickable,
}: {
  model: ChartModel;
  settings: ResolvedChartSettings;
  onGroup: GroupClick;
  clickable: boolean;
}) {
  const [bars, line] = model.series;
  const right = model.secondaryTicks;
  const lineAxis = right ? "right" : "left";
  const barFormat = bars?.format ?? model.format;
  const lineFormat = line?.format ?? model.format;
  return (
    <ChartContainer
      className="aspect-auto w-full"
      config={chartConfig(model)}
      style={{ height: CHART_HEIGHT }}
    >
      <ComposedChart
        accessibilityLayer
        data={chartRows(model)}
        margin={{ top: 20, right: right ? 8 : 24, left: 8, bottom: 4 }}
        onClick={categoryClick(model, onGroup)}
        throttledEvents={IMMEDIATE_EVENTS}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="label"
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          axisLine={false}
          domain={valueDomain(model)}
          tickFormatter={(value: number) => barFormat(value)}
          tickLine={false}
          ticks={model.valueTicks}
          type="number"
          width="auto"
          yAxisId="left"
        />
        {right ? (
          <YAxis
            axisLine={false}
            domain={[right.at(0) ?? 0, right.at(-1) ?? 1]}
            orientation="right"
            tickFormatter={(value: number) => lineFormat(value)}
            tickLine={false}
            ticks={right}
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
            {settings.showDataLabels ? (
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
            {settings.showDataLabels ? (
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
}: {
  model: ChartModel;
  onGroup: GroupClick;
  clickable: boolean;
  label: Label;
}) {
  const data = model.categories
    .filter((category) => category.total > 0)
    .map((category) => ({
      id: category.id,
      label: category.label,
      value: category.total,
    }));
  return (
    <ChartContainer
      className="aspect-auto w-full"
      config={chartConfig(model)}
      style={{ height: CHART_HEIGHT }}
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
          className="fill-foreground font-semibold text-2xl"
          dominantBaseline="middle"
          textAnchor="middle"
          x="50%"
          y="48%"
        >
          {model.format(model.total)}
        </text>
        <text
          className="fill-muted-foreground text-xs"
          dominantBaseline="middle"
          textAnchor="middle"
          x="50%"
          y="56%"
        >
          {label("total")}
        </text>
      </PieChart>
    </ChartContainer>
  );
}

function NumberChart({ model }: { model: ChartModel }) {
  return (
    <div className="grid place-items-center gap-1 py-12 text-center">
      <output
        className="font-semibold text-5xl tabular-nums tracking-tight"
        data-chart-number
      >
        {model.format(model.total)}
      </output>
      <span className="text-muted-foreground text-sm">{model.valueLabel}</span>
    </div>
  );
}

function ChartLegend({
  model,
  settings,
}: {
  model: ChartModel;
  settings: ResolvedChartSettings;
}) {
  let items: { id: string; label: string; color: string; value?: number }[] =
    model.series.map((item) => ({ ...item, value: undefined }));
  if (model.type === "donut") {
    items = model.categories
      .filter((category) => category.total > 0)
      .map((category) => ({ ...category, value: category.total }));
  } else if (model.type === "funnel") {
    items = model.stages ?? [];
  }
  return (
    <ul
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs"
      data-chart-legend
    >
      {items.map((item) => (
        <li className="flex items-center gap-1.5" key={item.id}>
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-[2px]"
            style={{ background: item.color }}
          />
          <span>{item.label}</span>
          {settings.showDataLabels && item.value !== undefined ? (
            <span className="text-muted-foreground tabular-nums">
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
}: {
  model: ChartModel;
  settings: ResolvedChartSettings;
  onGroup: GroupClick;
  clickable: boolean;
  label: Label;
}) {
  switch (model.type) {
    case "number":
      return <NumberChart model={model} />;
    case "donut":
      return (
        <DonutChart
          clickable={clickable}
          label={label}
          model={model}
          onGroup={onGroup}
        />
      );
    case "line":
      return <LinesChart model={model} onGroup={onGroup} settings={settings} />;
    case "area":
      return <AreasChart model={model} onGroup={onGroup} settings={settings} />;
    case "combo":
      return (
        <ComboChart
          clickable={clickable}
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
          model={model}
          onGroup={onGroup}
          settings={settings}
        />
      );
  }
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
  const showLegend =
    settings.showLegend &&
    !asTable &&
    (model.type === "donut" || funnel || (hasTable && !model.single));
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
      {showLegend ? <ChartLegend model={model} settings={settings} /> : null}
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
