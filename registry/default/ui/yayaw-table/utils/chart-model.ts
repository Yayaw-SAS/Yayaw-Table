/**
 * Chart view model shared by the React and Vue editions. It has no charting
 * library dependency: the optional chart registry items render what it builds.
 *
 * Server first: `actions.aggregate` receives `groupBy` and `metrics` beside the
 * usual query and answers `{ groups: [{ keys, values }] }`. Hosts that have not
 * implemented it, or tables without an aggregate action, are aggregated here
 * over every row matching the query (capped, with a `truncated` signal).
 */
import { loadScopedRows, type ScopedRowsRequest } from "./scoped-rows";
import {
  dataTypeFilter,
  dataTypeOptionLabel,
  normalizeFilterEnvelope,
  recordValue,
} from "./table-contracts";
import { tagAppearance } from "./tag-colors";
import {
  type ColumnValueFormat,
  formatColumnDay,
  formatColumnNumber,
  parseDateValue,
  resolveNumberFormat,
} from "./value-format";

export type ChartType =
  | "bar"
  | "horizontalBar"
  | "line"
  | "area"
  | "combo"
  | "donut"
  | "funnel"
  | "number";
export type ChartBucket = "day" | "week" | "month" | "quarter" | "year";
/** Area series on top of each other, as shares of each category (100 %), or overlapping. */
export type ChartStacking = "stacked" | "percent" | "none";
/** Lines and areas: smooth curves or straight segments. */
export type ChartCurve = "smooth" | "linear";
export type ChartMetricFn =
  | "count"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "countDistinct";
export type ChartSort =
  | "auto"
  | "keyAsc"
  | "keyDesc"
  | "valueAsc"
  | "valueDesc"
  | "manual";
export type ChartColors = "options" | "palette";

export interface ChartViewSettings {
  type?: ChartType;
  /** Column whose values (or date buckets) are the x axis, the slices of a donut. */
  xColumn?: string;
  /** Date bucket of a date x axis (default `month`). */
  bucket?: ChartBucket;
  /** What the y axis measures (default `count`). */
  metric?: ChartMetricFn;
  /** Column the metric reads; required by every metric but `count`. */
  metricColumn?: string;
  /** Optional second grouping: stacked or grouped bars, one line per value. */
  seriesColumn?: string;
  /** Stack the series of a bar chart (default) or show them side by side. */
  stacked?: boolean;
  sort?: ChartSort;
  /** Running totals along the x axis (bar and line charts). */
  cumulative?: boolean;
  /** Hide groups without a value and groups whose value is zero. */
  hideEmpty?: boolean;
  /** Keep the first N groups after sorting; the rest become "Other". */
  topN?: number;
  showDataLabels?: boolean;
  showLegend?: boolean;
  /** Color groups with their option colors (default) or the chart palette. */
  colors?: ChartColors;
  /** First day of week buckets, 0 = Sunday … 6 = Saturday (default Monday). */
  weekStartsOn?: number;
  /** Area charts with series: stacked (default), stacked to 100 % or overlapping. */
  stacking?: ChartStacking;
  /** Lines, areas and the line of combo charts: smooth (default) or straight. */
  curve?: ChartCurve;
  /** What the line of a combo chart measures (default `count`); bars use `metric`. */
  lineMetric?: ChartMetricFn;
  /** Column the line metric reads; required by every line metric but `count`. */
  lineMetricColumn?: string;
  /**
   * Funnel stages in order, as option values. Options left out follow in the
   * column's option order; without it the stages follow the option order.
   */
  stageOrder?: string[];
}

export const CHART_DEFAULTS = {
  type: "bar",
  bucket: "month",
  metric: "count",
  stacked: true,
  sort: "auto",
  cumulative: false,
  hideEmpty: false,
  showDataLabels: false,
  showLegend: true,
  colors: "options",
  weekStartsOn: 1,
  stacking: "stacked",
  curve: "smooth",
  lineMetric: "count",
} as const satisfies ChartViewSettings;

export type ResolvedChartSettings = ChartViewSettings &
  Required<
    Pick<
      ChartViewSettings,
      | "bucket"
      | "colors"
      | "cumulative"
      | "curve"
      | "hideEmpty"
      | "lineMetric"
      | "metric"
      | "showDataLabels"
      | "showLegend"
      | "sort"
      | "stacked"
      | "stacking"
      | "type"
      | "weekStartsOn"
    >
  >;

export const CHART_TYPES: readonly ChartType[] = [
  "bar",
  "horizontalBar",
  "line",
  "area",
  "combo",
  "donut",
  "funnel",
  "number",
];
export const CHART_STACKINGS: readonly ChartStacking[] = [
  "stacked",
  "percent",
  "none",
];
export const CHART_CURVES: readonly ChartCurve[] = ["smooth", "linear"];
export const CHART_BUCKETS: readonly ChartBucket[] = [
  "day",
  "week",
  "month",
  "quarter",
  "year",
];
export const CHART_METRICS: readonly ChartMetricFn[] = [
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "countDistinct",
];
export const CHART_SORTS: readonly ChartSort[] = [
  "auto",
  "keyAsc",
  "keyDesc",
  "valueAsc",
  "valueDesc",
  "manual",
];
export const MAX_CHART_TOP_N = 50;
/** Series beyond this many are folded into "Other" (or left out for non-additive metrics). */
export const MAX_CHART_SERIES = 10;
/** Gaps filled between the first and last date buckets, at most. */
const MAX_FILLED_BUCKETS = 500;
const DAYS_IN_WEEK = 7;
const MONTHS_IN_QUARTER = 3;
const DAY_MS = 86_400_000;
/** Funnel stages kept in a saved order, at most. */
const MAX_STAGE_ORDER = 200;
const STRING_KEYS = [
  "xColumn",
  "metricColumn",
  "seriesColumn",
  "lineMetricColumn",
] as const;
const BOOLEAN_KEYS = [
  "stacked",
  "cumulative",
  "hideEmpty",
  "showDataLabels",
  "showLegend",
] as const;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY = /^(\d{4})-(\d{2})$/;
const QUARTER_KEY = /^(\d{4})-Q([1-4])$/;
const YEAR_KEY = /^\d{4}$/;
const TEMPLATE_PARAM = /\{(\w+)\}/g;
const EMPTY_ID = "__empty";
export const OTHER_ID = "__other";
export const VALUE_SERIES_ID = "value";
/** Series ids of combo charts: the bars' metric and the line's. */
export const COMBO_BAR_ID = "bars";
export const COMBO_LINE_ID = "line";

const pad = (value: number, size = 2) => String(value).padStart(size, "0");
const oneOf = <T extends string>(list: readonly T[], value: unknown) =>
  list.includes(value as T) ? (value as T) : undefined;

// Settings ------------------------------------------------------------------

function normalizedTopN(value: unknown): number | undefined {
  const top = Number(value);
  return value !== undefined &&
    value !== null &&
    Number.isInteger(top) &&
    top > 0 &&
    top <= MAX_CHART_TOP_N
    ? top
    : undefined;
}

function normalizedWeekStart(value: unknown): number | undefined {
  const day = Number(value);
  return value !== undefined &&
    value !== null &&
    value !== "" &&
    Number.isInteger(day) &&
    day >= 0 &&
    day < DAYS_IN_WEEK
    ? day
    : undefined;
}

/** Distinct option values as text, in order; anything else is dropped. */
function normalizedStageOrder(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return;
  }
  const stages = [
    ...new Set(
      value.filter(
        (item): item is string => typeof item === "string" && item !== ""
      )
    ),
  ].slice(0, MAX_STAGE_ORDER);
  return stages.length ? stages : undefined;
}

/** Keep only valid chart settings; unknown or malformed values are dropped. */
export function normalizeChartViewConfig(
  value: unknown
): ChartViewSettings | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return;
  }
  const input = value as Record<string, unknown>;
  const normalized: ChartViewSettings = {};
  for (const key of STRING_KEYS) {
    const text = typeof input[key] === "string" ? input[key].trim() : "";
    if (text) {
      normalized[key] = text;
    }
  }
  for (const key of BOOLEAN_KEYS) {
    if (typeof input[key] === "boolean") {
      normalized[key] = input[key];
    }
  }
  const enums = {
    type: oneOf(CHART_TYPES, input.type),
    bucket: oneOf(CHART_BUCKETS, input.bucket),
    metric: oneOf(CHART_METRICS, input.metric),
    sort: oneOf(CHART_SORTS, input.sort),
    colors: oneOf(["options", "palette"] as const, input.colors),
    topN: normalizedTopN(input.topN),
    weekStartsOn: normalizedWeekStart(input.weekStartsOn),
    stacking: oneOf(CHART_STACKINGS, input.stacking),
    curve: oneOf(CHART_CURVES, input.curve),
    lineMetric: oneOf(CHART_METRICS, input.lineMetric),
    stageOrder: normalizedStageOrder(input.stageOrder),
  };
  for (const [key, item] of Object.entries(enums)) {
    if (item !== undefined) {
      Object.assign(normalized, { [key]: item });
    }
  }
  return Object.keys(normalized).length ? normalized : undefined;
}

/** A column as the chart reads it. */
/** Columns bring their formats: metrics, number groups and day buckets use them. */
export interface ChartColumn extends ColumnValueFormat {
  id: string;
  header?: string;
  type?: string;
  options?: unknown;
  coloredTags?: boolean;
  tagColorMap?: Record<string, string>;
}

const OPTION_TYPES = new Set(["select", "multiSelect"]);
const GROUPABLE_TYPES = new Set([
  "select",
  "multiSelect",
  "date",
  "text",
  "string",
  "boolean",
  "number",
  "email",
  "url",
]);

const isDataColumn = (column: ChartColumn) =>
  column.id !== "select" &&
  column.id !== "actions" &&
  column.type !== "actions";

/** Columns a chart can group by (x axis and series). */
export function chartGroupColumns<T extends ChartColumn>(
  columns: readonly T[]
): T[] {
  return columns.filter(
    (column) =>
      isDataColumn(column) && GROUPABLE_TYPES.has(column.type ?? "text")
  );
}

/** Number columns a metric other than a count can read. */
export function chartNumberColumns<T extends ChartColumn>(
  columns: readonly T[]
): T[] {
  return columns.filter(
    (column) => isDataColumn(column) && column.type === "number"
  );
}

function defaultXColumn(columns: readonly ChartColumn[]): string | undefined {
  const groupable = chartGroupColumns(columns);
  return (
    groupable.find((column) => OPTION_TYPES.has(column.type ?? "")) ??
    groupable.find((column) => column.type === "date") ??
    groupable.at(0)
  )?.id;
}

function resolvedMetric(
  columns: readonly ChartColumn[],
  metric: ChartMetricFn,
  metricColumn: string | undefined
): Pick<ChartViewSettings, "metric" | "metricColumn"> {
  if (metric === "count") {
    return { metric };
  }
  const column = columns.find((item) => item.id === metricColumn);
  if (metric === "countDistinct") {
    return column ? { metric, metricColumn } : { metric: "count" };
  }
  return column?.type === "number"
    ? { metric, metricColumn }
    : { metric: "count" };
}

/** Chart types that split their values by a series column. */
const SERIES_TYPES = new Set<ChartType>([
  "bar",
  "horizontalBar",
  "line",
  "area",
]);

/** Table defaults, then the view; sensible columns when none are chosen. */
export function resolveChartSettings(
  columns: readonly ChartColumn[],
  defaults: ChartViewSettings | undefined,
  view: ChartViewSettings | undefined
): ResolvedChartSettings {
  const merged = {
    ...CHART_DEFAULTS,
    ...normalizeChartViewConfig(defaults),
    ...normalizeChartViewConfig(view),
  };
  const known = (id: string | undefined) =>
    id && chartGroupColumns(columns).some((column) => column.id === id)
      ? id
      : undefined;
  const xColumn = known(merged.xColumn) ?? defaultXColumn(columns);
  const seriesColumn = known(merged.seriesColumn);
  const usesSeries = SERIES_TYPES.has(merged.type) && seriesColumn !== xColumn;
  const line = resolvedMetric(
    columns,
    merged.lineMetric,
    merged.lineMetricColumn
  );
  const resolved: ResolvedChartSettings = {
    ...merged,
    ...resolvedMetric(columns, merged.metric, merged.metricColumn),
    lineMetric: line.metric ?? "count",
    lineMetricColumn: line.metricColumn,
    xColumn,
    seriesColumn: usesSeries ? seriesColumn : undefined,
  };
  for (const key of ["metricColumn", "lineMetricColumn", "seriesColumn"]) {
    if (!resolved[key as keyof ResolvedChartSettings]) {
      Reflect.deleteProperty(resolved, key);
    }
  }
  return resolved;
}

// Aggregate contract ---------------------------------------------------------

/** One grouping level of `actions.aggregate`: a column, bucketed when it holds dates. */
export interface ChartGroupBy {
  columnId: string;
  bucket?: ChartBucket;
}

export interface ChartMetric {
  columnId?: string;
  fn: ChartMetricFn;
}

/**
 * One group of an aggregate answer. `keys` follow `groupBy` (empty values are
 * `null`; date buckets are `YYYY-MM-DD` days, the first day of `YYYY-MM-DD`
 * weeks, `YYYY-MM` months, `YYYY-Qn` quarters and `YYYY` years); `values`
 * follow `metrics`.
 */
export interface ChartAggregateGroup {
  keys: unknown[];
  values: number[];
}

export interface ChartAggregateResult {
  groups: ChartAggregateGroup[];
  /** The groups were computed over part of the records only. */
  truncated?: boolean;
}

/** What a chart asks `actions.aggregate` for, beside the query. */
export interface ChartAggregateRequest {
  /** At most two levels: the x axis, then the series. Empty for one total. */
  groupBy: ChartGroupBy[];
  metrics: ChartMetric[];
  /** IANA zone date buckets are computed in; the browser's zone when omitted. */
  timeZone?: string;
  /** First day of week buckets, 0 = Sunday … 6 = Saturday. */
  weekStartsOn: number;
}

const columnById = (columns: readonly ChartColumn[], id: string | undefined) =>
  id ? columns.find((column) => column.id === id) : undefined;

const groupByFor = (column: ChartColumn, bucket: ChartBucket): ChartGroupBy =>
  column.type === "date"
    ? { columnId: column.id, bucket }
    : { columnId: column.id };

const metricOf = (fn: ChartMetricFn, columnId: string | undefined) =>
  columnId ? { columnId, fn } : { fn };

/**
 * The aggregate request of a chart, or undefined while it has no x axis.
 * Combo charts ask for both metrics at once: the bars', then the line's.
 */
export function chartAggregateRequest(
  settings: ResolvedChartSettings,
  columns: readonly ChartColumn[]
): ChartAggregateRequest | undefined {
  const x = columnById(columns, settings.xColumn);
  const metrics: ChartMetric[] = [
    metricOf(settings.metric, settings.metricColumn),
  ];
  if (settings.type === "combo") {
    metrics.push(metricOf(settings.lineMetric, settings.lineMetricColumn));
  }
  const base = {
    metrics,
    weekStartsOn: settings.weekStartsOn,
    ...(x?.timeZone ? { timeZone: x.timeZone } : {}),
  };
  if (settings.type === "number") {
    return { ...base, groupBy: [] };
  }
  if (!x) {
    return;
  }
  const series = columnById(columns, settings.seriesColumn);
  return {
    ...base,
    groupBy: [
      groupByFor(x, settings.bucket),
      ...(series ? [groupByFor(series, settings.bucket)] : []),
    ],
  };
}

/** Parameters of `actions.aggregate` for a chart: the table's query plus the request. */
export function chartAggregateParams(
  listParams: Record<string, unknown>,
  request: ChartAggregateRequest,
  locale: string
): Record<string, unknown> {
  const envelope = normalizeFilterEnvelope(listParams.advancedFilters);
  return {
    filters: recordValue(listParams.filters),
    advancedFilters: envelope.filters.filter(
      (filter) => filter.isActive !== false
    ),
    advancedFilterJoin: envelope.joinOperator,
    search: String(listParams.search ?? ""),
    calculations: {},
    locale,
    groupBy: request.groupBy,
    metrics: request.metrics,
    weekStartsOn: request.weekStartsOn,
    ...(request.timeZone ? { timeZone: request.timeZone } : {}),
  };
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** A host's aggregate answer when it holds groups; otherwise undefined (fall back). */
export function normalizeChartAggregateResult(
  value: unknown
): ChartAggregateResult | undefined {
  const groups = recordValue(value).groups;
  if (!Array.isArray(groups)) {
    return;
  }
  return {
    groups: groups.flatMap((group) => {
      const record = recordValue(group);
      return Array.isArray(record.keys) && Array.isArray(record.values)
        ? [
            {
              keys: record.keys.map((key) => key ?? null),
              values: record.values.map((item) =>
                isFiniteNumber(Number(item)) ? Number(item) : 0
              ),
            },
          ]
        : [];
    }),
    ...(recordValue(value).truncated === true ? { truncated: true } : {}),
  };
}

// Date buckets ---------------------------------------------------------------

interface DayParts {
  year: number;
  month: number;
  day: number;
}

const zonedFormatters = new Map<string, Intl.DateTimeFormat>();

function zonedParts(date: Date, timeZone: string): DayParts | undefined {
  let formatter = zonedFormatters.get(timeZone);
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
        timeZone,
      });
    } catch {
      return;
    }
    zonedFormatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(date);
  const part = (type: string) =>
    Number(parts.find((item) => item.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day") };
}

/** The calendar day of a value: date-only strings as they are, instants in the zone. */
function dayParts(value: unknown, timeZone?: string): DayParts | undefined {
  if (typeof value === "string") {
    const match = DATE_ONLY.exec(value);
    if (match) {
      return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
      };
    }
  }
  const date = parseDateValue(value);
  if (!date) {
    return;
  }
  if (timeZone) {
    const zoned = zonedParts(date, timeZone);
    if (zoned) {
      return zoned;
    }
  }
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

const utcDay = ({ year, month, day }: DayParts) =>
  new Date(Date.UTC(year, month - 1, day));
const dayKey = (date: Date) =>
  `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
const shiftDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * DAY_MS);

function bucketOfDay(
  parts: DayParts,
  bucket: ChartBucket,
  weekStartsOn: number
): string {
  switch (bucket) {
    case "day":
      return dayKey(utcDay(parts));
    case "week": {
      const date = utcDay(parts);
      const offset =
        (date.getUTCDay() - weekStartsOn + DAYS_IN_WEEK) % DAYS_IN_WEEK;
      return dayKey(shiftDays(date, -offset));
    }
    case "month":
      return `${pad(parts.year, 4)}-${pad(parts.month)}`;
    case "quarter":
      return `${pad(parts.year, 4)}-Q${Math.ceil(parts.month / MONTHS_IN_QUARTER)}`;
    default:
      return pad(parts.year, 4);
  }
}

/** The bucket key of a date value, or null when it holds no date. */
export function chartBucketKey(
  value: unknown,
  bucket: ChartBucket,
  options: { timeZone?: string; weekStartsOn?: number } = {}
): string | null {
  const parts = dayParts(value, options.timeZone);
  return parts ? bucketOfDay(parts, bucket, options.weekStartsOn ?? 1) : null;
}

/** First and last day (`YYYY-MM-DD`, inclusive) of a bucket key. */
export function chartBucketRange(
  key: string,
  bucket: ChartBucket
): [string, string] | undefined {
  const first = bucketStart(key, bucket);
  if (!first) {
    return;
  }
  const next = nextBucketStart(first, bucket);
  return [dayKey(first), dayKey(shiftDays(next, -1))];
}

function bucketStart(key: string, bucket: ChartBucket): Date | undefined {
  if (bucket === "day" || bucket === "week") {
    const match = DATE_ONLY.exec(key);
    return match
      ? utcDay({
          year: Number(match[1]),
          month: Number(match[2]),
          day: Number(match[3]),
        })
      : undefined;
  }
  if (bucket === "month") {
    const match = MONTH_KEY.exec(key);
    return match
      ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1))
      : undefined;
  }
  if (bucket === "quarter") {
    const match = QUARTER_KEY.exec(key);
    return match
      ? new Date(
          Date.UTC(
            Number(match[1]),
            (Number(match[2]) - 1) * MONTHS_IN_QUARTER,
            1
          )
        )
      : undefined;
  }
  return YEAR_KEY.test(key) ? new Date(Date.UTC(Number(key), 0, 1)) : undefined;
}

function nextBucketStart(start: Date, bucket: ChartBucket): Date {
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();
  switch (bucket) {
    case "day":
      return shiftDays(start, 1);
    case "week":
      return shiftDays(start, DAYS_IN_WEEK);
    case "month":
      return new Date(Date.UTC(year, month + 1, 1));
    case "quarter":
      return new Date(Date.UTC(year, month + MONTHS_IN_QUARTER, 1));
    default:
      return new Date(Date.UTC(year + 1, 0, 1));
  }
}

/** The key of the bucket following `key`. */
export function nextChartBucketKey(
  key: string,
  bucket: ChartBucket
): string | undefined {
  const start = bucketStart(key, bucket);
  if (!start) {
    return;
  }
  const next = nextBucketStart(start, bucket);
  return bucketOfDay(
    {
      year: next.getUTCFullYear(),
      month: next.getUTCMonth() + 1,
      day: next.getUTCDate(),
    },
    bucket,
    next.getUTCDay()
  );
}

// Client aggregation ------------------------------------------------------------

const isEmptyValue = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);

/** Group keys of one value: arrays count in each of their groups; empty values are null. */
function groupKeysOf(
  value: unknown,
  groupBy: ChartGroupBy,
  request: ChartAggregateRequest
): unknown[] {
  if (isEmptyValue(value)) {
    return [null];
  }
  const items = Array.isArray(value) ? value : [value];
  const keys = items.map((item) => {
    if (groupBy.bucket) {
      return chartBucketKey(item, groupBy.bucket, request);
    }
    return isEmptyValue(item) ? null : item;
  });
  return keys.filter(
    (key, index) => keys.findIndex((other) => Object.is(other, key)) === index
  );
}

interface MetricAccumulator {
  count: number;
  sum: number;
  numbers: number;
  min: number;
  max: number;
  distinct: Set<string>;
}

const newAccumulator = (): MetricAccumulator => ({
  count: 0,
  sum: 0,
  numbers: 0,
  min: Number.POSITIVE_INFINITY,
  max: Number.NEGATIVE_INFINITY,
  distinct: new Set(),
});

function accumulate(
  accumulator: MetricAccumulator,
  metric: ChartMetric,
  row: Record<string, unknown>
) {
  accumulator.count += 1;
  if (!metric.columnId) {
    return;
  }
  const value = row[metric.columnId];
  if (metric.fn === "countDistinct") {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (!isEmptyValue(item)) {
        accumulator.distinct.add(JSON.stringify(item));
      }
    }
    return;
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (isEmptyValue(value) || !Number.isFinite(numeric)) {
    return;
  }
  accumulator.sum += numeric;
  accumulator.numbers += 1;
  accumulator.min = Math.min(accumulator.min, numeric);
  accumulator.max = Math.max(accumulator.max, numeric);
}

function metricValue(
  accumulator: MetricAccumulator,
  fn: ChartMetricFn
): number {
  switch (fn) {
    case "count":
      return accumulator.count;
    case "sum":
      return accumulator.sum;
    case "avg":
      return accumulator.numbers ? accumulator.sum / accumulator.numbers : 0;
    case "min":
      return accumulator.numbers ? accumulator.min : 0;
    case "max":
      return accumulator.numbers ? accumulator.max : 0;
    default:
      return accumulator.distinct.size;
  }
}

function keyCombinations(levels: unknown[][]): unknown[][] {
  let combinations: unknown[][] = [[]];
  for (const keys of levels) {
    combinations = combinations.flatMap((prefix) =>
      keys.map((key) => [...prefix, key])
    );
  }
  return combinations;
}

/**
 * The groups `actions.aggregate` would answer, computed over loaded rows.
 * Hosts can use it as their in-memory implementation of the contract.
 */
export function aggregateChartRows(
  rows: readonly unknown[],
  request: ChartAggregateRequest
): ChartAggregateResult {
  const groups = new Map<
    string,
    { keys: unknown[]; accumulators: MetricAccumulator[] }
  >();
  const levels = request.groupBy.slice(0, 2);
  for (const item of rows) {
    const row = recordValue(item);
    const combinations = keyCombinations(
      levels.map((level) => groupKeysOf(row[level.columnId], level, request))
    );
    for (const keys of combinations) {
      const id = JSON.stringify(keys);
      let group = groups.get(id);
      if (!group) {
        group = {
          keys,
          accumulators: request.metrics.map(() => newAccumulator()),
        };
        groups.set(id, group);
      }
      for (const [index, metric] of request.metrics.entries()) {
        const accumulator = group.accumulators[index];
        if (accumulator) {
          accumulate(accumulator, metric, row);
        }
      }
    }
  }
  if (!levels.length && groups.size === 0) {
    return {
      groups: [
        {
          keys: [],
          values: request.metrics.map((metric) =>
            metricValue(newAccumulator(), metric.fn)
          ),
        },
      ],
    };
  }
  return {
    groups: [...groups.values()].map((group) => ({
      keys: group.keys,
      values: group.accumulators.map((accumulator, index) =>
        metricValue(accumulator, request.metrics[index]?.fn ?? "count")
      ),
    })),
  };
}

// Loading ---------------------------------------------------------------------

export interface ChartDataRequest {
  /** `actions.aggregate`; answers with `groups` when the host supports `groupBy`. */
  aggregate?: (params: Record<string, unknown>) => unknown;
  list?: ScopedRowsRequest["list"];
  /** Rows matching the query, for tables without a list action. */
  rows?: readonly unknown[];
  /** The table's query as list parameters. */
  params: Record<string, unknown>;
  request: ChartAggregateRequest;
  locale: string;
  maxRows?: number;
  signal?: AbortSignal;
}

export interface ChartDataResult extends ChartAggregateResult {
  /** `server` when `actions.aggregate` answered the groups. */
  source: "client" | "server";
}

async function serverGroups(
  input: ChartDataRequest
): Promise<ChartAggregateResult | undefined> {
  if (!input.aggregate) {
    return;
  }
  try {
    const answer = normalizeChartAggregateResult(
      await input.aggregate(
        chartAggregateParams(input.params, input.request, input.locale)
      )
    );
    const metrics = input.request.metrics.length;
    // Hosts that answer fewer values than metrics (one metric only) fall back too.
    return answer?.groups.every((group) => group.values.length >= metrics)
      ? answer
      : undefined;
  } catch {
    // Hosts that reject grouped requests fall back to loaded rows.
    return;
  }
}

/** Server groups when the host answers them, otherwise groups over loaded rows. */
export async function loadChartData(
  input: ChartDataRequest
): Promise<ChartDataResult> {
  const server = await serverGroups(input);
  input.signal?.throwIfAborted();
  if (server) {
    return { ...server, source: "server" };
  }
  const loaded = await loadScopedRows({
    list: input.list,
    rows: input.rows,
    params: input.params,
    maxRows: input.maxRows,
    signal: input.signal,
  });
  return {
    ...aggregateChartRows(loaded.rows, input.request),
    ...(loaded.truncated ? { truncated: true } : {}),
    source: "client",
  };
}

// Labels ------------------------------------------------------------------------

const ENGLISH_LABELS = {
  chartType: "Chart type",
  typeBar: "Vertical bars",
  typeHorizontalBar: "Horizontal bars",
  typeLine: "Line",
  typeArea: "Area",
  typeCombo: "Bars and line",
  typeDonut: "Donut",
  typeFunnel: "Funnel",
  typeNumber: "Number",
  xColumn: "X axis",
  bucket: "Group dates by",
  day: "Day",
  week: "Week",
  month: "Month",
  quarter: "Quarter",
  year: "Year",
  metric: "Y axis",
  metricCount: "Count records",
  metricSum: "Sum",
  metricAvg: "Average",
  metricMin: "Minimum",
  metricMax: "Maximum",
  metricCountDistinct: "Count unique values",
  metricColumn: "Of",
  seriesColumn: "Group by",
  none: "None",
  stacked: "Stack bars",
  sort: "Sort",
  sortAuto: "Automatic",
  sortKeyAsc: "Label, ascending",
  sortKeyDesc: "Label, descending",
  sortValueAsc: "Value, ascending",
  sortValueDesc: "Value, descending",
  sortManual: "Option order",
  cumulative: "Cumulative",
  hideEmpty: "Hide empty groups",
  topN: "Groups shown",
  topAll: "All",
  top: "Top {count}",
  showDataLabels: "Data labels",
  showLegend: "Legend",
  colors: "Colors",
  colorsOptions: "Option colors",
  colorsPalette: "Chart palette",
  weekStartsOn: "Week starts on",
  monday: "Monday",
  sunday: "Sunday",
  saturday: "Saturday",
  on: "On",
  off: "Off",
  reset: "Reset",
  showTable: "Show as table",
  showChart: "Show as chart",
  other: "Other",
  noValue: "No value",
  checked: "Checked",
  unchecked: "Unchecked",
  weekOf: "Week of {date}",
  quarterLabel: "Q{quarter} {year}",
  count: "Count",
  sumOf: "Sum of {column}",
  avgOf: "Average of {column}",
  minOf: "Minimum of {column}",
  maxOf: "Maximum of {column}",
  countDistinctOf: "Unique {column}",
  total: "Total",
  group: "Group",
  chartOf: "{metric} by {column}",
  noColumn: "Add a column to group by to show this table as a chart.",
  empty: "No records to chart.",
  loading: "Loading the chart…",
  truncated:
    "Only part of the records are counted. Narrow the filters to count all of them.",
  filterHint: "Select a bar, slice or point to see its records in the table.",
  filterUnavailable:
    "The view's filters match any rule, so a group cannot be added to them.",
  showRecords: "Show the records of {group}",
  stacking: "Stacking",
  stackingStacked: "Stacked",
  stackingPercent: "Stacked to 100%",
  stackingNone: "Overlapping",
  curve: "Curve",
  curveSmooth: "Smooth",
  curveLinear: "Straight",
  barMetric: "Bars",
  barMetricColumn: "Bars of",
  lineMetric: "Line",
  lineMetricColumn: "Line of",
  comboOf: "{bars} and {line} by {column}",
  stageOrder: "Stage order",
  stageOrderHint: "Drag the stages, or use the arrows, to change their order.",
  stageOrderReset: "Reset the order",
  moveStageUp: "Move {stage} up",
  moveStageDown: "Move {stage} down",
  stage: "Stage",
  shareOfFirst: "% of first",
  conversion: "Conversion",
  ofFirst: "{percent} of first",
  fromPrevious: "{percent} from previous",
  funnelHint: "Select a stage to see its records in the table.",
};

export type ChartLabelKey = keyof typeof ENGLISH_LABELS;

const FRENCH_LABELS: Record<ChartLabelKey, string> = {
  chartType: "Type de graphique",
  typeBar: "Barres verticales",
  typeHorizontalBar: "Barres horizontales",
  typeLine: "Courbe",
  typeArea: "Aires",
  typeCombo: "Barres et courbe",
  typeDonut: "Anneau",
  typeFunnel: "Entonnoir",
  typeNumber: "Nombre",
  xColumn: "Axe X",
  bucket: "Regrouper les dates par",
  day: "Jour",
  week: "Semaine",
  month: "Mois",
  quarter: "Trimestre",
  year: "Année",
  metric: "Axe Y",
  metricCount: "Nombre d’enregistrements",
  metricSum: "Somme",
  metricAvg: "Moyenne",
  metricMin: "Minimum",
  metricMax: "Maximum",
  metricCountDistinct: "Nombre de valeurs uniques",
  metricColumn: "De",
  seriesColumn: "Sous-groupe",
  none: "Aucun",
  stacked: "Empiler les barres",
  sort: "Tri",
  sortAuto: "Automatique",
  sortKeyAsc: "Libellé, croissant",
  sortKeyDesc: "Libellé, décroissant",
  sortValueAsc: "Valeur, croissante",
  sortValueDesc: "Valeur, décroissante",
  sortManual: "Ordre des options",
  cumulative: "Cumulé",
  hideEmpty: "Masquer les groupes vides",
  topN: "Groupes affichés",
  topAll: "Tous",
  top: "Les {count} premiers",
  showDataLabels: "Étiquettes de données",
  showLegend: "Légende",
  colors: "Couleurs",
  colorsOptions: "Couleurs des options",
  colorsPalette: "Palette du graphique",
  weekStartsOn: "Début de semaine",
  monday: "Lundi",
  sunday: "Dimanche",
  saturday: "Samedi",
  on: "Activé",
  off: "Désactivé",
  reset: "Réinitialiser",
  showTable: "Afficher en tableau",
  showChart: "Afficher en graphique",
  other: "Autres",
  noValue: "Aucune valeur",
  checked: "Coché",
  unchecked: "Non coché",
  weekOf: "Semaine du {date}",
  quarterLabel: "T{quarter} {year}",
  count: "Nombre",
  sumOf: "Somme de {column}",
  avgOf: "Moyenne de {column}",
  minOf: "Minimum de {column}",
  maxOf: "Maximum de {column}",
  countDistinctOf: "{column} uniques",
  total: "Total",
  group: "Groupe",
  chartOf: "{metric} par {column}",
  noColumn:
    "Ajoutez une colonne de regroupement pour afficher cette table en graphique.",
  empty: "Aucun enregistrement à représenter.",
  loading: "Chargement du graphique…",
  truncated:
    "Seule une partie des enregistrements est comptée. Affinez les filtres pour tout compter.",
  filterHint:
    "Sélectionnez une barre, une part ou un point pour voir ses enregistrements dans le tableau.",
  filterUnavailable:
    "Les filtres de la vue correspondent à l’une des règles : un groupe ne peut pas y être ajouté.",
  showRecords: "Afficher les enregistrements de {group}",
  stacking: "Empilement",
  stackingStacked: "Empilé",
  stackingPercent: "Empilé à 100 %",
  stackingNone: "Superposé",
  curve: "Tracé",
  curveSmooth: "Lissé",
  curveLinear: "Droit",
  barMetric: "Barres",
  barMetricColumn: "Barres : colonne",
  lineMetric: "Courbe",
  lineMetricColumn: "Courbe : colonne",
  comboOf: "{bars} et {line} par {column}",
  stageOrder: "Ordre des étapes",
  stageOrderHint:
    "Faites glisser les étapes, ou utilisez les flèches, pour changer leur ordre.",
  stageOrderReset: "Rétablir l’ordre",
  moveStageUp: "Monter {stage}",
  moveStageDown: "Descendre {stage}",
  stage: "Étape",
  shareOfFirst: "% de la première",
  conversion: "Conversion",
  ofFirst: "{percent} de la première",
  fromPrevious: "{percent} de la précédente",
  funnelHint:
    "Sélectionnez une étape pour voir ses enregistrements dans le tableau.",
};

/** Host override for a label (`chart.<key>`), or the built-in one. */
export type ChartTranslate = (key: ChartLabelKey, fallback: string) => string;

/** Built-in English or French labels, overridable per key by the host. */
export function chartLabel(
  key: ChartLabelKey,
  locale: string,
  translate?: ChartTranslate,
  params: Record<string, number | string> = {}
): string {
  const labels = locale.toLowerCase().startsWith("fr")
    ? FRENCH_LABELS
    : ENGLISH_LABELS;
  const template = translate ? translate(key, labels[key]) : labels[key];
  return template.replace(TEMPLATE_PARAM, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}

const METRIC_LABEL_KEYS: Record<ChartMetricFn, ChartLabelKey> = {
  count: "count",
  sum: "sumOf",
  avg: "avgOf",
  min: "minOf",
  max: "maxOf",
  countDistinct: "countDistinctOf",
};

/** What the y axis shows, e.g. "Sum of Price". */
export function chartMetricLabel(
  settings: Pick<ChartViewSettings, "metric" | "metricColumn">,
  columns: readonly ChartColumn[],
  locale: string,
  translate?: ChartTranslate
): string {
  const column = columnById(columns, settings.metricColumn);
  return chartLabel(
    METRIC_LABEL_KEYS[settings.metric ?? "count"],
    locale,
    translate,
    { column: column?.header ?? column?.id ?? "" }
  );
}

const dateLabelFormatters = new Map<string, Intl.DateTimeFormat>();

function formatUtcDay(
  date: Date,
  locale: string,
  options: Intl.DateTimeFormatOptions
): string {
  const cacheKey = `${locale}|${JSON.stringify(options)}`;
  let formatter = dateLabelFormatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      ...options,
      timeZone: "UTC",
    });
    dateLabelFormatters.set(cacheKey, formatter);
  }
  return formatter.format(date);
}

/**
 * A bucket key as people read it, e.g. "Sep 2026" or "Q3 2026". Days and
 * weeks read in the date column's day format (its pattern or preset without
 * the time); months, quarters and years are periods with their own names.
 */
export function chartBucketLabel(
  key: string,
  bucket: ChartBucket,
  locale: string,
  translate?: ChartTranslate,
  column?: ChartColumn
): string {
  const start = bucketStart(key, bucket);
  if (!start) {
    return key;
  }
  switch (bucket) {
    case "day":
      return formatColumnDay(dayKey(start), column, locale);
    case "week":
      return chartLabel("weekOf", locale, translate, {
        date: formatColumnDay(dayKey(start), column, locale),
      });
    case "month":
      return formatUtcDay(start, locale, { month: "short", year: "numeric" });
    case "quarter":
      return chartLabel("quarterLabel", locale, translate, {
        quarter: Math.floor(start.getUTCMonth() / MONTHS_IN_QUARTER) + 1,
        year: start.getUTCFullYear(),
      });
    default:
      return String(start.getUTCFullYear());
  }
}

function groupKeyLabel(
  key: unknown,
  column: ChartColumn | undefined,
  bucket: ChartBucket | undefined,
  locale: string,
  translate?: ChartTranslate
): string {
  if (key === null || key === undefined) {
    return chartLabel("noValue", locale, translate);
  }
  if (bucket && typeof key === "string") {
    return chartBucketLabel(key, bucket, locale, translate, column);
  }
  if (typeof key === "boolean") {
    return chartLabel(key ? "checked" : "unchecked", locale, translate);
  }
  // Hosts may answer number groups as text, e.g. SQL decimals.
  const numeric =
    typeof key === "string" && key.trim() !== "" ? Number(key) : key;
  if (
    column?.type === "number" &&
    typeof numeric === "number" &&
    Number.isFinite(numeric)
  ) {
    return formatColumnNumber(numeric, column, locale);
  }
  return dataTypeOptionLabel(key, column?.options);
}

/** Formats metric values: counts as integers, other metrics in the column's number format. */
export function chartValueFormatter(
  settings: Pick<ChartViewSettings, "metric" | "metricColumn">,
  columns: readonly ChartColumn[],
  locale: string
): (value: number) => string {
  const column = columnById(columns, settings.metricColumn);
  const counting =
    !settings.metric ||
    settings.metric === "count" ||
    settings.metric === "countDistinct";
  if (counting || !column) {
    const formatter = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    });
    return (value) => formatter.format(value);
  }
  return (value) => formatColumnNumber(value, column, locale);
}

const isCounting = (metric: ChartMetricFn | undefined) =>
  !metric || metric === "count" || metric === "countDistinct";

/**
 * What a metric's values are measured in, from its column's number format:
 * `count`, `currency:EUR`, `percent:fraction`, `unit:kilogram` or `number`.
 * Combo charts give the line its own axis when it differs from the bars'.
 */
export function chartMetricUnit(
  settings: Pick<ChartViewSettings, "metric" | "metricColumn">,
  columns: readonly ChartColumn[]
): string {
  const column = columnById(columns, settings.metricColumn);
  if (isCounting(settings.metric) || !column) {
    return "count";
  }
  const format = resolveNumberFormat(column.numberFormat);
  const style = format.style ?? (format.currency ? "currency" : "decimal");
  switch (style) {
    case "currency":
      return `currency:${format.currency ?? "USD"}`;
    case "percent":
      return `percent:${format.percentBase ?? "fraction"}`;
    case "unit":
      return `unit:${format.unit ?? ""}`;
    default:
      return "number";
  }
}

/** Formats shares such as 0.25 as "25%" (percent stacking, funnel rates). */
export function chartShareFormatter(locale: string): (share: number) => string {
  const formatter = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  });
  return (share) => formatter.format(share);
}

// Chart model ------------------------------------------------------------------

export interface ChartSeriesItem {
  id: string;
  /** The stored value (series key); undefined for the single value series and "Other". */
  key?: unknown;
  label: string;
  color: string;
  other?: boolean;
  /** Combo charts: drawn as bars or as a line. */
  mark?: "bar" | "line";
  /** Combo charts: the value axis, on the right when the line has another unit. */
  axis?: "left" | "right";
  /** Combo charts: the series' own number format (else the model's). */
  format?: (value: number) => string;
}

export interface ChartCategory {
  id: string;
  /** The stored value or bucket key of the group; undefined for "Other". */
  key?: unknown;
  label: string;
  color: string;
  /** Sum of the category's series values (after cumulation); the bars' value in combo charts. */
  total: number;
  /** Values by series id. */
  values: Record<string, number>;
  /** Areas stacked to 100 %: each series' share of `total`, from 0 to 1. */
  shares?: Record<string, number>;
  other?: boolean;
}

/** One stage of a funnel chart, with its rates. */
export interface ChartFunnelStage {
  id: string;
  category: ChartCategory;
  label: string;
  color: string;
  value: number;
  /** The value over the first stage's; undefined when the first stage is zero. */
  shareOfFirst?: number;
  /** The value over the previous stage's; undefined for the first stage or after a zero. */
  conversion?: number;
  /** The value as the metric's format shows it, e.g. "3" or "€463.00". */
  valueText: string;
  /** "100% of first" (or "—" when the first stage is zero). */
  shareText: string;
  /** "67% from previous"; undefined for the first stage. */
  conversionText?: string;
}

export interface ChartModel {
  type: ChartType;
  categories: ChartCategory[];
  series: ChartSeriesItem[];
  /** One series (`VALUE_SERIES_ID`) when the chart has no series column. */
  single: boolean;
  stacked: boolean;
  /** Areas stacked to 100 %: `categories[].shares` are drawn, ticks go from 0 to 1. */
  percent: boolean;
  /** Grand total for number and donut charts. */
  total: number;
  xLabel: string;
  valueLabel: string;
  /** Accessible summary, e.g. "Sum of Price by Category". */
  title: string;
  format: (value: number) => string;
  /** Formats shares such as 0.25 as "25%" (percent stacking, funnel rates). */
  formatShare: (share: number) => string;
  /** Value axis ticks, from the lowest to the highest (whole numbers for counts). */
  valueTicks: number[];
  /**
   * Combo charts whose line has another unit than the bars: the right axis'
   * ticks, as many as `valueTicks` so both axes share the grid lines.
   */
  secondaryTicks?: number[];
  /** Funnel charts: the stages in order, with their rates and texts. */
  stages?: ChartFunnelStage[];
  /** Whether the table fallback adds each category's total (charts with series). */
  totalColumn: boolean;
  empty: boolean;
}

export interface ChartModelInput {
  result: ChartAggregateResult;
  settings: ResolvedChartSettings;
  columns: readonly ChartColumn[];
  locale: string;
  translate?: ChartTranslate;
  /** Palette colors, e.g. `var(--chart-1)` … `var(--chart-5)`. */
  palette: readonly string[];
  /** Color of "Other" groups. */
  otherColor: string;
  /** The table's `coloredTags`; columns can override it. */
  coloredTags?: boolean;
}

export const chartKeyId = (key: unknown): string =>
  key === null || key === undefined ? EMPTY_ID : `${typeof key}:${String(key)}`;

const optionValues = (column: ChartColumn | undefined): unknown[] =>
  Array.isArray(column?.options)
    ? column.options.map((option) => recordValue(option).value)
    : [];

function compareKeys(left: unknown, right: unknown): number {
  const leftEmpty = left === null || left === undefined;
  const rightEmpty = right === null || right === undefined;
  if (leftEmpty || rightEmpty) {
    return Number(leftEmpty) - Number(rightEmpty);
  }
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  if (typeof left === "boolean" && typeof right === "boolean") {
    return Number(right) - Number(left);
  }
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
  });
}

function manualComparator(column: ChartColumn | undefined) {
  const order = optionValues(column);
  if (!order.length) {
    return compareKeys;
  }
  const position = (key: unknown) => {
    const index = order.findIndex((value) => Object.is(value, key));
    return index === -1 ? order.length : index;
  };
  return (left: unknown, right: unknown) =>
    position(left) - position(right) || compareKeys(left, right);
}

function effectiveSort(
  sort: ChartSort,
  column: ChartColumn | undefined
): Exclude<ChartSort, "auto"> {
  if (sort !== "auto") {
    return sort;
  }
  const type = column?.type ?? "text";
  if (OPTION_TYPES.has(type)) {
    return "manual";
  }
  return type === "date" || type === "number" || type === "boolean"
    ? "keyAsc"
    : "valueDesc";
}

function sortCategories(
  categories: ChartCategory[],
  sort: ChartSort,
  column: ChartColumn | undefined
): ChartCategory[] {
  const mode = effectiveSort(sort, column);
  const byKey = mode === "manual" ? manualComparator(column) : compareKeys;
  const comparators: Record<
    Exclude<ChartSort, "auto">,
    (left: ChartCategory, right: ChartCategory) => number
  > = {
    keyAsc: (left, right) => byKey(left.key, right.key),
    manual: (left, right) => byKey(left.key, right.key),
    keyDesc: (left, right) => byKey(right.key, left.key),
    valueAsc: (left, right) =>
      left.total - right.total || compareKeys(left.key, right.key),
    valueDesc: (left, right) =>
      right.total - left.total || compareKeys(left.key, right.key),
  };
  return [...categories].sort(comparators[mode]);
}

const isAdditive = (metric: ChartMetricFn) =>
  metric === "count" || metric === "sum";

interface GroupTables {
  categories: Map<string, { key: unknown; values: Map<string, number> }>;
  series: Map<string, { key: unknown; total: number }>;
}

function tabulate(
  result: ChartAggregateResult,
  withSeries: boolean
): GroupTables {
  const categories: GroupTables["categories"] = new Map();
  const series: GroupTables["series"] = new Map();
  for (const group of result.groups) {
    const [xKey = null, seriesKey = null] = group.keys;
    const value = group.values.at(0) ?? 0;
    const seriesId = withSeries ? chartKeyId(seriesKey) : VALUE_SERIES_ID;
    const categoryId = chartKeyId(xKey);
    let category = categories.get(categoryId);
    if (!category) {
      category = { key: xKey, values: new Map() };
      categories.set(categoryId, category);
    }
    category.values.set(seriesId, (category.values.get(seriesId) ?? 0) + value);
    const item = series.get(seriesId) ?? { key: seriesKey, total: 0 };
    item.total += value;
    series.set(seriesId, item);
  }
  return { categories, series };
}

/** Empty categories for missing date buckets and options, unless empty groups are hidden. */
function fillCategories(
  tables: GroupTables,
  settings: ResolvedChartSettings,
  column: ChartColumn | undefined
) {
  if (settings.hideEmpty || !column) {
    return;
  }
  const add = (key: unknown) => {
    const id = chartKeyId(key);
    if (!tables.categories.has(id)) {
      tables.categories.set(id, { key, values: new Map() });
    }
  };
  if (column.type === "date") {
    const keys = [...tables.categories.values()]
      .map((category) => category.key)
      .filter((key): key is string => typeof key === "string")
      .sort();
    const last = keys.at(-1);
    let key = keys.at(0);
    for (
      let filled = 0;
      key && last && key < last && filled < MAX_FILLED_BUCKETS;
      filled += 1
    ) {
      add(key);
      key = nextChartBucketKey(key, settings.bucket);
    }
    return;
  }
  for (const value of optionValues(column)) {
    add(value);
  }
}

interface SeriesPlan {
  series: ChartSeriesItem[];
  /** Series id → id it is shown as (itself, or "Other"); missing ids are left out. */
  shownAs: Map<string, string>;
}

function planSeries(
  tables: GroupTables,
  input: ChartModelInput,
  column: ChartColumn | undefined,
  label: (key: unknown) => string
): SeriesPlan {
  const { settings, palette, otherColor } = input;
  if (!column) {
    return {
      series: [
        {
          id: VALUE_SERIES_ID,
          label: chartMetricLabel(
            settings,
            input.columns,
            input.locale,
            input.translate
          ),
          color: palette.at(0) ?? otherColor,
        },
      ],
      shownAs: new Map([[VALUE_SERIES_ID, VALUE_SERIES_ID]]),
    };
  }
  const order = manualComparator(column);
  let entries = [...tables.series.entries()].sort((left, right) =>
    order(left[1].key, right[1].key)
  );
  const overflow = entries.length > MAX_CHART_SERIES;
  if (overflow) {
    const kept = new Set(
      [...entries]
        .sort((left, right) => right[1].total - left[1].total)
        .slice(0, MAX_CHART_SERIES - 1)
        .map(([id]) => id)
    );
    entries = entries.filter(([id]) => kept.has(id));
  }
  const shownAs = new Map<string, string>();
  const series: ChartSeriesItem[] = entries.map(([id, item], index) => {
    shownAs.set(id, id);
    return {
      id,
      key: item.key,
      label: label(item.key),
      color: groupColor(input, column, item.key, index),
    };
  });
  if (overflow && isAdditive(settings.metric)) {
    for (const id of tables.series.keys()) {
      if (!shownAs.has(id)) {
        shownAs.set(id, OTHER_ID);
      }
    }
    series.push({
      id: OTHER_ID,
      label: chartLabel("other", input.locale, input.translate),
      color: otherColor,
      other: true,
    });
  }
  return { series, shownAs };
}

const hasExplicitColors = (column: ChartColumn | undefined) =>
  Array.isArray(column?.options) &&
  column.options.some(
    (option) => typeof recordValue(option).color === "string"
  );

/** Option columns keep their colors: explicit option colors, else tag hues when tags are colored. */
const hasOptionColors = (
  column: ChartColumn | undefined,
  coloredTags: boolean | undefined
) =>
  OPTION_TYPES.has(column?.type ?? "") &&
  (hasExplicitColors(column) || (column?.coloredTags ?? coloredTags ?? true));

/** An option's color (explicit, else its tag hue) or the palette color at `index`. */
function groupColor(
  input: ChartModelInput,
  column: ChartColumn | undefined,
  key: unknown,
  index: number
): string {
  const paletteColor =
    input.palette.at(index % Math.max(1, input.palette.length)) ??
    input.otherColor;
  if (key === null || key === undefined) {
    return input.otherColor;
  }
  if (
    input.settings.colors !== "options" ||
    !hasOptionColors(column, input.coloredTags)
  ) {
    return paletteColor;
  }
  const option = Array.isArray(column?.options)
    ? column.options.map(recordValue).find((item) => Object.is(item.value, key))
    : undefined;
  if (typeof option?.color === "string" && option.color) {
    return option.color;
  }
  if (!(column?.coloredTags ?? input.coloredTags ?? true)) {
    return paletteColor;
  }
  const hue = tagAppearance(String(key), true).style?.["--yayaw-tag-hue"];
  return hue ? `hsl(${hue} 70% 55%)` : paletteColor;
}

/** The value a category is sorted, limited and hidden by: the bars' in combo charts. */
function categoryTotal(
  values: Record<string, number>,
  type: ChartType
): number {
  if (type === "combo") {
    return values[COMBO_BAR_ID] ?? 0;
  }
  return Object.values(values).reduce((sum, value) => sum + value, 0);
}

/** Hidden empty groups: no value, or zero (every metric of a combo chart). */
function isShownCategory(
  category: ChartCategory,
  settings: ResolvedChartSettings
): boolean {
  if (category.key === null || category.key === undefined) {
    // Records without a stage belong to no funnel stage.
    return !(settings.hideEmpty || settings.type === "funnel");
  }
  if (!settings.hideEmpty) {
    return true;
  }
  return settings.type === "combo"
    ? Object.values(category.values).some((value) => value !== 0)
    : category.total !== 0;
}

/**
 * Funnel stages: the saved stage order first, then the automatic order (the
 * option order of select columns, dates ascending, other values by value).
 */
function sortStages(
  categories: ChartCategory[],
  settings: ResolvedChartSettings,
  column: ChartColumn | undefined
): ChartCategory[] {
  const saved = settings.stageOrder ?? [];
  const position = (key: unknown) => {
    const index = saved.indexOf(String(key));
    return index === -1 ? saved.length : index;
  };
  const automatic = sortCategories(categories, "auto", column);
  const rank = new Map(
    automatic.map((category, index) => [category.id, index])
  );
  return [...automatic].sort(
    (left, right) =>
      position(left.key) - position(right.key) ||
      (rank.get(left.id) ?? 0) - (rank.get(right.id) ?? 0)
  );
}

function buildCategories(
  tables: GroupTables,
  plan: SeriesPlan,
  input: ChartModelInput,
  column: ChartColumn | undefined,
  label: (key: unknown) => string
): ChartCategory[] {
  const { settings } = input;
  const perCategoryColor =
    settings.type === "donut" ||
    settings.type === "funnel" ||
    (plan.series.length === 1 &&
      settings.colors === "options" &&
      hasOptionColors(column, input.coloredTags));
  const categories: ChartCategory[] = [];
  for (const [id, category] of tables.categories) {
    const values: Record<string, number> = Object.fromEntries(
      plan.series.map((item) => [item.id, 0])
    );
    for (const [seriesId, value] of category.values) {
      const target = plan.shownAs.get(seriesId);
      if (target !== undefined) {
        values[target] = (values[target] ?? 0) + value;
      }
    }
    categories.push({
      id,
      key: category.key,
      label: label(category.key),
      color: plan.series.at(0)?.color ?? input.otherColor,
      total: categoryTotal(values, settings.type),
      values,
    });
  }
  const shown = categories.filter((category) =>
    isShownCategory(category, settings)
  );
  const sorted =
    settings.type === "funnel"
      ? sortStages(shown, settings, column)
      : sortCategories(shown, settings.sort, column);
  return perCategoryColor
    ? sorted.map((category, index) => ({
        ...category,
        color: groupColor(input, column, category.key, index),
      }))
    : sorted;
}

/** Whether groups past the top N add up into "Other": every metric is a count or a sum. */
const foldsIntoOther = (settings: ResolvedChartSettings) =>
  isAdditive(settings.metric) &&
  (settings.type !== "combo" || isAdditive(settings.lineMetric));

function limitCategories(
  categories: ChartCategory[],
  input: ChartModelInput,
  series: ChartSeriesItem[]
): ChartCategory[] {
  const { topN, type } = input.settings;
  if (!topN || categories.length <= topN || type === "funnel") {
    return categories;
  }
  const kept = categories.slice(0, topN);
  if (!foldsIntoOther(input.settings)) {
    return kept;
  }
  const values: Record<string, number> = Object.fromEntries(
    series.map((item) => [item.id, 0])
  );
  for (const category of categories.slice(topN)) {
    for (const [id, value] of Object.entries(category.values)) {
      values[id] = (values[id] ?? 0) + value;
    }
  }
  return [
    ...kept,
    {
      id: OTHER_ID,
      label: chartLabel("other", input.locale, input.translate),
      color: input.otherColor,
      total: categoryTotal(values, type),
      values,
      other: true,
    },
  ];
}

function cumulate(categories: ChartCategory[]): ChartCategory[] {
  const running: Record<string, number> = {};
  return categories.map((category) => {
    const values: Record<string, number> = {};
    for (const [id, value] of Object.entries(category.values)) {
      running[id] = (running[id] ?? 0) + value;
      values[id] = running[id] ?? 0;
    }
    return {
      ...category,
      values,
      total: Object.values(values).reduce((sum, value) => sum + value, 0),
    };
  });
}

/** Chart types whose values can add up along the x axis. */
const CUMULATIVE_TYPES = new Set<ChartType>([
  "bar",
  "horizontalBar",
  "line",
  "area",
]);

/**
 * Each series' share of the category's total, for areas stacked to 100 %.
 * A category whose total is zero shares nothing.
 */
export function chartShares(
  values: Readonly<Record<string, number>>
): Record<string, number> {
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(
    Object.entries(values).map(([id, value]) => [id, total ? value / total : 0])
  );
}

/** Stacked series: bars when `stacked`, areas unless `stacking` is `none`. */
function isStackedChart(settings: ResolvedChartSettings): boolean {
  if (settings.type === "area") {
    return settings.stacking !== "none";
  }
  return settings.stacked && settings.type !== "line";
}

const TICK_COUNT = 4;
const NICE_STEPS = [1, 2, 5, 10];
/** Areas stacked to 100 %: quarters of the whole. */
const PERCENT_TICKS = [0, 0.25, 0.5, 0.75, 1];

/** The values a value axis must fit: stacked totals, or each value. */
function plottedValues(
  categories: readonly ChartCategory[],
  settings: ResolvedChartSettings
): number[] {
  const stacked = isStackedChart(settings);
  return categories.flatMap((category) =>
    stacked ? [category.total] : Object.values(category.values)
  );
}

/** Evenly spaced round ticks covering the values and zero, the same in both editions. */
export function chartValueTicks(
  values: readonly number[],
  integer = false
): number[] {
  const finite = values.filter((value) => Number.isFinite(value));
  const low = Math.min(0, ...finite);
  // Without values (or only zeros) the axis still spans one unit.
  const high = Math.max(0, ...finite) || (low === 0 ? 1 : 0);
  const span = high - low;
  const raw = span / TICK_COUNT;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const nice =
    NICE_STEPS.find((step) => step * magnitude >= raw) ??
    NICE_STEPS.at(-1) ??
    1;
  const step = integer
    ? Math.max(1, Math.ceil(nice * magnitude))
    : nice * magnitude;
  const first = Math.floor(low / step) * step;
  const last = Math.max(first + step, Math.ceil(high / step) * step);
  const ticks: number[] = [];
  for (let tick = first; tick <= last + step / 2; tick += step) {
    // Rounded so steps such as 0.1 do not accumulate float noise.
    ticks.push(Number(tick.toPrecision(12)));
  }
  return ticks;
}

const ALIGNED_STEPS = [1, 2, 2.5, 5];
const MAX_MAGNITUDES = 12;

/**
 * Round ticks covering the values and zero in exactly `intervals` steps, so a
 * second value axis shares the grid lines of the first (combo charts).
 */
export function chartAlignedTicks(
  values: readonly number[],
  intervals: number,
  integer = false
): number[] {
  const count = Math.max(1, Math.round(intervals));
  const finite = values.filter((value) => Number.isFinite(value));
  const low = Math.min(0, ...finite);
  // Without values (or only zeros) the axis still spans one unit.
  const high = Math.max(0, ...finite) || (low === 0 ? 1 : 0);
  let magnitude = 10 ** Math.floor(Math.log10((high - low) / count));
  let step = magnitude;
  for (let attempt = 0; attempt < MAX_MAGNITUDES; attempt += 1) {
    const fitting = ALIGNED_STEPS.map((nice) =>
      integer ? Math.max(1, Math.ceil(nice * magnitude)) : nice * magnitude
    ).find(
      (candidate) =>
        Math.floor(low / candidate) * candidate + candidate * count >=
        high - candidate * 1e-9
    );
    if (fitting) {
      step = fitting;
      break;
    }
    magnitude *= 10;
  }
  const first = Math.floor(low / step) * step;
  return Array.from({ length: count + 1 }, (_, index) =>
    Number((first + step * index).toPrecision(12))
  );
}

/** What every chart model shares, before its categories. */
interface ModelBase {
  type: ChartType;
  stacked: boolean;
  percent: boolean;
  xLabel: string;
  valueLabel: string;
  title: string;
  format: (value: number) => string;
  formatShare: (share: number) => string;
  totalColumn: boolean;
}

/** Combo charts: one category per x value, one value per metric (bars, then line). */
function tabulateMetrics(
  result: ChartAggregateResult,
  ids: readonly string[]
): GroupTables {
  const categories: GroupTables["categories"] = new Map();
  const series: GroupTables["series"] = new Map();
  for (const group of result.groups) {
    const [xKey = null] = group.keys;
    const categoryId = chartKeyId(xKey);
    let category = categories.get(categoryId);
    if (!category) {
      category = { key: xKey, values: new Map() };
      categories.set(categoryId, category);
    }
    for (const [index, id] of ids.entries()) {
      const value = group.values.at(index) ?? 0;
      category.values.set(id, (category.values.get(id) ?? 0) + value);
      const item = series.get(id) ?? { key: undefined, total: 0 };
      item.total += value;
      series.set(id, item);
    }
  }
  return { categories, series };
}

/** Combo charts: bars and a line by x value, each metric with its format and axis. */
function buildComboModel(input: ChartModelInput, base: ModelBase): ChartModel {
  const { settings, columns, locale, translate, palette, otherColor } = input;
  const x = columnById(columns, settings.xColumn);
  const bars = { metric: settings.metric, metricColumn: settings.metricColumn };
  const line = {
    metric: settings.lineMetric,
    metricColumn: settings.lineMetricColumn,
  };
  const dual =
    chartMetricUnit(bars, columns) !== chartMetricUnit(line, columns);
  const barsLabel = chartMetricLabel(bars, columns, locale, translate);
  const lineLabel = chartMetricLabel(line, columns, locale, translate);
  const series: ChartSeriesItem[] = [
    {
      id: COMBO_BAR_ID,
      label: barsLabel,
      color: palette.at(0) ?? otherColor,
      mark: "bar",
      axis: "left",
      format: base.format,
    },
    {
      id: COMBO_LINE_ID,
      label: lineLabel,
      color: palette.at(1) ?? palette.at(0) ?? otherColor,
      mark: "line",
      axis: dual ? "right" : "left",
      format: chartValueFormatter(line, columns, locale),
    },
  ];
  const tables = tabulateMetrics(input.result, [COMBO_BAR_ID, COMBO_LINE_ID]);
  fillCategories(tables, settings, x);
  const plan: SeriesPlan = {
    series,
    shownAs: new Map(series.map((item) => [item.id, item.id])),
  };
  const bucket = x?.type === "date" ? settings.bucket : undefined;
  const categories = limitCategories(
    buildCategories(tables, plan, input, x, (key) =>
      groupKeyLabel(key, x, bucket, locale, translate)
    ),
    input,
    series
  );
  const valuesOf = (id: string) =>
    categories.map((category) => category.values[id] ?? 0);
  const valueTicks = chartValueTicks(
    dual
      ? valuesOf(COMBO_BAR_ID)
      : [...valuesOf(COMBO_BAR_ID), ...valuesOf(COMBO_LINE_ID)],
    isCounting(settings.metric) && (dual || isCounting(settings.lineMetric))
  );
  const secondary = dual
    ? {
        secondaryTicks: chartAlignedTicks(
          valuesOf(COMBO_LINE_ID),
          valueTicks.length - 1,
          isCounting(settings.lineMetric)
        ),
      }
    : {};
  return {
    ...base,
    stacked: false,
    percent: false,
    totalColumn: false,
    title: chartLabel("comboOf", locale, translate, {
      bars: barsLabel,
      line: lineLabel,
      column: base.xLabel,
    }),
    categories,
    series,
    single: false,
    total: categories.reduce((sum, category) => sum + category.total, 0),
    valueTicks,
    ...secondary,
    empty: categories.every((category) =>
      Object.values(category.values).every((value) => value === 0)
    ),
  };
}

/** Funnel stages: each value, its share of the first stage and its conversion from the previous. */
function funnelStages(
  categories: readonly ChartCategory[],
  base: Pick<ModelBase, "format" | "formatShare">,
  label: (key: ChartLabelKey, params: Record<string, string>) => string
): ChartFunnelStage[] {
  const first = categories.at(0)?.total ?? 0;
  const percent = (share: number | undefined) =>
    share === undefined ? "—" : base.formatShare(share);
  return categories.map((category, index) => {
    const value = category.total;
    const previous = index > 0 ? categories[index - 1]?.total : undefined;
    const shareOfFirst = first ? value / first : undefined;
    const conversion = previous ? value / previous : undefined;
    const stage: ChartFunnelStage = {
      id: category.id,
      category,
      label: category.label,
      color: category.color,
      value,
      valueText: base.format(value),
      shareText: label("ofFirst", { percent: percent(shareOfFirst) }),
    };
    if (shareOfFirst !== undefined) {
      stage.shareOfFirst = shareOfFirst;
    }
    if (conversion !== undefined) {
      stage.conversion = conversion;
    }
    if (index > 0) {
      stage.conversionText = label("fromPrevious", {
        percent: percent(conversion),
      });
    }
    return stage;
  });
}

/** Everything a renderer draws: categories, series, colors, labels and formats. */
export function buildChartModel(input: ChartModelInput): ChartModel {
  const { settings, columns, locale, translate } = input;
  const x = columnById(columns, settings.xColumn);
  const seriesColumn = columnById(columns, settings.seriesColumn);
  const format = chartValueFormatter(settings, columns, locale);
  const valueLabel = chartMetricLabel(settings, columns, locale, translate);
  const xLabel = x?.header ?? x?.id ?? "";
  const common: ModelBase = {
    type: settings.type,
    stacked: isStackedChart(settings),
    percent:
      settings.type === "area" &&
      settings.stacking === "percent" &&
      Boolean(seriesColumn),
    xLabel,
    valueLabel,
    title: chartLabel("chartOf", locale, translate, {
      metric: valueLabel,
      column: xLabel,
    }),
    format,
    formatShare: chartShareFormatter(locale),
    totalColumn: Boolean(seriesColumn),
  };
  if (settings.type === "number") {
    const total = input.result.groups.at(0)?.values.at(0) ?? 0;
    return {
      ...common,
      title: valueLabel,
      categories: [],
      series: [],
      single: true,
      total,
      valueTicks: [],
      empty: false,
    };
  }
  if (settings.type === "combo") {
    return buildComboModel(input, common);
  }
  const bucketOf = (column: ChartColumn | undefined) =>
    column?.type === "date" ? settings.bucket : undefined;
  const labelFor = (column: ChartColumn | undefined) => (key: unknown) =>
    groupKeyLabel(key, column, bucketOf(column), locale, translate);
  const tables = tabulate(input.result, Boolean(seriesColumn));
  fillCategories(tables, settings, x);
  const plan = planSeries(tables, input, seriesColumn, labelFor(seriesColumn));
  let categories = limitCategories(
    buildCategories(tables, plan, input, x, labelFor(x)),
    input,
    plan.series
  );
  if (settings.cumulative && CUMULATIVE_TYPES.has(settings.type)) {
    categories = cumulate(categories);
  }
  if (common.percent) {
    categories = categories.map((category) => ({
      ...category,
      shares: chartShares(category.values),
    }));
  }
  const total =
    settings.type === "donut" || settings.type === "funnel"
      ? categories.reduce((sum, category) => sum + category.total, 0)
      : [...tables.series.values()].reduce((sum, item) => sum + item.total, 0);
  let valueTicks: number[] = [];
  if (common.percent) {
    valueTicks = [...PERCENT_TICKS];
  } else if (settings.type !== "funnel") {
    valueTicks = chartValueTicks(
      plottedValues(categories, settings),
      isCounting(settings.metric)
    );
  }
  const funnel =
    settings.type === "funnel"
      ? {
          stages: funnelStages(categories, common, (key, params) =>
            chartLabel(key, locale, translate, params)
          ),
        }
      : {};
  return {
    ...common,
    categories,
    series: plan.series,
    single: !seriesColumn,
    total,
    valueTicks,
    ...funnel,
    empty: categories.every((category) => category.total === 0),
  };
}

/**
 * A category's value for a series as tables and tooltips show it: in the
 * series' format (combo metrics have their own), with its share of the
 * category when areas are stacked to 100 %, e.g. "2 (50%)".
 */
export function chartValueText(
  model: Pick<ChartModel, "format" | "formatShare" | "percent">,
  category: Pick<ChartCategory, "shares" | "values"> | undefined,
  series: Pick<ChartSeriesItem, "format" | "id"> | undefined
): string {
  const id = series?.id ?? VALUE_SERIES_ID;
  const text = (series?.format ?? model.format)(category?.values[id] ?? 0);
  const share = model.percent ? category?.shares?.[id] : undefined;
  return share === undefined ? text : `${text} (${model.formatShare(share)})`;
}

/** Average width of an 11px data label character. */
const DATA_LABEL_CHAR_WIDTH = 7;

/**
 * Room, in pixels, that horizontal bars keep past their end for their value
 * labels, so the longest bar's label is not cut at the chart's edge.
 */
export function chartBarLabelRoom(
  model: Pick<ChartModel, "categories" | "format" | "series" | "stacked">
): number {
  const lengths = model.categories.map((category) =>
    model.stacked || model.series.length === 1
      ? model.format(category.total).length
      : Math.max(
          0,
          ...model.series.map(
            (item) => model.format(category.values[item.id] ?? 0).length
          )
        )
  );
  return Math.max(0, ...lengths) * DATA_LABEL_CHAR_WIDTH;
}

/** The value axis of a chart: shares when stacked to 100 %, else values. */
export const chartTickFormat = (
  model: Pick<ChartModel, "format" | "formatShare" | "percent">
): ((value: number) => string) =>
  model.percent ? model.formatShare : model.format;

// Funnel geometry ------------------------------------------------------------------

/**
 * Stages side by side from left to right (`vertical`, like vertical bars) or
 * stacked from top to bottom (`horizontal`, on narrow widths).
 */
export type ChartFunnelOrientation = "vertical" | "horizontal";

/** Width each stage needs side by side; narrower charts stack the stages. */
export const FUNNEL_STAGE_MIN_WIDTH = 120;
/** Charts narrower than this always stack the stages. */
export const FUNNEL_MIN_WIDE_WIDTH = 480;
/** Width drawn before the chart is measured. */
export const FUNNEL_DEFAULT_WIDTH = 640;
/** A vertical funnel is as tall as the other charts. */
const FUNNEL_HEIGHT = 320;
/** Two text lines above the shapes and two below, in a vertical funnel. */
const FUNNEL_TEXT_BAND = 48;
/** Each stage of a horizontal funnel: a text line, the shape, a text line. */
const FUNNEL_ROW_HEIGHT = 76;
const FUNNEL_ROW_SHAPE_TOP = 22;
const FUNNEL_ROW_SHAPE_HEIGHT = 28;
const FUNNEL_GAP = 6;
/** Zero stages keep a sliver, so every stage stays visible and clickable. */
const FUNNEL_MIN_SIZE = 2;
/** Average width of a 12px label character, to cut labels that do not fit. */
const FUNNEL_CHAR_WIDTH = 7;
const FUNNEL_TEXT_PADDING = 8;

/** A text of the funnel: position (SVG baseline), alignment and content. */
export interface ChartFunnelText {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  text: string;
}

export interface ChartFunnelShape {
  stage: ChartFunnelStage;
  /**
   * SVG polygon points: the leading edge is as long as the stage's value, the
   * trailing edge as the next stage's (the last stage ends square).
   */
  points: string;
  /** The stage's area (shape and texts), e.g. for the button over it. */
  box: { x: number; y: number; width: number; height: number };
  name: ChartFunnelText;
  value: ChartFunnelText;
  share: ChartFunnelText;
  conversion?: ChartFunnelText;
}

export interface ChartFunnelLayout {
  orientation: ChartFunnelOrientation;
  width: number;
  height: number;
  shapes: ChartFunnelShape[];
}

/** Stages side by side when each gets `FUNNEL_STAGE_MIN_WIDTH`, else stacked. */
export function chartFunnelOrientation(
  width: number,
  stageCount: number
): ChartFunnelOrientation {
  return width >=
    Math.max(FUNNEL_MIN_WIDE_WIDTH, stageCount * FUNNEL_STAGE_MIN_WIDTH)
    ? "vertical"
    : "horizontal";
}

/** A label cut to the width it has, with an ellipsis. */
export function fitChartLabel(text: string, width: number): string {
  const characters = Math.max(1, Math.floor(width / FUNNEL_CHAR_WIDTH));
  return text.length > characters
    ? `${text.slice(0, Math.max(1, characters - 1)).trimEnd()}…`
    : text;
}

const roundPixel = (value: number) => Math.round(value * 10) / 10;
const toPoints = (points: [number, number][]) =>
  points.map(([x, y]) => `${roundPixel(x)},${roundPixel(y)}`).join(" ");

function verticalFunnel(
  stages: readonly ChartFunnelStage[],
  width: number,
  sizeOf: (value: number, full: number) => number
): ChartFunnelShape[] {
  const slot = width / Math.max(1, stages.length);
  const full = FUNNEL_HEIGHT - FUNNEL_TEXT_BAND * 2;
  const middle = FUNNEL_HEIGHT / 2;
  const room = slot - FUNNEL_TEXT_PADDING;
  return stages.map((stage, index) => {
    const lead = sizeOf(stage.value, full);
    const next = stages[index + 1];
    const trail = next ? sizeOf(next.value, full) : lead;
    const start = index * slot + FUNNEL_GAP / 2;
    const end = (index + 1) * slot - FUNNEL_GAP / 2;
    const center = roundPixel(index * slot + slot / 2);
    const text = (y: number, content: string): ChartFunnelText => ({
      x: center,
      y,
      anchor: "middle",
      text: fitChartLabel(content, room),
    });
    return {
      stage,
      points: toPoints([
        [start, middle - lead / 2],
        [end, middle - trail / 2],
        [end, middle + trail / 2],
        [start, middle + lead / 2],
      ]),
      box: {
        x: roundPixel(index * slot),
        y: 0,
        width: roundPixel(slot),
        height: FUNNEL_HEIGHT,
      },
      name: text(16, stage.label),
      value: text(36, stage.valueText),
      share: text(FUNNEL_HEIGHT - 24, stage.shareText),
      ...(stage.conversionText
        ? { conversion: text(FUNNEL_HEIGHT - 6, stage.conversionText) }
        : {}),
    };
  });
}

function horizontalFunnel(
  stages: readonly ChartFunnelStage[],
  width: number,
  sizeOf: (value: number, full: number) => number
): ChartFunnelShape[] {
  const middle = width / 2;
  const half = width / 2 - FUNNEL_TEXT_PADDING / 2;
  return stages.map((stage, index) => {
    const top = index * FUNNEL_ROW_HEIGHT;
    const shapeTop = top + FUNNEL_ROW_SHAPE_TOP;
    const shapeBottom = shapeTop + FUNNEL_ROW_SHAPE_HEIGHT;
    const lead = sizeOf(stage.value, width);
    const next = stages[index + 1];
    const trail = next ? sizeOf(next.value, width) : lead;
    const valueWidth =
      stage.valueText.length * FUNNEL_CHAR_WIDTH + FUNNEL_TEXT_PADDING;
    return {
      stage,
      points: toPoints([
        [middle - lead / 2, shapeTop],
        [middle + lead / 2, shapeTop],
        [middle + trail / 2, shapeBottom],
        [middle - trail / 2, shapeBottom],
      ]),
      box: { x: 0, y: top, width, height: FUNNEL_ROW_HEIGHT },
      name: {
        x: 0,
        y: top + 15,
        anchor: "start",
        text: fitChartLabel(stage.label, width - valueWidth),
      },
      value: { x: width, y: top + 15, anchor: "end", text: stage.valueText },
      share: {
        x: 0,
        y: top + 66,
        anchor: "start",
        text: fitChartLabel(stage.shareText, half),
      },
      ...(stage.conversionText
        ? {
            conversion: {
              x: width,
              y: top + 66,
              anchor: "end" as const,
              text: fitChartLabel(stage.conversionText, half),
            },
          }
        : {}),
    };
  });
}

/**
 * Shapes and texts of a funnel `width` pixels wide, the same in both editions:
 * stages side by side on wide charts, stacked on narrow ones. Shapes are as
 * long as their stage's value against the largest one.
 */
export function chartFunnelLayout(
  stages: readonly ChartFunnelStage[],
  width: number
): ChartFunnelLayout {
  const drawn = roundPixel(width > 0 ? width : FUNNEL_DEFAULT_WIDTH);
  const orientation = chartFunnelOrientation(drawn, stages.length);
  const largest = Math.max(0, ...stages.map((stage) => stage.value));
  const sizeOf = (value: number, full: number) =>
    largest > 0
      ? Math.max(FUNNEL_MIN_SIZE, (Math.max(0, value) / largest) * full)
      : FUNNEL_MIN_SIZE;
  return orientation === "vertical"
    ? {
        orientation,
        width: drawn,
        height: FUNNEL_HEIGHT,
        shapes: verticalFunnel(stages, drawn, sizeOf),
      }
    : {
        orientation,
        width: drawn,
        height: Math.max(1, stages.length) * FUNNEL_ROW_HEIGHT,
        shapes: horizontalFunnel(stages, drawn, sizeOf),
      };
}

// Filtering on click -------------------------------------------------------------

/** An advanced filter rule, as saved views and the filter menus store them. */
export interface ChartFilterRule {
  id: string;
  columnId: string;
  type: string;
  operator: string;
  values: unknown[];
  isActive: true;
}

/**
 * The rule the table's own filter menus would write for a group: the
 * column's filter type (booleans are select filters, emails and links text
 * filters) with one of that type's operators, so hosts and saved views read
 * it like any other rule. Yes/no groups select their stored value.
 */
function ruleFor(
  column: ChartColumn,
  key: unknown,
  bucket: ChartBucket
): Omit<ChartFilterRule, "id" | "isActive"> | undefined {
  const type = dataTypeFilter(
    column.type,
    Array.isArray(column.options) && column.options.length > 0
  );
  const base = { columnId: column.id, type };
  if (key === null || key === undefined) {
    return { ...base, operator: "isEmpty", values: [] };
  }
  switch (type) {
    case "date": {
      const range =
        typeof key === "string" ? chartBucketRange(key, bucket) : undefined;
      return range
        ? { ...base, operator: "between", values: range }
        : undefined;
    }
    case "multiSelect":
      return { ...base, operator: "contains", values: [key] };
    case "select":
      return { ...base, operator: "isAnyOf", values: [key] };
    default:
      return { ...base, operator: "equals", values: [key] };
  }
}

/**
 * Filter rules selecting the records of a group: its x value (and series value).
 * Undefined for "Other" groups, which do not map to one value.
 */
export function chartGroupFilters(
  settings: ResolvedChartSettings,
  columns: readonly ChartColumn[],
  group: { category?: ChartCategory; series?: ChartSeriesItem }
): ChartFilterRule[] | undefined {
  const parts: [ChartColumn | undefined, unknown][] = [];
  if (group.category) {
    if (group.category.other) {
      return;
    }
    parts.push([columnById(columns, settings.xColumn), group.category.key]);
  }
  // Combo metrics are series without a column: the x value is the group.
  if (
    group.series &&
    group.series.id !== VALUE_SERIES_ID &&
    settings.seriesColumn
  ) {
    if (group.series.other) {
      return;
    }
    parts.push([columnById(columns, settings.seriesColumn), group.series.key]);
  }
  const rules: ChartFilterRule[] = [];
  for (const [index, [column, key]] of parts.entries()) {
    const rule = column ? ruleFor(column, key, settings.bucket) : undefined;
    if (!rule) {
      return;
    }
    rules.push({ ...rule, id: `chart-${column?.id}-${index}`, isActive: true });
  }
  return rules.length ? rules : undefined;
}

/** Whether group rules can join the view's filters: not when they match any rule. */
export function canAddChartFilters(advancedFilters: unknown): boolean {
  const envelope = normalizeFilterEnvelope(advancedFilters);
  const active = envelope.filters.filter((filter) => filter.isActive !== false);
  return envelope.joinOperator !== "or" || active.length < 2;
}

/**
 * The view's rules followed by the group's, all required. Rule ids stay unique
 * so the filter menus can edit or remove each one.
 */
export function withChartFilters(
  advancedFilters: unknown,
  rules: readonly ChartFilterRule[],
  stamp: string = String(Date.now())
): { filters: Record<string, unknown>[]; joinOperator: "and" } {
  const envelope = normalizeFilterEnvelope(advancedFilters);
  const existing = envelope.filters.map((filter) => {
    const copy = { ...filter };
    Reflect.deleteProperty(copy, "joinOperator");
    return copy;
  });
  return {
    filters: [
      ...existing,
      ...rules.map((rule) => ({ ...rule, id: `${rule.id}-${stamp}` })),
    ],
    joinOperator: "and",
  };
}

// Settings panel ------------------------------------------------------------------

/** One select of the chart settings, the same in both editions. */
export interface ChartSettingField {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

const NONE = "";
const TOP_N_CHOICES = [3, 5, 10, 20];
const WEEK_STARTS = [
  { value: 1, key: "monday" },
  { value: 0, key: "sunday" },
  { value: 6, key: "saturday" },
] as const;
const TYPE_LABELS: Record<ChartType, ChartLabelKey> = {
  bar: "typeBar",
  horizontalBar: "typeHorizontalBar",
  line: "typeLine",
  area: "typeArea",
  combo: "typeCombo",
  donut: "typeDonut",
  funnel: "typeFunnel",
  number: "typeNumber",
};
const STACKING_KEYS: Record<ChartStacking, ChartLabelKey> = {
  stacked: "stackingStacked",
  percent: "stackingPercent",
  none: "stackingNone",
};
const CURVE_KEYS: Record<ChartCurve, ChartLabelKey> = {
  smooth: "curveSmooth",
  linear: "curveLinear",
};
const METRIC_KEYS: Record<ChartMetricFn, ChartLabelKey> = {
  count: "metricCount",
  sum: "metricSum",
  avg: "metricAvg",
  min: "metricMin",
  max: "metricMax",
  countDistinct: "metricCountDistinct",
};
const SORT_KEYS: Record<ChartSort, ChartLabelKey> = {
  auto: "sortAuto",
  keyAsc: "sortKeyAsc",
  keyDesc: "sortKeyDesc",
  valueAsc: "sortValueAsc",
  valueDesc: "sortValueDesc",
  manual: "sortManual",
};

export interface ChartSettingFieldsInput {
  columns: readonly ChartColumn[];
  defaults?: ChartViewSettings;
  view: ChartViewSettings;
  locale: string;
  translate?: ChartTranslate;
  /** Saves the view's settings; undefined and empty values are left out. */
  update: (settings: Record<string, unknown>) => void;
}

interface FieldContext {
  label: (
    key: ChartLabelKey,
    params?: Record<string, number | string>
  ) => string;
  active: ResolvedChartSettings;
  set: (patch: Record<string, unknown>) => void;
  columns: readonly ChartColumn[];
}

const columnOption = (column: ChartColumn) => ({
  value: column.id,
  label: column.header ?? column.id,
});

function onOffField(
  context: FieldContext,
  key: "cumulative" | "hideEmpty" | "showDataLabels" | "showLegend" | "stacked"
): ChartSettingField {
  return {
    id: key,
    label: context.label(key),
    value: context.active[key] ? "on" : "off",
    options: [
      { value: "on", label: context.label("on") },
      { value: "off", label: context.label("off") },
    ],
    onChange: (value) => context.set({ [key]: value === "on" }),
  };
}

function axisFields(context: FieldContext): ChartSettingField[] {
  const { active, label, set, columns } = context;
  const x = columnById(columns, active.xColumn);
  const fields: ChartSettingField[] = [
    {
      id: "xColumn",
      label: label("xColumn"),
      value: active.xColumn ?? NONE,
      options: chartGroupColumns(columns).map(columnOption),
      onChange: (value) => set({ xColumn: value }),
    },
  ];
  if (x?.type === "date") {
    fields.push({
      id: "bucket",
      label: label("bucket"),
      value: active.bucket,
      options: CHART_BUCKETS.map((bucket) => ({
        value: bucket,
        label: label(bucket),
      })),
      onChange: (value) => set({ bucket: value }),
    });
  }
  if (x?.type === "date" && active.bucket === "week") {
    fields.push({
      id: "weekStartsOn",
      label: label("weekStartsOn"),
      value: String(active.weekStartsOn),
      options: WEEK_STARTS.map((day) => ({
        value: String(day.value),
        label: label(day.key),
      })),
      onChange: (value) => set({ weekStartsOn: Number(value) }),
    });
  }
  return fields;
}

const metricCandidates = (
  columns: readonly ChartColumn[],
  metric: ChartMetricFn
): ChartColumn[] =>
  metric === "countDistinct"
    ? chartGroupColumns(columns)
    : chartNumberColumns(columns);

/** A metric reading a column keeps the chosen one when it fits, else takes the first that does. */
function metricColumnFor(
  columns: readonly ChartColumn[],
  metric: ChartMetricFn,
  current: string | undefined
): string | undefined {
  if (metric === "count") {
    return;
  }
  const candidates = metricCandidates(columns, metric);
  return candidates.some((column) => column.id === current)
    ? current
    : candidates.at(0)?.id;
}

/** A metric's settings: the bars' (`metric`) or a combo chart's line (`lineMetric`). */
interface MetricKeys {
  metric: "metric" | "lineMetric";
  column: "metricColumn" | "lineMetricColumn";
  label: ChartLabelKey;
  columnLabel: ChartLabelKey;
}

const METRIC_SETTINGS: MetricKeys = {
  metric: "metric",
  column: "metricColumn",
  label: "metric",
  columnLabel: "metricColumn",
};
const BAR_METRIC_SETTINGS: MetricKeys = {
  ...METRIC_SETTINGS,
  label: "barMetric",
  columnLabel: "barMetricColumn",
};
const LINE_METRIC_SETTINGS: MetricKeys = {
  metric: "lineMetric",
  column: "lineMetricColumn",
  label: "lineMetric",
  columnLabel: "lineMetricColumn",
};

function metricFields(
  context: FieldContext,
  keys: MetricKeys = METRIC_SETTINGS
): ChartSettingField[] {
  const { active, label, set, columns } = context;
  const metric = active[keys.metric];
  const current = active[keys.column];
  const fields: ChartSettingField[] = [
    {
      id: keys.metric,
      label: label(keys.label),
      value: metric,
      options: CHART_METRICS.map((item) => ({
        value: item,
        label: label(METRIC_KEYS[item]),
      })),
      onChange: (value) =>
        set({
          [keys.metric]: value,
          [keys.column]: metricColumnFor(
            columns,
            value as ChartMetricFn,
            current
          ),
        }),
    },
  ];
  if (metric !== "count") {
    const candidates = metricCandidates(columns, metric);
    fields.push({
      id: keys.column,
      label: label(keys.columnLabel),
      value: current ?? NONE,
      options: candidates.map(columnOption),
      onChange: (value) => set({ [keys.column]: value }),
    });
  }
  return fields;
}

function curveField(context: FieldContext): ChartSettingField {
  const { active, label, set } = context;
  return {
    id: "curve",
    label: label("curve"),
    value: active.curve,
    options: CHART_CURVES.map((curve) => ({
      value: curve,
      label: label(CURVE_KEYS[curve]),
    })),
    onChange: (value) => set({ curve: value }),
  };
}

function seriesFields(context: FieldContext): ChartSettingField[] {
  const { active, label, set, columns } = context;
  if (!SERIES_TYPES.has(active.type)) {
    return [];
  }
  const fields: ChartSettingField[] = [
    {
      id: "seriesColumn",
      label: label("seriesColumn"),
      value: active.seriesColumn ?? NONE,
      options: [
        { value: NONE, label: label("none") },
        ...chartGroupColumns(columns)
          .filter(
            (column) => column.id !== active.xColumn && column.type !== "date"
          )
          .map(columnOption),
      ],
      onChange: (value) => set({ seriesColumn: value }),
    },
  ];
  if (active.seriesColumn && active.type === "area") {
    fields.push({
      id: "stacking",
      label: label("stacking"),
      value: active.stacking,
      options: CHART_STACKINGS.map((stacking) => ({
        value: stacking,
        label: label(STACKING_KEYS[stacking]),
      })),
      onChange: (value) => set({ stacking: value }),
    });
  } else if (active.seriesColumn && active.type !== "line") {
    fields.push(onOffField(context, "stacked"));
  }
  if (active.type === "line" || active.type === "area") {
    fields.push(curveField(context));
  }
  return fields;
}

function topNField(context: FieldContext): ChartSettingField {
  const { active, label, set } = context;
  return {
    id: "topN",
    label: label("topN"),
    value: active.topN ? String(active.topN) : NONE,
    options: [
      { value: NONE, label: label("topAll") },
      ...TOP_N_CHOICES.map((count) => ({
        value: String(count),
        label: label("top", { count }),
      })),
    ],
    onChange: (value) => set({ topN: value ? Number(value) : undefined }),
  };
}

function colorsField(context: FieldContext): ChartSettingField {
  const { active, label, set } = context;
  return {
    id: "colors",
    label: label("colors"),
    value: active.colors,
    options: [
      { value: "options", label: label("colorsOptions") },
      { value: "palette", label: label("colorsPalette") },
    ],
    onChange: (value) => set({ colors: value }),
  };
}

function displayFields(context: FieldContext): ChartSettingField[] {
  const { active, label, set } = context;
  if (active.type === "funnel") {
    // Stages keep their order (see `chartStageList`) and always show their numbers.
    return [
      onOffField(context, "hideEmpty"),
      onOffField(context, "showLegend"),
      colorsField(context),
    ];
  }
  const fields: ChartSettingField[] = [
    {
      id: "sort",
      label: label("sort"),
      value: active.sort,
      options: CHART_SORTS.map((sort) => ({
        value: sort,
        label: label(SORT_KEYS[sort]),
      })),
      onChange: (value) => set({ sort: value === "auto" ? undefined : value }),
    },
  ];
  if (CUMULATIVE_TYPES.has(active.type)) {
    fields.push(onOffField(context, "cumulative"));
  }
  fields.push(
    onOffField(context, "hideEmpty"),
    topNField(context),
    onOffField(context, "showDataLabels"),
    onOffField(context, "showLegend")
  );
  // Combo charts draw their two metrics in the palette's first colors.
  if (active.type !== "combo") {
    fields.push(colorsField(context));
  }
  return fields;
}

/** Saves a patch of the view's settings, leaving out undefined and empty values. */
function settingsWriter(
  view: ChartViewSettings,
  update: (settings: Record<string, unknown>) => void
) {
  return (patch: Record<string, unknown>) => {
    const next: Record<string, unknown> = { ...view, ...patch };
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === NONE) {
        Reflect.deleteProperty(next, key);
      }
    }
    update(next);
  };
}

/** The fields of a chart type, after its type. */
function typeFields(context: FieldContext): ChartSettingField[] {
  switch (context.active.type) {
    case "number":
      return metricFields(context);
    case "combo":
      return [
        ...axisFields(context),
        ...metricFields(context, BAR_METRIC_SETTINGS),
        ...metricFields(context, LINE_METRIC_SETTINGS),
        curveField(context),
        ...displayFields(context),
      ];
    default:
      return [
        ...axisFields(context),
        ...metricFields(context),
        ...seriesFields(context),
        ...displayFields(context),
      ];
  }
}

/** The chart settings panel: type, axes, grouping and display, as selects. */
export function chartSettingFields(
  input: ChartSettingFieldsInput
): ChartSettingField[] {
  const { columns, defaults, view, locale, translate, update } = input;
  const active = resolveChartSettings(columns, defaults, view);
  const set = settingsWriter(view, update);
  const context: FieldContext = {
    label: (key, params) => chartLabel(key, locale, translate, params),
    active,
    set,
    columns,
  };
  const typeField: ChartSettingField = {
    id: "type",
    label: context.label("chartType"),
    value: active.type,
    options: CHART_TYPES.map((type) => ({
      value: type,
      label: context.label(TYPE_LABELS[type]),
    })),
    onChange: (value) => set({ type: value }),
  };
  return [typeField, ...typeFields(context)];
}

/** One stage of the stage order list. */
export interface ChartStageItem {
  /** The option value, as text. */
  value: string;
  label: string;
  moveUpLabel: string;
  moveDownLabel: string;
}

/** The funnel's stage order in the settings panel: drag or arrows to move a stage. */
export interface ChartStageList {
  label: string;
  hint: string;
  resetLabel: string;
  stages: ChartStageItem[];
  /** The view saves its own order; `reset` returns to the table's (or the option order). */
  customized: boolean;
  /** Moves the stage at `from` to `to` and saves the order. */
  move: (from: number, to: number) => void;
  reset: () => void;
}

/** Saved stages that are options, then the other options in option order. */
function stageOrderOf(
  optionOrder: readonly string[],
  saved: readonly string[] | undefined
): string[] {
  const known = (saved ?? []).filter((value) => optionOrder.includes(value));
  return [...known, ...optionOrder.filter((value) => !known.includes(value))];
}

const sameOrder = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

/**
 * The stage order list of a funnel whose stages are the options of a select
 * column; undefined for other charts and columns. Both editions render it
 * after the settings fields.
 */
export function chartStageList(
  input: ChartSettingFieldsInput
): ChartStageList | undefined {
  const { columns, defaults, view, locale, translate, update } = input;
  const active = resolveChartSettings(columns, defaults, view);
  const column = columnById(columns, active.xColumn);
  if (
    active.type !== "funnel" ||
    !(column && OPTION_TYPES.has(column.type ?? ""))
  ) {
    return;
  }
  const options = Array.isArray(column.options)
    ? column.options.map(recordValue)
    : [];
  const values = options
    .map((option) => String(option.value ?? ""))
    .filter((value) => value !== "");
  if (!values.length) {
    return;
  }
  const label = (key: ChartLabelKey, params?: Record<string, string>) =>
    chartLabel(key, locale, translate, params);
  const set = settingsWriter(view, update);
  const inherited = stageOrderOf(
    values,
    normalizeChartViewConfig(defaults)?.stageOrder
  );
  const order = stageOrderOf(values, active.stageOrder);
  const labelOf = (value: string) =>
    dataTypeOptionLabel(
      options.find((option) => String(option.value) === value)?.value ?? value,
      column.options
    );
  return {
    label: label("stageOrder"),
    hint: label("stageOrderHint"),
    resetLabel: label("stageOrderReset"),
    stages: order.map((value) => {
      const stage = labelOf(value);
      return {
        value,
        label: stage,
        moveUpLabel: label("moveStageUp", { stage }),
        moveDownLabel: label("moveStageDown", { stage }),
      };
    }),
    customized: Boolean(normalizeChartViewConfig(view)?.stageOrder),
    move: (from, to) => {
      const next = [...order];
      const [moved] = next.splice(from, 1);
      if (moved === undefined || to < 0 || to >= order.length) {
        return;
      }
      next.splice(to, 0, moved);
      // The table's order needs no copy in the view.
      set({ stageOrder: sameOrder(next, inherited) ? undefined : next });
    },
    reset: () => set({ stageOrder: undefined }),
  };
}
