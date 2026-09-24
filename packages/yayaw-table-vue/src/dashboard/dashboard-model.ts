/**
 * Dashboards: a grid of widgets (saved views of any table, numbers and notes)
 * with dashboard-wide filters. Framework-neutral and shared by the React and
 * Vue editions (synced to Vue by `scripts/sync-table-contracts.mjs`), so both
 * normalize, lay out, filter and label dashboards the same way.
 */
import {
  type ChartAggregateGroup,
  type ChartAggregateRequest,
  type ChartBucket,
  type ChartColumn,
  chartBucketKey,
  chartBucketLabel,
  chartBucketRange,
  chartValueFormatter,
  loadChartData,
} from "../chart-model";
import { normalizeFilterEnvelope } from "../table-contracts";
import { type ColumnValueFormat, formatColumnDay } from "../value-format";

// Contract ----------------------------------------------------------------------

/** Version of the dashboard JSON written by `normalizeDashboard`. */
export const DASHBOARD_VERSION = 1;
/** Widgets per row on desktop. */
export const DASHBOARD_COLUMNS = 4;
/** Tallest widget, in rows. */
export const DASHBOARD_MAX_HEIGHT = 12;
/** Height of one row, in pixels (the gaps are included). */
export const DASHBOARD_ROW_HEIGHT = 120;
/** Space around each widget, in pixels. */
export const DASHBOARD_MARGIN = 6;
/** Grids narrower than this (phones) stack widgets in one column, without drag. */
export const DASHBOARD_PHONE_MAX_WIDTH = 639;

export type DashboardWidgetType = "view" | "kpi" | "note";
export type DashboardKpiMetric = "count" | "sum" | "avg" | "min" | "max";
export type DashboardFilterType = "dateRange" | "select";
export type DashboardDirection = "left" | "right" | "up" | "down";
export type DashboardResize = "wider" | "narrower" | "taller" | "shorter";

/** Where a widget sits: columns `x`…`x + w - 1`, rows `y`…`y + h - 1`. */
export interface DashboardLayoutItem {
  widgetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A widget. `view`: a saved view (`viewId`, or the table's default view) of
 * `tableId` shown in its display mode, `settings: { overflow? }`. `kpi`: one
 * number over a table (or a view's records), `settings: { metric,
 * metricColumn?, label?, dateColumn?, compare?, sparkline? }`. `note`: text,
 * `settings: { text }`, rendered by the host's `renderMarkdown`.
 */
export interface DashboardWidget {
  id: string;
  type: DashboardWidgetType;
  tableId?: string;
  viewId?: string;
  /** Title shown instead of the view's name. */
  title?: string;
  settings: Record<string, unknown>;
}

/** Calendar days `YYYY-MM-DD`, both optional. */
export interface DashboardDateRange {
  start?: string;
  end?: string;
}

/** A column a filter applies to: every widget of `tableId`, or only `widgetIds`. */
export interface DashboardFilterTarget {
  tableId: string;
  columnId: string;
  widgetIds?: string[];
}

export interface DashboardFilterOption {
  value: string;
  label: string;
}

/**
 * A dashboard filter, joined (AND) to each targeted widget's own filters and
 * sent to the table's `list`/`aggregate`. `value` is a date range or the
 * chosen options; empty values filter nothing.
 */
export interface DashboardFilter {
  id: string;
  type: DashboardFilterType;
  label: string;
  targets: DashboardFilterTarget[];
  /** Choices of a select filter; by default the first target column's options. */
  options?: DashboardFilterOption[];
  value?: DashboardDateRange | string[];
}

export interface Dashboard {
  version: typeof DASHBOARD_VERSION;
  id: string;
  name: string;
  layout: DashboardLayoutItem[];
  widgets: DashboardWidget[];
  filters: DashboardFilter[];
  updatedAt?: string;
}

export interface DashboardSummary {
  id: string;
  name: string;
}

/**
 * `actions.dashboards`: the host stores dashboards. `load` may return JSON
 * written by an older version; it is normalized before use.
 */
export interface DashboardStorage {
  list: () => Promise<DashboardSummary[]>;
  load: (id: string) => Promise<unknown>;
  save: (dashboard: Dashboard) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
}

/** What the dashboard knows of a table: its name and columns. */
export interface DashboardTableInfo {
  name: string;
  columns: readonly DashboardColumn[];
  /** The table's `coloredTags` setting (default true), for option tags. */
  coloredTags?: boolean;
  /** The table's `defaultDisplayMode`, which sizes widgets of its default view. */
  defaultDisplayMode?: string;
}

/** A column as the dashboard reads it, formats included. */
export interface DashboardColumn extends ColumnValueFormat {
  id: string;
  header?: string;
  type?: string;
  options?: readonly { value: unknown; label?: string }[];
}

/** The fields of a table column a dashboard keeps: its name, type, options and formats. */
export function dashboardColumn(column: DashboardColumn): DashboardColumn {
  return {
    id: column.id,
    header: column.header,
    type: column.type,
    options: column.options,
    numberFormat: column.numberFormat,
    dateDisplayPreset: column.dateDisplayPreset,
    dateFormat: column.dateFormat,
    timeZone: column.timeZone,
    hour12: column.hour12,
  };
}

/** A saved view a widget can show. */
export interface DashboardView {
  id: string;
  name: string;
  config: Record<string, unknown>;
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";
const integer = (value: unknown, fallback: number): number => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
};
const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

// Layout ------------------------------------------------------------------------

const DEFAULT_SIZES: Record<DashboardWidgetType, { w: number; h: number }> = {
  view: { w: 2, h: 2 },
  kpi: { w: 1, h: 1 },
  note: { w: 1, h: 2 },
};

/**
 * View widgets by display mode: records and charts take 2×2 (the default),
 * boards, galleries, calendars and feeds 2×3, file trees 1×3, Gantt charts
 * the whole width.
 */
const MODE_SIZES: Readonly<Record<string, { w: number; h: number }>> = {
  kanban: { w: 2, h: 3 },
  gallery: { w: 2, h: 3 },
  calendar: { w: 2, h: 3 },
  feed: { w: 2, h: 3 },
  form: { w: 2, h: 3 },
  filetree: { w: 1, h: 3 },
  gantt: { w: 4, h: 3 },
};

/** Size of a new widget of this type (and, for views, display mode). */
export const defaultWidgetSize = (
  type: DashboardWidgetType,
  mode?: string
): { w: number; h: number } => ({
  ...((type === "view" && mode ? MODE_SIZES[mode] : undefined) ??
    DEFAULT_SIZES[type]),
});

/**
 * Size of a widget about to be added: by its type, and for a view by the
 * display mode of its saved view (or of the table's default view).
 */
export function dashboardWidgetSize(
  widget: Pick<DashboardWidget, "type" | "viewId">,
  context: {
    views?: readonly DashboardView[];
    table?: Pick<DashboardTableInfo, "defaultDisplayMode">;
  } = {}
): { w: number; h: number } {
  if (widget.type !== "view") {
    return defaultWidgetSize(widget.type);
  }
  const view = widget.viewId
    ? context.views?.find((item) => item.id === widget.viewId)
    : undefined;
  const mode = view
    ? widgetDisplayMode(view.config)
    : text(context.table?.defaultDisplayMode) || "table";
  return defaultWidgetSize("view", mode);
}

/** Whole numbers inside the grid: `w` 1…columns, `h` 1…max, `x` keeps it inside. */
export function clampLayoutItem(
  item: DashboardLayoutItem,
  columns = DASHBOARD_COLUMNS
): DashboardLayoutItem {
  const w = clamp(integer(item.w, 1), 1, columns);
  return {
    widgetId: item.widgetId,
    x: clamp(integer(item.x, 0), 0, columns - w),
    y: Math.max(0, integer(item.y, 0)),
    w,
    h: clamp(integer(item.h, 1), 1, DASHBOARD_MAX_HEIGHT),
  };
}

const overlaps = (a: DashboardLayoutItem, b: DashboardLayoutItem): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const readingOrder = (a: DashboardLayoutItem, b: DashboardLayoutItem) =>
  a.y - b.y || a.x - b.x;

/** Rows the layout takes. */
export const layoutRows = (layout: readonly DashboardLayoutItem[]): number =>
  layout.reduce((rows, item) => Math.max(rows, item.y + item.h), 0);

/** Moves each widget down until it overlaps none placed before it. */
function pushDown(
  items: readonly DashboardLayoutItem[]
): DashboardLayoutItem[] {
  const placed: DashboardLayoutItem[] = [];
  for (const item of items) {
    const next = { ...item };
    let blocker = placed.find((other) => overlaps(other, next));
    while (blocker) {
      next.y = blocker.y + blocker.h;
      blocker = placed.find((other) => overlaps(other, next));
    }
    placed.push(next);
  }
  return placed;
}

/** Top gravity, as gridstack's default mode: widgets rise into free space above them. */
export function compactLayout(
  layout: readonly DashboardLayoutItem[]
): DashboardLayoutItem[] {
  const placed: DashboardLayoutItem[] = [];
  for (const item of [...layout].sort(readingOrder)) {
    const next = { ...item };
    while (
      next.y > 0 &&
      !placed.some((other) => overlaps(other, { ...next, y: next.y - 1 }))
    ) {
      next.y -= 1;
    }
    placed.push(next);
  }
  return placed.sort(readingOrder);
}

/**
 * Resolves overlaps: `fixedId` (the widget just moved or resized) keeps its
 * place, the others move below what they overlap, then everything rises.
 */
export function resolveLayout(
  layout: readonly DashboardLayoutItem[],
  fixedId?: string,
  columns = DASHBOARD_COLUMNS
): DashboardLayoutItem[] {
  const items = layout.map((item) => clampLayoutItem(item, columns));
  const fixed = items.filter((item) => item.widgetId === fixedId);
  const others = items
    .filter((item) => item.widgetId !== fixedId)
    .sort(readingOrder);
  return compactLayout(pushDown([...fixed, ...others]));
}

/** First free place for a widget of this size, scanning rows then columns. */
export function findFreeSpot(
  layout: readonly DashboardLayoutItem[],
  size: { w: number; h: number },
  columns = DASHBOARD_COLUMNS
): { x: number; y: number } {
  const w = clamp(size.w, 1, columns);
  const rows = layoutRows(layout);
  for (let y = 0; y <= rows; y += 1) {
    for (let x = 0; x + w <= columns; x += 1) {
      const candidate = { widgetId: "", x, y, w, h: size.h };
      if (!layout.some((item) => overlaps(item, candidate))) {
        return { x, y };
      }
    }
  }
  return { x: 0, y: rows };
}

/**
 * The layout of these widgets: one item per widget (unknown items dropped,
 * missing widgets placed in the first free spot), inside the grid, without
 * overlaps and risen to the top.
 */
export function normalizeLayout(
  layout: readonly DashboardLayoutItem[],
  widgets: readonly Pick<DashboardWidget, "id" | "type">[],
  columns = DASHBOARD_COLUMNS
): DashboardLayoutItem[] {
  const known = new Set(widgets.map((widget) => widget.id));
  const seen = new Set<string>();
  const items: DashboardLayoutItem[] = [];
  for (const item of layout) {
    if (known.has(item.widgetId) && !seen.has(item.widgetId)) {
      seen.add(item.widgetId);
      items.push(clampLayoutItem(item, columns));
    }
  }
  let resolved = resolveLayout(items, undefined, columns);
  for (const widget of widgets) {
    if (!seen.has(widget.id)) {
      const size = defaultWidgetSize(widget.type);
      const spot = findFreeSpot(resolved, size, columns);
      resolved = resolveLayout(
        [...resolved, { widgetId: widget.id, ...spot, ...size }],
        widget.id,
        columns
      );
    }
  }
  return resolved;
}

const sameColumns = (a: DashboardLayoutItem, b: DashboardLayoutItem) =>
  a.x < b.x + b.w && b.x < a.x + a.w;
const sameRows = (a: DashboardLayoutItem, b: DashboardLayoutItem) =>
  a.y < b.y + b.h && b.y < a.y + a.h;

/** The nearest widget in a direction sharing the item's columns or rows. */
function neighbour(
  layout: readonly DashboardLayoutItem[],
  item: DashboardLayoutItem,
  direction: DashboardDirection
): DashboardLayoutItem | undefined {
  const others = layout.filter((other) => other.widgetId !== item.widgetId);
  const candidates: Record<DashboardDirection, () => DashboardLayoutItem[]> = {
    up: () =>
      others
        .filter((o) => sameColumns(o, item) && o.y + o.h <= item.y)
        .sort((a, b) => b.y + b.h - (a.y + a.h) || a.x - b.x),
    down: () =>
      others
        .filter((o) => sameColumns(o, item) && o.y >= item.y + item.h)
        .sort((a, b) => a.y - b.y || a.x - b.x),
    left: () =>
      others
        .filter((o) => sameRows(o, item) && o.x + o.w <= item.x)
        .sort((a, b) => b.x + b.w - (a.x + a.w) || a.y - b.y),
    right: () =>
      others
        .filter((o) => sameRows(o, item) && o.x >= item.x + item.w)
        .sort((a, b) => a.x - b.x || a.y - b.y),
  };
  return candidates[direction]().at(0);
}

const replaceItem = (
  layout: readonly DashboardLayoutItem[],
  ...changed: DashboardLayoutItem[]
): DashboardLayoutItem[] =>
  layout.map(
    (item) =>
      changed.find((next) => next.widgetId === item.widgetId) ?? { ...item }
  );

/** Left or right: swap with the adjacent widget when both fit, else one column. */
function moveSideways(
  layout: readonly DashboardLayoutItem[],
  item: DashboardLayoutItem,
  direction: "left" | "right",
  columns: number
): DashboardLayoutItem[] {
  const other = neighbour(layout, item, direction);
  const adjacent =
    other &&
    (direction === "left"
      ? other.x + other.w === item.x
      : item.x + item.w === other.x);
  if (other && adjacent) {
    const left = direction === "left" ? item : other;
    const right = direction === "left" ? other : item;
    const start = Math.min(item.x, other.x);
    const moved = [
      { ...left, x: start },
      { ...right, x: start + left.w },
    ];
    if (start + left.w + right.w <= columns) {
      return resolveLayout(replaceItem(layout, ...moved), item.widgetId);
    }
  }
  const x = item.x + (direction === "left" ? -1 : 1);
  return resolveLayout(
    replaceItem(layout, { ...item, x }),
    item.widgetId,
    columns
  );
}

/**
 * Keyboard alternative to dragging: up and down swap with the nearest widget
 * above or below, left and right with the adjacent one (or move a column).
 */
export function moveLayoutItem(
  layout: readonly DashboardLayoutItem[],
  widgetId: string,
  direction: DashboardDirection,
  columns = DASHBOARD_COLUMNS
): DashboardLayoutItem[] {
  const item = layout.find((entry) => entry.widgetId === widgetId);
  if (!(item && canMoveLayoutItem(layout, widgetId, direction, columns))) {
    return layout.map((entry) => ({ ...entry }));
  }
  if (direction === "left" || direction === "right") {
    return moveSideways(layout, item, direction, columns);
  }
  const other = neighbour(layout, item, direction);
  if (!other) {
    return layout.map((entry) => ({ ...entry }));
  }
  // Up: take the place of the widget above. Down: let the widget below rise
  // into this place and settle under it.
  const y = direction === "up" ? other.y : other.y + other.h;
  const moved = replaceItem(layout, { ...item, y });
  return direction === "up"
    ? resolveLayout(moved, item.widgetId, columns)
    : resolveLayout(moved, other.widgetId, columns);
}

/** Whether the widget can move that way (menus disable the others). */
export function canMoveLayoutItem(
  layout: readonly DashboardLayoutItem[],
  widgetId: string,
  direction: DashboardDirection,
  columns = DASHBOARD_COLUMNS
): boolean {
  const item = layout.find((entry) => entry.widgetId === widgetId);
  if (!item) {
    return false;
  }
  switch (direction) {
    case "left":
      return item.x > 0;
    case "right":
      return item.x + item.w < columns;
    case "up":
    case "down":
      return Boolean(neighbour(layout, item, direction));
    default:
      return false;
  }
}

const RESIZE_CHANGES: Record<DashboardResize, { w: number; h: number }> = {
  wider: { w: 1, h: 0 },
  narrower: { w: -1, h: 0 },
  taller: { w: 0, h: 1 },
  shorter: { w: 0, h: -1 },
};

/** Whether the widget can grow or shrink that way. */
export function canResizeLayoutItem(
  layout: readonly DashboardLayoutItem[],
  widgetId: string,
  change: DashboardResize,
  columns = DASHBOARD_COLUMNS
): boolean {
  const item = layout.find((entry) => entry.widgetId === widgetId);
  if (!item) {
    return false;
  }
  const { w, h } = RESIZE_CHANGES[change];
  const width = item.w + w;
  const height = item.h + h;
  return (
    width >= 1 &&
    width <= columns &&
    height >= 1 &&
    height <= DASHBOARD_MAX_HEIGHT
  );
}

/** Keyboard alternative to the resize handle; a wider widget moves left when it must. */
export function resizeLayoutItem(
  layout: readonly DashboardLayoutItem[],
  widgetId: string,
  change: DashboardResize,
  columns = DASHBOARD_COLUMNS
): DashboardLayoutItem[] {
  const item = layout.find((entry) => entry.widgetId === widgetId);
  if (!(item && canResizeLayoutItem(layout, widgetId, change, columns))) {
    return layout.map((entry) => ({ ...entry }));
  }
  const { w, h } = RESIZE_CHANGES[change];
  const width = item.w + w;
  const next = {
    ...item,
    w: width,
    h: item.h + h,
    x: Math.min(item.x, columns - width),
  };
  return resolveLayout(replaceItem(layout, next), widgetId, columns);
}

/** Columns for a grid this wide: one on phones, four otherwise. */
export const dashboardColumnsForWidth = (width: number): number =>
  width > 0 && width <= DASHBOARD_PHONE_MAX_WIDTH ? 1 : DASHBOARD_COLUMNS;

/** Phone layout: widgets in reading order, one per row, full width, same heights. */
export function stackLayout(
  layout: readonly DashboardLayoutItem[]
): DashboardLayoutItem[] {
  let y = 0;
  return [...layout].sort(readingOrder).map((item) => {
    const stacked = { ...item, x: 0, y, w: 1 };
    y += item.h;
    return stacked;
  });
}

const sameLayout = (
  a: readonly DashboardLayoutItem[],
  b: readonly DashboardLayoutItem[]
) =>
  a.length === b.length &&
  a.every((item) => {
    const other = b.find((entry) => entry.widgetId === item.widgetId);
    return (
      other &&
      other.x === item.x &&
      other.y === item.y &&
      other.w === item.w &&
      other.h === item.h
    );
  });

/** Positions reported by the grid after a drag or resize; unchanged layouts stay the same object. */
export function applyGridLayout(
  dashboard: Dashboard,
  items: readonly DashboardLayoutItem[]
): Dashboard {
  const layout = normalizeLayout(
    dashboard.layout.map(
      (item) => items.find((next) => next.widgetId === item.widgetId) ?? item
    ),
    dashboard.widgets
  );
  return sameLayout(layout, dashboard.layout)
    ? dashboard
    : { ...dashboard, layout };
}

// Widgets -----------------------------------------------------------------------

const WIDGET_TYPES = new Set<DashboardWidgetType>(["view", "kpi", "note"]);
const KPI_METRICS = new Set<DashboardKpiMetric>([
  "count",
  "sum",
  "avg",
  "min",
  "max",
]);

/** A widget id not used yet. */
export function nextWidgetId(widgets: readonly { id: string }[]): string {
  const ids = new Set(widgets.map((widget) => widget.id));
  let index = widgets.length + 1;
  while (ids.has(`widget-${index}`)) {
    index += 1;
  }
  return `widget-${index}`;
}

/**
 * Adds a widget in the first free spot, at `size` (by default the size of its
 * type, see `defaultWidgetSize`).
 */
export function addDashboardWidget(
  dashboard: Dashboard,
  widget: Omit<DashboardWidget, "id"> & { id?: string },
  size: { w: number; h: number } = defaultWidgetSize(widget.type)
): Dashboard {
  const id = widget.id ?? nextWidgetId(dashboard.widgets);
  const added: DashboardWidget = { ...widget, id, settings: widget.settings };
  const spot = findFreeSpot(dashboard.layout, size);
  return {
    ...dashboard,
    widgets: [...dashboard.widgets, added],
    layout: resolveLayout(
      [...dashboard.layout, { widgetId: id, ...spot, ...size }],
      id
    ),
  };
}

/** What the widget picker collects before a widget is added. */
export interface DashboardWidgetDraft {
  type: DashboardWidgetType;
  tableId: string;
  /** Saved view; empty for the table's default view. */
  viewId: string;
  title: string;
  /** Note text. */
  text: string;
  /** View widgets: what happens to records that do not fit. */
  overflow: DashboardOverflow;
  metric: DashboardKpiMetric;
  metricColumn: string;
  /** Numbers: the date column periods and the trend read; empty for none. */
  dateColumn: string;
  compare: boolean;
  compareDays: number;
  /** Whether a rise (`up`) or a fall (`down`) shows as good. */
  compareBetter: DashboardKpiBetter;
  sparkline: boolean;
}

/** A blank picker: a view of the first table, fitting its records. */
export const emptyWidgetDraft = (tableId = ""): DashboardWidgetDraft => ({
  type: "view",
  tableId,
  viewId: "",
  title: "",
  text: "",
  overflow: "fit",
  metric: "count",
  metricColumn: "",
  dateColumn: "",
  compare: false,
  compareDays: DEFAULT_COMPARE_DAYS,
  compareBetter: "up",
  sparkline: false,
});

/** A trend line added from the picker: the last 6 months. */
function kpiDraftSettings(
  draft: DashboardWidgetDraft
): Record<string, unknown> {
  const title = draft.title.trim();
  const reads = draft.metric !== "count" && Boolean(draft.metricColumn);
  const dateColumn = draft.dateColumn.trim();
  return {
    metric: draft.metric,
    ...(reads ? { metricColumn: draft.metricColumn } : {}),
    ...(title ? { label: title } : {}),
    ...(dateColumn && (draft.compare || draft.sparkline) ? { dateColumn } : {}),
    ...(dateColumn && draft.compare
      ? {
          compare: {
            period: "previous",
            days: draft.compareDays,
            ...(draft.compareBetter === "down" ? { better: "down" } : {}),
          },
        }
      : {}),
    ...(dateColumn && draft.sparkline
      ? {
          sparkline: { bucket: "month", buckets: DEFAULT_SPARKLINE_BUCKETS },
        }
      : {}),
  };
}

/** The widget a picker draft describes (without its id). */
export function dashboardWidgetFromDraft(
  draft: DashboardWidgetDraft
): Omit<DashboardWidget, "id"> {
  const title = draft.title.trim();
  if (draft.type === "note") {
    return {
      type: "note",
      ...(title ? { title } : {}),
      settings: { text: draft.text },
    };
  }
  const base = {
    type: draft.type,
    tableId: draft.tableId,
    ...(draft.viewId ? { viewId: draft.viewId } : {}),
  };
  if (draft.type === "view") {
    return {
      ...base,
      ...(title ? { title } : {}),
      settings: draft.overflow === "scroll" ? { overflow: "scroll" } : {},
    };
  }
  return { ...base, settings: kpiDraftSettings(draft) };
}

/** Date columns a number can compare periods and draw a trend on. */
export const dashboardDateColumns = (
  columns: readonly DashboardColumn[]
): DashboardColumn[] =>
  columns.filter((column) => DATE_COLUMN_TYPES.has(String(column.type)));

/** "Last 7 days" … "Last 365 days": the periods the picker offers. */
export const dashboardCompareDayOptions = (
  locale: string,
  translate?: DashboardTranslate
): { value: number; label: string }[] =>
  DASHBOARD_COMPARE_DAYS.map((count) => ({
    value: count,
    label: dashboardLabel("lastDays", locale, translate, { count }),
  }));

/** Removes a widget, its place and its mentions in filter targets. */
export function removeDashboardWidget(
  dashboard: Dashboard,
  widgetId: string
): Dashboard {
  return {
    ...dashboard,
    widgets: dashboard.widgets.filter((widget) => widget.id !== widgetId),
    layout: compactLayout(
      dashboard.layout.filter((item) => item.widgetId !== widgetId)
    ),
    filters: dashboard.filters.map((filter) => ({
      ...filter,
      targets: filter.targets
        .map((target) =>
          target.widgetIds
            ? {
                ...target,
                widgetIds: target.widgetIds.filter((id) => id !== widgetId),
              }
            : target
        )
        .filter((target) => !target.widgetIds || target.widgetIds.length > 0),
    })),
  };
}

/** Moves a widget with the keyboard menu. */
export const moveDashboardWidget = (
  dashboard: Dashboard,
  widgetId: string,
  direction: DashboardDirection
): Dashboard => ({
  ...dashboard,
  layout: moveLayoutItem(dashboard.layout, widgetId, direction),
});

/** Resizes a widget with the keyboard menu. */
export const resizeDashboardWidget = (
  dashboard: Dashboard,
  widgetId: string,
  change: DashboardResize
): Dashboard => ({
  ...dashboard,
  layout: resizeLayoutItem(dashboard.layout, widgetId, change),
});

/** The view settings a KPI widget renders: its view's filters, as a number chart. */
export function kpiViewConfig(
  widget: DashboardWidget,
  base: Record<string, unknown> = {}
): Record<string, unknown> {
  const metric = KPI_METRICS.has(widget.settings.metric as DashboardKpiMetric)
    ? (widget.settings.metric as DashboardKpiMetric)
    : "count";
  const metricColumn = text(widget.settings.metricColumn);
  return {
    ...base,
    displayMode: "chart",
    chart: {
      type: "number",
      metric: metric !== "count" && metricColumn ? metric : "count",
      ...(metric !== "count" && metricColumn ? { metricColumn } : {}),
    },
  };
}

/**
 * What a table or KPI widget shows: its saved view's settings (the table's
 * defaults without a view), as a number chart for KPIs.
 */
export function widgetViewConfig(
  widget: DashboardWidget,
  view?: Pick<DashboardView, "config">
): Record<string, unknown> {
  const base = isRecord(view?.config) ? view.config : {};
  return widget.type === "kpi" ? kpiViewConfig(widget, base) : { ...base };
}

/** Display mode a view widget renders (`table` by default). */
export const widgetDisplayMode = (config: Record<string, unknown>): string =>
  text(config.displayMode) || "table";

// Fitting records ----------------------------------------------------------------

/**
 * What a view widget does with records that do not fit its height: `fit`
 * (the default) shows the ones that fit and "+N more"; `scroll` keeps the
 * view's pagination and scrolls inside the widget.
 */
export type DashboardOverflow = "fit" | "scroll";

/** A widget's `settings.overflow`: `fit` unless it asks to scroll. */
export const widgetOverflow = (
  widget: Pick<DashboardWidget, "settings">
): DashboardOverflow =>
  widget.settings.overflow === "scroll" ? "scroll" : "fit";

/** Display modes whose records a fit widget trims to its height. */
const FIT_RECORD_MODES = new Set([
  "table",
  "list",
  "gallery",
  "kanban",
  "feed",
]);

/** Whether a fit widget in this display mode trims its records ("+N more"). */
export const dashboardFitsRecords = (mode: string): boolean =>
  FIT_RECORD_MODES.has(mode);

/** Smallest height of one line of records, per mode (a card row for galleries). */
const FIT_LINE_HEIGHTS: Readonly<Record<string, number>> = {
  table: 28,
  list: 28,
  kanban: 44,
  gallery: 140,
  feed: 96,
};
/** Records per line: cards side by side in a gallery, lanes of a board. */
const FIT_LINE_WIDTH = 150;
const FIT_BOARD_LANES = 4;
const MIN_FIT_PAGE_SIZE = 5;
const MAX_FIT_PAGE_SIZE = 100;

/**
 * Records a fit widget loads: the view's own page size when it has one (a
 * "Top 5" view shows at most 5), otherwise enough to fill a widget of this
 * size with the smallest records, between 5 and 100.
 */
export function dashboardFitPageSize(
  mode: string,
  size: { w: number; h: number },
  viewPageSize?: unknown
): number {
  const own = integer(viewPageSize, 0);
  if (own > 0) {
    return Math.min(own, MAX_FIT_PAGE_SIZE);
  }
  const lines = Math.ceil(
    (Math.max(1, size.h) * DASHBOARD_ROW_HEIGHT) /
      (FIT_LINE_HEIGHTS[mode] ?? FIT_LINE_HEIGHTS.table ?? 28)
  );
  let perLine = 1;
  if (mode === "gallery") {
    perLine = Math.max(
      1,
      Math.floor(
        (Math.max(1, size.w) * DASHBOARD_ROW_HEIGHT * 2.5) / FIT_LINE_WIDTH
      )
    );
  } else if (mode === "kanban") {
    perLine = FIT_BOARD_LANES;
  }
  return clamp(lines * perLine, MIN_FIT_PAGE_SIZE, MAX_FIT_PAGE_SIZE);
}

/** Records left out of a fit widget: all the view matches (`total`) but those shown. */
export const dashboardMoreCount = (total: number, shown: number): number =>
  Number.isFinite(total) && Number.isFinite(shown)
    ? Math.max(0, Math.trunc(total) - Math.max(0, Math.trunc(shown)))
    : 0;

/** The total a table's `list` reports: `meta.totalCount`, else the rows it sent. */
export function dashboardListTotal(result: unknown): number | undefined {
  if (!isRecord(result)) {
    return;
  }
  const meta = isRecord(result.meta) ? result.meta : {};
  const total = Number(meta.totalCount ?? meta.rowCount ?? result.totalCount);
  if (Number.isFinite(total) && total >= 0) {
    return Math.trunc(total);
  }
  return Array.isArray(result.data) ? result.data.length : undefined;
}

// Numbers: comparison and trend ----------------------------------------------------

/** Which change a comparison shows as good: an increase (`up`) or a decrease. */
export type DashboardKpiBetter = "up" | "down";

/**
 * Comparison with the period just before, as long as the current one. The
 * current period is the dashboard's date range on the KPI's `dateColumn` when
 * a date filter targets it, otherwise the last `days` days up to today.
 */
export interface DashboardKpiCompare {
  period: "previous";
  days: number;
  better: DashboardKpiBetter;
}

/** A tiny line of the metric over the last `buckets` date buckets. */
export interface DashboardKpiSparkline {
  bucket: ChartBucket;
  buckets: number;
}

/** A KPI widget's settings, normalized. */
export interface DashboardKpiSettings {
  metric: DashboardKpiMetric;
  metricColumn?: string;
  label?: string;
  /** The date column periods and trend buckets read; required by both. */
  dateColumn?: string;
  compare?: DashboardKpiCompare;
  sparkline?: DashboardKpiSparkline;
}

/** Days `compare.days` offers in the widget picker. */
export const DASHBOARD_COMPARE_DAYS = [7, 30, 90, 365] as const;
const DEFAULT_COMPARE_DAYS = 30;
const MAX_COMPARE_DAYS = 3660;
const DEFAULT_SPARKLINE_BUCKETS = 6;
const MIN_SPARKLINE_BUCKETS = 2;
const MAX_SPARKLINE_BUCKETS = 24;
const SPARKLINE_BUCKETS = new Set<ChartBucket>([
  "day",
  "week",
  "month",
  "quarter",
  "year",
]);

const optionRecord = (value: unknown): UnknownRecord | undefined => {
  if (value === true) {
    return {};
  }
  return isRecord(value) ? value : undefined;
};

function normalizeCompare(value: unknown): DashboardKpiCompare | undefined {
  const input = optionRecord(value);
  if (!input || (input.period !== undefined && input.period !== "previous")) {
    return;
  }
  return {
    period: "previous",
    days: clamp(integer(input.days, DEFAULT_COMPARE_DAYS), 1, MAX_COMPARE_DAYS),
    better: input.better === "down" ? "down" : "up",
  };
}

function normalizeSparkline(value: unknown): DashboardKpiSparkline | undefined {
  const input = optionRecord(value);
  if (!input) {
    return;
  }
  const bucket = text(input.bucket) as ChartBucket;
  return {
    bucket: SPARKLINE_BUCKETS.has(bucket) ? bucket : "month",
    buckets: clamp(
      integer(input.buckets, DEFAULT_SPARKLINE_BUCKETS),
      MIN_SPARKLINE_BUCKETS,
      MAX_SPARKLINE_BUCKETS
    ),
  };
}

/**
 * A KPI's settings: `metric` other than `count` needs `metricColumn`;
 * `compare` (`true` or `{ period: "previous", days?, better? }`) and
 * `sparkline` (`true` or `{ bucket?, buckets? }`) need `dateColumn`.
 */
export function dashboardKpiSettings(
  widget: Pick<DashboardWidget, "settings">
): DashboardKpiSettings {
  const { settings } = widget;
  const metric = KPI_METRICS.has(settings.metric as DashboardKpiMetric)
    ? (settings.metric as DashboardKpiMetric)
    : "count";
  const metricColumn = text(settings.metricColumn);
  const reads = metric !== "count" && Boolean(metricColumn);
  const label = text(settings.label);
  const dateColumn = text(settings.dateColumn);
  const compare = dateColumn ? normalizeCompare(settings.compare) : undefined;
  const sparkline = dateColumn
    ? normalizeSparkline(settings.sparkline)
    : undefined;
  return {
    metric: reads ? metric : "count",
    ...(reads ? { metricColumn } : {}),
    ...(label ? { label } : {}),
    ...(dateColumn ? { dateColumn } : {}),
    ...(compare ? { compare } : {}),
    ...(sparkline ? { sparkline } : {}),
  };
}

/** Days from `start` to `end`, both included. */
export interface DashboardPeriod {
  start: string;
  end: string;
}

const DAY_MS = 86_400_000;
const dayTime = (day: string): number | undefined => {
  const date = DATE_ONLY.test(day) ? day.split("-").map(Number) : undefined;
  return date
    ? Date.UTC(date[0] ?? 0, (date[1] ?? 1) - 1, date[2] ?? 1)
    : undefined;
};

/** A calendar day `YYYY-MM-DD` moved by `days` (back when negative). */
export function shiftDashboardDay(day: string, days: number): string {
  const time = dayTime(day);
  return time === undefined
    ? day
    : new Date(time + days * DAY_MS).toISOString().slice(0, 10);
}

const periodLength = (period: DashboardPeriod): number =>
  Math.round(
    ((dayTime(period.end) ?? 0) - (dayTime(period.start) ?? 0)) / DAY_MS
  ) + 1;

/**
 * A KPI's current period and the one just before it (same length). A date
 * range from the dashboard sets the current period: both ends as they are,
 * a start alone up to today, an end alone `days` back. Without one, it is the
 * last `days` days up to `today`.
 */
export function dashboardKpiPeriods(
  days: number,
  today: string,
  range: DashboardDateRange = {}
): { current: DashboardPeriod; previous: DashboardPeriod } {
  const length = clamp(
    integer(days, DEFAULT_COMPARE_DAYS),
    1,
    MAX_COMPARE_DAYS
  );
  const { start, end } = dateRangeOf(range);
  let current: DashboardPeriod;
  if (start && end) {
    current = start <= end ? { start, end } : { start: end, end: start };
  } else if (start) {
    current = { start, end: start > today ? start : today };
  } else if (end) {
    current = { start: shiftDashboardDay(end, 1 - length), end };
  } else {
    current = { start: shiftDashboardDay(today, 1 - length), end: today };
  }
  const span = periodLength(current);
  return {
    current,
    previous: {
      start: shiftDashboardDay(current.start, -span),
      end: shiftDashboardDay(current.start, -1),
    },
  };
}

/** The dashboard's date range on a widget's column, when an active date filter targets it. */
export function dashboardDateRangeFor(
  dashboard: Pick<Dashboard, "filters">,
  widget: Pick<DashboardWidget, "id" | "tableId">,
  columnId: string
): DashboardDateRange | undefined {
  for (const filter of dashboard.filters) {
    const target =
      filter.type === "dateRange" && isDashboardFilterActive(filter)
        ? filter.targets.find((item) => targetsWidget(item, widget))
        : undefined;
    if (target?.columnId === columnId) {
      return dateRangeOf(filter.value);
    }
  }
  return;
}

/** The rule selecting a period of days on a date column. */
export const dashboardPeriodRule = (
  columnId: string,
  period: DashboardPeriod,
  id = `dashboard-period-${columnId}`
): UnknownRecord => ({
  id,
  columnId,
  isActive: true,
  type: "date",
  operator: "between",
  values: [period.start, period.end],
});

/** A current value against the previous one. */
export interface DashboardComparison {
  current: number;
  previous: number;
  /** Relative change (0.12 is +12 %); undefined when only the current period has a value. */
  change?: number;
  trend: "up" | "down" | "flat";
  /** Whether the change is good, by the KPI's `better` direction. */
  tone: "positive" | "negative" | "neutral";
}

/** How `current` compares with `previous`. */
export function dashboardComparison(
  current: number,
  previous: number,
  better: DashboardKpiBetter = "up"
): DashboardComparison {
  let trend: DashboardComparison["trend"] = "flat";
  if (current > previous) {
    trend = "up";
  } else if (current < previous) {
    trend = "down";
  }
  let change: number | undefined;
  if (previous !== 0) {
    change = (current - previous) / Math.abs(previous);
  } else if (current === 0) {
    change = 0;
  }
  let tone: DashboardComparison["tone"] = "neutral";
  if (trend !== "flat") {
    tone = trend === better ? "positive" : "negative";
  }
  return {
    current,
    previous,
    ...(change === undefined ? {} : { change }),
    trend,
    tone,
  };
}

const SMALL_CHANGE = 0.1;

/** "+12% vs previous period" (percent in the locale's format), or why there is none. */
export function dashboardComparisonText(
  comparison: DashboardComparison,
  locale: string,
  translate?: DashboardTranslate
): string {
  if (comparison.change === undefined) {
    return dashboardLabel("compareNoPrevious", locale, translate);
  }
  const format = new Intl.NumberFormat(locale, {
    style: "percent",
    signDisplay: "exceptZero",
    maximumFractionDigits: Math.abs(comparison.change) < SMALL_CHANGE ? 1 : 0,
  });
  return dashboardLabel("compareChange", locale, translate, {
    change: format.format(comparison.change),
  });
}

/** "Aug 26 – Sep 24, 2026 vs Jul 27 – Aug 25, 2026": the periods compared. */
export function dashboardPeriodsText(
  periods: { current: DashboardPeriod; previous: DashboardPeriod },
  locale: string,
  translate?: DashboardTranslate
): string {
  const show = (period: DashboardPeriod) =>
    dashboardDateRangeText(period, locale, translate);
  return dashboardLabel("comparePeriods", locale, translate, {
    current: show(periods.current),
    previous: show(periods.previous),
  });
}

/** The `count` date buckets ending with the one holding `end`, oldest first. */
export function dashboardSparklineKeys(
  end: string,
  bucket: ChartBucket,
  count: number,
  weekStartsOn = 1
): string[] {
  const keys: string[] = [];
  let day = end;
  while (keys.length < count) {
    const key = chartBucketKey(day, bucket, { weekStartsOn });
    const range = key ? chartBucketRange(key, bucket) : undefined;
    if (!(key && range)) {
      break;
    }
    keys.unshift(key);
    day = shiftDashboardDay(range[0], -1);
  }
  return keys;
}

/** The metric of each bucket key from aggregate groups (missing buckets are 0). */
export function dashboardSparklineValues(
  keys: readonly string[],
  groups: readonly ChartAggregateGroup[]
): number[] {
  const values = new Map<string, number>();
  for (const group of groups) {
    const key = group.keys.at(0);
    if (typeof key === "string") {
      values.set(key, (values.get(key) ?? 0) + (group.values.at(0) ?? 0));
    }
  }
  return keys.map((key) => values.get(key) ?? 0);
}

const SPARKLINE_INSET = 2;
const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Points of an SVG polyline drawing `values` in a `width`×`height` box (the
 * lowest value at the bottom, the highest at the top; a flat line in the
 * middle), with room for the stroke.
 */
export function dashboardSparklinePoints(
  values: readonly number[],
  width = 100,
  height = 32
): string {
  const finite = values.map((value) => (Number.isFinite(value) ? value : 0));
  if (!finite.length) {
    return "";
  }
  const low = Math.min(...finite);
  const high = Math.max(...finite);
  const inner = height - SPARKLINE_INSET * 2;
  const step =
    finite.length > 1 ? (width - SPARKLINE_INSET * 2) / (finite.length - 1) : 0;
  return finite
    .map((value, index) => {
      const x = finite.length > 1 ? SPARKLINE_INSET + index * step : width / 2;
      const y =
        high === low
          ? height / 2
          : SPARKLINE_INSET + inner - ((value - low) / (high - low)) * inner;
      return `${round2(x)},${round2(y)}`;
    })
    .join(" ");
}

/** One request of a KPI: its rules and what it aggregates. */
export interface DashboardKpiQuery {
  key: "value" | "previous" | "trend";
  rules: UnknownRecord[];
  request: ChartAggregateRequest;
}

/** What a KPI asks the table for: its value, the previous period's and the trend. */
export interface DashboardKpiPlan {
  settings: DashboardKpiSettings;
  periods?: { current: DashboardPeriod; previous: DashboardPeriod };
  trend?: { keys: string[]; bucket: ChartBucket; period: DashboardPeriod };
  queries: DashboardKpiQuery[];
}

/**
 * The requests of a KPI widget. Without a comparison or a trend, one total
 * with the dashboard's rules. With them, the dashboard's rules on the date
 * column give way to each request's period.
 */
export function dashboardKpiPlan(
  dashboard: Pick<Dashboard, "filters">,
  widget: DashboardWidget,
  today: string,
  columns: readonly Pick<ChartColumn, "id" | "timeZone">[] = []
): DashboardKpiPlan {
  const settings = dashboardKpiSettings(widget);
  const rules = dashboardFilterRules(dashboard, widget);
  const metrics = [
    settings.metricColumn
      ? { columnId: settings.metricColumn, fn: settings.metric }
      : { fn: settings.metric },
  ];
  const { compare, dateColumn, sparkline } = settings;
  const timeZone = columns.find((column) => column.id === dateColumn)?.timeZone;
  const total: ChartAggregateRequest = {
    groupBy: [],
    metrics,
    weekStartsOn: 1,
    ...(timeZone ? { timeZone } : {}),
  };
  if (!(dateColumn && (compare || sparkline))) {
    return { settings, queries: [{ key: "value", rules, request: total }] };
  }
  const others = rules.filter((rule) => rule.columnId !== dateColumn);
  const range = dashboardDateRangeFor(dashboard, widget, dateColumn);
  const queries: DashboardKpiQuery[] = [];
  const periods = compare
    ? dashboardKpiPeriods(compare.days, today, range)
    : undefined;
  if (periods) {
    queries.push(
      {
        key: "value",
        rules: [...others, dashboardPeriodRule(dateColumn, periods.current)],
        request: total,
      },
      {
        key: "previous",
        rules: [...others, dashboardPeriodRule(dateColumn, periods.previous)],
        request: total,
      }
    );
  } else {
    queries.push({ key: "value", rules, request: total });
  }
  const end = periods?.current.end ?? range?.end ?? today;
  const keys = sparkline
    ? dashboardSparklineKeys(end, sparkline.bucket, sparkline.buckets)
    : [];
  const first = keys.at(0);
  const last = keys.at(-1);
  const from =
    first && sparkline ? chartBucketRange(first, sparkline.bucket) : undefined;
  const to =
    last && sparkline ? chartBucketRange(last, sparkline.bucket) : undefined;
  if (!(sparkline && from && to)) {
    return { settings, ...(periods ? { periods } : {}), queries };
  }
  const period = { start: from[0], end: to[1] };
  queries.push({
    key: "trend",
    rules: [...others, dashboardPeriodRule(dateColumn, period)],
    request: {
      ...total,
      groupBy: [{ columnId: dateColumn, bucket: sparkline.bucket }],
    },
  });
  return {
    settings,
    ...(periods ? { periods } : {}),
    trend: { keys, bucket: sparkline.bucket, period },
    queries,
  };
}

/** A saved view's query as list parameters: its filters and search. */
export function dashboardViewParams(
  config: Record<string, unknown> = {}
): Record<string, unknown> {
  const columnFilters = Array.isArray(config.columnFilters)
    ? config.columnFilters.filter(isRecord)
    : [];
  const search = text(config.globalSearch);
  return {
    advancedFilters: config.advancedFilters ?? [],
    filters: Object.fromEntries(
      columnFilters.map((filter) => [String(filter.id), filter.value])
    ),
    ...(search ? { search } : {}),
  };
}

/** The numbers a KPI shows. */
export interface DashboardKpiResult {
  value: number;
  previous?: number;
  trend?: number[];
  /** Some groups were computed over part of the records only. */
  truncated?: boolean;
}

type ActionFn = (params: never) => unknown;

/**
 * Runs a KPI's requests through the table's `aggregate` (or its `list`, when
 * the host cannot group), each with the view's query and its own rules sent
 * as `requiredFilters`.
 */
export async function loadDashboardKpi(input: {
  plan: DashboardKpiPlan;
  actions: { list?: ActionFn; aggregate?: ActionFn };
  params: Record<string, unknown>;
  locale: string;
  signal?: AbortSignal;
}): Promise<DashboardKpiResult> {
  const answers = await Promise.all(
    input.plan.queries.map(async (query) => {
      const actions = withDashboardFilters(input.actions, query.rules) as {
        list?: (params: Record<string, unknown>) => Promise<{
          data: unknown[];
          meta?: { pageCount?: number; totalCount?: number };
        }>;
        aggregate?: (params: Record<string, unknown>) => unknown;
      };
      const result = await loadChartData({
        aggregate: actions.aggregate,
        list: actions.list,
        params: input.params,
        request: query.request,
        locale: input.locale,
        signal: input.signal,
      });
      return { query, result };
    })
  );
  let value = 0;
  let previous: number | undefined;
  let trend: number[] | undefined;
  let truncated = false;
  for (const { query, result } of answers) {
    truncated ||= result.truncated === true;
    const total = result.groups.at(0)?.values.at(0) ?? 0;
    if (query.key === "value") {
      value = total;
    } else if (query.key === "previous") {
      previous = total;
    } else {
      trend = dashboardSparklineValues(
        input.plan.trend?.keys ?? [],
        result.groups
      );
    }
  }
  return {
    value,
    ...(previous === undefined ? {} : { previous }),
    ...(trend ? { trend } : {}),
    ...(truncated ? { truncated: true } : {}),
  };
}

/** Everything a KPI widget draws, in the column's format and the dashboard's language. */
export interface DashboardKpiDisplay {
  value: string;
  /** What the figure counts, e.g. "Sum of Price" (for screen readers and tooltips). */
  caption: string;
  comparison?: DashboardComparison & { text: string; periods: string };
  trend?: { points: string; title: string };
}

/** The figure, its comparison and its trend line, formatted. */
export function dashboardKpiDisplay(input: {
  plan: DashboardKpiPlan;
  result: DashboardKpiResult;
  columns: readonly ChartColumn[];
  locale: string;
  translate?: DashboardTranslate;
}): DashboardKpiDisplay {
  const { plan, result, columns, locale, translate } = input;
  const { settings } = plan;
  const format = chartValueFormatter(settings, columns, locale);
  const column = columns.find((item) => item.id === settings.metricColumn);
  const caption =
    settings.metric === "count"
      ? dashboardLabel("kpiCount", locale, translate)
      : `${dashboardLabel(METRIC_LABELS[settings.metric], locale, translate)} · ${column?.header ?? settings.metricColumn ?? ""}`;
  const display: DashboardKpiDisplay = { value: format(result.value), caption };
  if (plan.periods && settings.compare && result.previous !== undefined) {
    const comparison = dashboardComparison(
      result.value,
      result.previous,
      settings.compare.better
    );
    display.comparison = {
      ...comparison,
      text: dashboardComparisonText(comparison, locale, translate),
      periods: dashboardPeriodsText(plan.periods, locale, translate),
    };
  }
  if (plan.trend && result.trend?.length) {
    const { bucket, keys } = plan.trend;
    const values = result.trend;
    display.trend = {
      points: dashboardSparklinePoints(values),
      title: dashboardLabel("trendTitle", locale, translate, {
        values: keys
          .map(
            (key, index) =>
              `${chartBucketLabel(key, bucket, locale)} ${format(values[index] ?? 0)}`
          )
          .join(", "),
      }),
    };
  }
  return display;
}

// Filters -----------------------------------------------------------------------

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_COLUMN_TYPES = new Set(["date", "datetime", "dateTime"]);
const SELECT_COLUMN_TYPES = new Set([
  "select",
  "multiSelect",
  "status",
  "radio",
]);

/** Columns a filter of this type can apply to. */
export const filterableColumns = (
  type: DashboardFilterType,
  columns: readonly DashboardColumn[]
): DashboardColumn[] =>
  columns.filter((column) =>
    (type === "dateRange" ? DATE_COLUMN_TYPES : SELECT_COLUMN_TYPES).has(
      String(column.type)
    )
  );

const dateRangeOf = (value: unknown): DashboardDateRange => {
  const range = isRecord(value) ? value : {};
  const start = text(range.start);
  const end = text(range.end);
  return {
    ...(DATE_ONLY.test(start) ? { start } : {}),
    ...(DATE_ONLY.test(end) ? { end } : {}),
  };
};

const selectValuesOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? [...new Set(value.map(String).filter((item) => item !== ""))]
    : [];

/** Whether a filter currently filters something. */
export function isDashboardFilterActive(filter: DashboardFilter): boolean {
  if (filter.type === "dateRange") {
    const range = dateRangeOf(filter.value);
    return Boolean(range.start || range.end);
  }
  return selectValuesOf(filter.value).length > 0;
}

/** The advanced filter rule of a dashboard filter on one column. */
export function dashboardFilterRule(
  filter: DashboardFilter,
  columnId: string
): UnknownRecord | undefined {
  const base = { id: `dashboard-${filter.id}`, columnId, isActive: true };
  if (filter.type === "select") {
    const values = selectValuesOf(filter.value);
    return values.length
      ? { ...base, type: "select", operator: "isAnyOf", values }
      : undefined;
  }
  const { start, end } = dateRangeOf(filter.value);
  if (start && end) {
    return { ...base, type: "date", operator: "between", values: [start, end] };
  }
  if (start) {
    return {
      ...base,
      type: "date",
      operator: "greaterThanOrEqual",
      values: [start],
    };
  }
  return end
    ? { ...base, type: "date", operator: "lessThanOrEqual", values: [end] }
    : undefined;
}

const targetsWidget = (
  target: DashboardFilterTarget,
  widget: Pick<DashboardWidget, "id" | "tableId">
) =>
  target.tableId === widget.tableId &&
  (!target.widgetIds || target.widgetIds.includes(widget.id));

/** The dashboard's filter rules for one widget, on that widget's columns. */
export function dashboardFilterRules(
  dashboard: Pick<Dashboard, "filters">,
  widget: Pick<DashboardWidget, "id" | "tableId" | "type">
): UnknownRecord[] {
  if (widget.type === "note" || !widget.tableId) {
    return [];
  }
  const rules: UnknownRecord[] = [];
  for (const filter of dashboard.filters) {
    const target = filter.targets.find((item) => targetsWidget(item, widget));
    const rule = target && dashboardFilterRule(filter, target.columnId);
    if (rule) {
      rules.push(rule);
    }
  }
  return rules;
}

/**
 * List or aggregate parameters with the dashboard's rules joined (AND) to
 * the view's own filters. They are also sent alone as `requiredFilters`,
 * which hosts must AND: when the view matches any of its rules (OR), a flat
 * list cannot say "(A or B) and C", so `advancedFilters` keeps the view's rules.
 */
export function mergeDashboardFilters(
  params: Record<string, unknown>,
  rules: readonly UnknownRecord[]
): Record<string, unknown> {
  if (!rules.length) {
    return params;
  }
  const envelope = normalizeFilterEnvelope(params.advancedFilters);
  const own = envelope.filters.filter((filter) => filter.isActive !== false);
  const anyOf =
    (params.advancedFilterJoin === "or" || envelope.joinOperator === "or") &&
    own.length > 1;
  const requiredFilters = rules.map((rule) => ({ ...rule }));
  if (anyOf) {
    return { ...params, requiredFilters };
  }
  return {
    ...params,
    advancedFilters: [
      ...own.map(({ joinOperator: _join, ...filter }) => filter),
      ...requiredFilters,
    ],
    advancedFilterJoin: "and",
    requiredFilters,
  };
}

/** Actions whose `list` and `aggregate` carry the dashboard's rules. */
export function withDashboardFilters<
  T extends {
    list?: (params: never) => unknown;
    aggregate?: (params: never) => unknown;
  },
>(actions: T, rules: readonly UnknownRecord[]): T {
  if (!rules.length) {
    return actions;
  }
  const list = actions.list as
    | ((params: Record<string, unknown>) => unknown)
    | undefined;
  const aggregate = actions.aggregate as
    | ((params: Record<string, unknown>) => unknown)
    | undefined;
  return {
    ...actions,
    ...(list
      ? {
          list: (params: Record<string, unknown>) =>
            list(mergeDashboardFilters(params, rules)),
        }
      : {}),
    ...(aggregate
      ? {
          aggregate: (params: Record<string, unknown>) =>
            aggregate(mergeDashboardFilters(params, rules)),
        }
      : {}),
  };
}

/** A filter with a new value (`undefined` clears it). */
export function setDashboardFilterValue(
  dashboard: Dashboard,
  filterId: string,
  value: DashboardDateRange | string[] | undefined
): Dashboard {
  return {
    ...dashboard,
    filters: dashboard.filters.map((filter) =>
      filter.id === filterId
        ? normalizeFilterValue({ ...filter, value })
        : filter
    ),
  };
}

const normalizeFilterValue = (filter: DashboardFilter): DashboardFilter => {
  const { value: _value, ...rest } = filter;
  const value =
    filter.type === "dateRange"
      ? dateRangeOf(filter.value)
      : selectValuesOf(filter.value);
  const empty = Array.isArray(value)
    ? value.length === 0
    : !(value.start || value.end);
  return empty ? rest : { ...rest, value };
};

/** A filter id not used yet. */
export function nextFilterId(filters: readonly { id: string }[]): string {
  const ids = new Set(filters.map((filter) => filter.id));
  let index = filters.length + 1;
  while (ids.has(`filter-${index}`)) {
    index += 1;
  }
  return `filter-${index}`;
}

/** Adds a filter; targets without a column are dropped. */
export function addDashboardFilter(
  dashboard: Dashboard,
  filter: Omit<DashboardFilter, "id"> & { id?: string }
): Dashboard {
  const added = normalizeFilter({
    ...filter,
    id: filter.id ?? nextFilterId(dashboard.filters),
  });
  return added
    ? { ...dashboard, filters: [...dashboard.filters, added] }
    : dashboard;
}

export const removeDashboardFilter = (
  dashboard: Dashboard,
  filterId: string
): Dashboard => ({
  ...dashboard,
  filters: dashboard.filters.filter((filter) => filter.id !== filterId),
});

/** Choices of a select filter: its own, or its first target column's options. */
export function dashboardFilterOptions(
  filter: DashboardFilter,
  tables: Readonly<Record<string, DashboardTableInfo>>
): DashboardFilterOption[] {
  if (filter.options?.length) {
    return filter.options;
  }
  for (const target of filter.targets) {
    const column = tables[target.tableId]?.columns.find(
      (item) => item.id === target.columnId
    );
    if (column?.options?.length) {
      return column.options.map((option) => ({
        value: String(option.value),
        label: option.label ?? String(option.value),
      }));
    }
  }
  return [];
}

/** "Projects › Due date, Tasks › Deadline": where a filter applies. */
export function dashboardFilterTargetsLabel(
  filter: DashboardFilter,
  tables: Readonly<Record<string, DashboardTableInfo>>
): string {
  return filter.targets
    .map((target) => {
      const table = tables[target.tableId];
      const column = table?.columns.find((item) => item.id === target.columnId);
      return `${table?.name ?? target.tableId} › ${column?.header ?? target.columnId}`;
    })
    .join(", ");
}

/** Changes whenever the widget's rules change, so it reloads (a remount key). */
export const widgetFilterSignature = (
  dashboard: Pick<Dashboard, "filters">,
  widget: Pick<DashboardWidget, "id" | "tableId" | "type">
): string => JSON.stringify(dashboardFilterRules(dashboard, widget));

// Normalization and versions ----------------------------------------------------

export type DashboardIssueCode =
  | "invalidDashboard"
  | "unsupportedVersion"
  | "invalidWidget"
  | "duplicateWidget"
  | "invalidLayout"
  | "invalidFilter";

export interface DashboardIssue {
  code: DashboardIssueCode;
  message: string;
}

const normalizeWidget = (value: unknown): DashboardWidget | undefined => {
  if (!isRecord(value)) {
    return;
  }
  const id = text(value.id);
  const type = text(value.type) as DashboardWidgetType;
  if (!(id && WIDGET_TYPES.has(type))) {
    return;
  }
  const tableId = text(value.tableId);
  if (type !== "note" && !tableId) {
    return;
  }
  const viewId = text(value.viewId);
  const title = text(value.title);
  return {
    id,
    type,
    ...(tableId && type !== "note" ? { tableId } : {}),
    ...(viewId && type !== "note" ? { viewId } : {}),
    ...(title ? { title } : {}),
    settings: isRecord(value.settings) ? { ...value.settings } : {},
  };
};

const normalizeTarget = (value: unknown): DashboardFilterTarget | undefined => {
  if (!isRecord(value)) {
    return;
  }
  const tableId = text(value.tableId);
  const columnId = text(value.columnId);
  if (!(tableId && columnId)) {
    return;
  }
  const widgetIds = Array.isArray(value.widgetIds)
    ? value.widgetIds.map(text).filter(Boolean)
    : undefined;
  return { tableId, columnId, ...(widgetIds?.length ? { widgetIds } : {}) };
};

const normalizeOptions = (value: unknown): DashboardFilterOption[] =>
  Array.isArray(value)
    ? value.filter(isRecord).map((option) => ({
        value: String(option.value ?? ""),
        label: String(option.label ?? option.value ?? ""),
      }))
    : [];

function normalizeFilter(value: unknown): DashboardFilter | undefined {
  if (!isRecord(value)) {
    return;
  }
  const id = text(value.id);
  const type = text(value.type);
  if (!(id && (type === "dateRange" || type === "select"))) {
    return;
  }
  const targets = (Array.isArray(value.targets) ? value.targets : [])
    .map(normalizeTarget)
    .filter((target): target is DashboardFilterTarget => Boolean(target));
  const options = normalizeOptions(value.options);
  return normalizeFilterValue({
    id,
    type,
    label: text(value.label) || id,
    targets,
    ...(options.length ? { options } : {}),
    ...(value.value === undefined
      ? {}
      : { value: value.value as DashboardFilter["value"] }),
  });
}

/** Version 0 (before `version`): layout items keyed `i`, as in react-grid-layout. */
function migrateLegacyDashboard(input: UnknownRecord): UnknownRecord {
  const layout = Array.isArray(input.layout) ? input.layout : [];
  return {
    ...input,
    version: DASHBOARD_VERSION,
    layout: layout.filter(isRecord).map((item) => ({
      ...item,
      widgetId: item.widgetId ?? item.i ?? item.id,
    })),
  };
}

const normalizeLayoutItems = (value: unknown): DashboardLayoutItem[] =>
  (Array.isArray(value) ? value : [])
    .filter(isRecord)
    .filter((item) => text(item.widgetId))
    .map((item) => ({
      widgetId: text(item.widgetId),
      x: integer(item.x, 0),
      y: integer(item.y, 0),
      w: integer(item.w, 1),
      h: integer(item.h, 1),
    }));

function collectWidgets(value: unknown, issues: DashboardIssue[]) {
  const widgets: DashboardWidget[] = [];
  for (const entry of Array.isArray(value) ? value : []) {
    const widget = normalizeWidget(entry);
    if (!widget) {
      issues.push({ code: "invalidWidget", message: "A widget was dropped." });
    } else if (widgets.some((item) => item.id === widget.id)) {
      issues.push({
        code: "duplicateWidget",
        message: `Widget "${widget.id}" appears twice.`,
      });
    } else {
      widgets.push(widget);
    }
  }
  return widgets;
}

function collectFilters(value: unknown, issues: DashboardIssue[]) {
  const filters: DashboardFilter[] = [];
  for (const entry of Array.isArray(value) ? value : []) {
    const filter = normalizeFilter(entry);
    if (filter && !filters.some((item) => item.id === filter.id)) {
      filters.push(filter);
    } else {
      issues.push({ code: "invalidFilter", message: "A filter was dropped." });
    }
  }
  return filters;
}

/**
 * Checks and repairs dashboard JSON: older versions are migrated, invalid
 * widgets and filters dropped, the layout normalized. `dashboard` is
 * undefined when the input is not a dashboard or comes from a newer version.
 */
export function validateDashboard(input: unknown): {
  dashboard?: Dashboard;
  issues: DashboardIssue[];
} {
  if (!(isRecord(input) && text(input.id))) {
    return {
      issues: [{ code: "invalidDashboard", message: "Not a dashboard." }],
    };
  }
  const version = input.version === undefined ? 0 : integer(input.version, -1);
  if (version < 0 || version > DASHBOARD_VERSION) {
    return {
      issues: [
        {
          code: "unsupportedVersion",
          message: `Dashboard version ${String(input.version)} is not supported (latest: ${DASHBOARD_VERSION}).`,
        },
      ],
    };
  }
  const source = version === 0 ? migrateLegacyDashboard(input) : input;
  const issues: DashboardIssue[] = [];
  const widgets = collectWidgets(source.widgets, issues);
  const items = normalizeLayoutItems(source.layout);
  const layout = normalizeLayout(items, widgets);
  if (items.length !== layout.length || !sameLayout(items, layout)) {
    issues.push({ code: "invalidLayout", message: "The layout was repaired." });
  }
  const updatedAt = text(source.updatedAt);
  return {
    dashboard: {
      version: DASHBOARD_VERSION,
      id: text(source.id),
      name: text(source.name),
      layout,
      widgets,
      filters: collectFilters(source.filters, issues),
      ...(updatedAt ? { updatedAt } : {}),
    },
    issues,
  };
}

/** A valid dashboard of the current version; throws for newer versions or non-dashboards. */
export function normalizeDashboard(input: unknown): Dashboard {
  const { dashboard, issues } = validateDashboard(input);
  if (!dashboard) {
    throw new Error(issues.at(0)?.message ?? "Not a dashboard.");
  }
  return dashboard;
}

/** An empty dashboard. */
export const createDashboard = (id: string, name: string): Dashboard => ({
  version: DASHBOARD_VERSION,
  id,
  name,
  layout: [],
  widgets: [],
  filters: [],
});

/** Saved views from a table source: its static views, then those `views.list` returns. */
export async function loadDashboardViews(
  source: {
    views?: readonly unknown[];
    actions?: { views?: { list?: (context: never) => unknown } };
  },
  tableId: string
): Promise<DashboardView[]> {
  const listed = source.actions?.views?.list
    ? await (
        source.actions.views.list as (context: {
          tableId: string;
          tableType: string;
        }) => unknown
      )({ tableId, tableType: tableId })
    : undefined;
  const data =
    isRecord(listed) && Array.isArray(listed.data) ? listed.data : [];
  const views = new Map<string, DashboardView>();
  for (const view of [...(source.views ?? []), ...data]) {
    if (isRecord(view) && text(view.id)) {
      views.set(text(view.id), {
        id: text(view.id),
        name: text(view.name) || text(view.id),
        config: isRecord(view.config) ? view.config : {},
      });
    }
  }
  return [...views.values()];
}

// Labels ------------------------------------------------------------------------

const ENGLISH_LABELS = {
  dashboard: "Dashboard",
  edit: "Edit",
  done: "Done",
  saving: "Saving…",
  saved: "Dashboard saved",
  saveError: "The dashboard could not be saved: {error}",
  loadError: "The dashboard could not be loaded: {error}",
  loading: "Loading the dashboard…",
  notFound: "No dashboard to show.",
  refresh: "Refresh all",
  addWidget: "Add widget",
  addWidgetTitle: "Add a widget",
  widgetType: "Widget",
  typeView: "View of a table",
  typeKpi: "Number",
  typeNote: "Note",
  table: "Table",
  view: "View",
  defaultView: "Default view",
  metric: "Value",
  metricCount: "Count records",
  metricSum: "Sum",
  metricAvg: "Average",
  metricMin: "Minimum",
  metricMax: "Maximum",
  metricColumn: "Of",
  widgetTitle: "Title",
  noteText: "Text",
  add: "Add",
  cancel: "Cancel",
  widgetMenu: "Widget options for {title}",
  moveLeft: "Move left",
  moveRight: "Move right",
  moveUp: "Move up",
  moveDown: "Move down",
  wider: "Wider",
  narrower: "Narrower",
  taller: "Taller",
  shorter: "Shorter",
  remove: "Remove",
  dragHandle: "Drag {title}",
  openFullView: "Open full view",
  widgetLoading: "Loading…",
  widgetError: "This widget could not be shown: {error}",
  retry: "Retry",
  missingTable: "The table of this widget is not available.",
  missingView: "The view of this widget no longer exists.",
  empty: "This dashboard has no widgets yet.",
  emptyEditable: "Add a widget to show a view, a number or a note.",
  emptyNote: "Empty note",
  filters: "Filters",
  from: "From",
  to: "To",
  any: "All",
  clear: "Clear",
  appliesTo: "Applies to {targets}",
  addFilter: "Add filter",
  addFilterTitle: "Add a filter",
  filterType: "Type",
  filterDateRange: "Date range",
  filterSelect: "Select",
  filterName: "Name",
  filterColumn: "{table} column",
  notApplied: "Not applied",
  removeFilter: "Remove filter {name}",
  noFilterColumns: "No widget table has a column for this filter.",
  moved: "{title} moved",
  resized: "{title} resized",
  kpiCount: "Records",
  anyDate: "Any date",
  fromDate: "From {date}",
  untilDate: "Until {date}",
  dateRange: "{start} – {end}",
  moreCount: "+{count} more",
  viewAll: "View all",
  compareChange: "{change} vs previous period",
  compareNoPrevious: "Nothing in the previous period",
  comparePeriods: "{current} vs {previous}",
  trendTitle: "Trend: {values}",
  dateColumn: "Date",
  noDateColumn: "None",
  compare: "Compare with the previous period",
  compareDays: "Period",
  lastDays: "Last {count} days",
  compareBetter: "Better when it",
  compareUp: "Goes up",
  compareDown: "Goes down",
  sparkline: "Trend line",
  overflow: "Records that do not fit",
  overflowFit: "Show what fits, then “+N more”",
  overflowScroll: "Scroll inside the widget",
};

export type DashboardLabelKey = keyof typeof ENGLISH_LABELS;

const FRENCH_LABELS: Record<DashboardLabelKey, string> = {
  dashboard: "Tableau de bord",
  edit: "Modifier",
  done: "Terminé",
  saving: "Enregistrement…",
  saved: "Tableau de bord enregistré",
  saveError: "Le tableau de bord n’a pas pu être enregistré : {error}",
  loadError: "Le tableau de bord n’a pas pu être chargé : {error}",
  loading: "Chargement du tableau de bord…",
  notFound: "Aucun tableau de bord à afficher.",
  refresh: "Tout actualiser",
  addWidget: "Ajouter un widget",
  addWidgetTitle: "Ajouter un widget",
  widgetType: "Widget",
  typeView: "Vue d’une table",
  typeKpi: "Nombre",
  typeNote: "Note",
  table: "Table",
  view: "Vue",
  defaultView: "Vue par défaut",
  metric: "Valeur",
  metricCount: "Nombre d’enregistrements",
  metricSum: "Somme",
  metricAvg: "Moyenne",
  metricMin: "Minimum",
  metricMax: "Maximum",
  metricColumn: "De",
  widgetTitle: "Titre",
  noteText: "Texte",
  add: "Ajouter",
  cancel: "Annuler",
  widgetMenu: "Options du widget {title}",
  moveLeft: "Déplacer à gauche",
  moveRight: "Déplacer à droite",
  moveUp: "Déplacer vers le haut",
  moveDown: "Déplacer vers le bas",
  wider: "Plus large",
  narrower: "Plus étroit",
  taller: "Plus haut",
  shorter: "Moins haut",
  remove: "Retirer",
  dragHandle: "Déplacer {title}",
  openFullView: "Ouvrir la vue complète",
  widgetLoading: "Chargement…",
  widgetError: "Ce widget n’a pas pu être affiché : {error}",
  retry: "Réessayer",
  missingTable: "La table de ce widget n’est pas disponible.",
  missingView: "La vue de ce widget n’existe plus.",
  empty: "Ce tableau de bord n’a pas encore de widget.",
  emptyEditable:
    "Ajoutez un widget pour afficher une vue, un nombre ou une note.",
  emptyNote: "Note vide",
  filters: "Filtres",
  from: "Du",
  to: "Au",
  any: "Tous",
  clear: "Effacer",
  appliesTo: "S’applique à {targets}",
  addFilter: "Ajouter un filtre",
  addFilterTitle: "Ajouter un filtre",
  filterType: "Type",
  filterDateRange: "Période",
  filterSelect: "Sélection",
  filterName: "Nom",
  filterColumn: "Colonne de {table}",
  notApplied: "Non appliqué",
  removeFilter: "Retirer le filtre {name}",
  noFilterColumns: "Aucune table des widgets n’a de colonne pour ce filtre.",
  moved: "{title} déplacé",
  resized: "{title} redimensionné",
  kpiCount: "Enregistrements",
  anyDate: "Toutes les dates",
  fromDate: "À partir du {date}",
  untilDate: "Jusqu’au {date}",
  dateRange: "{start} – {end}",
  moreCount: "+{count} de plus",
  viewAll: "Tout voir",
  compareChange: "{change} vs période précédente",
  compareNoPrevious: "Rien sur la période précédente",
  comparePeriods: "{current} vs {previous}",
  trendTitle: "Tendance : {values}",
  dateColumn: "Date",
  noDateColumn: "Aucune",
  compare: "Comparer à la période précédente",
  compareDays: "Période",
  lastDays: "{count} derniers jours",
  compareBetter: "Meilleur quand il",
  compareUp: "Augmente",
  compareDown: "Baisse",
  sparkline: "Courbe de tendance",
  overflow: "Enregistrements qui ne tiennent pas",
  overflowFit: "Afficher ce qui tient, puis « +N de plus »",
  overflowScroll: "Faire défiler dans le widget",
};

/** Host override for a label (`dashboard.<key>`), or the built-in one. */
export type DashboardTranslate = (
  key: DashboardLabelKey,
  fallback: string
) => string;

const TEMPLATE_PARAM = /\{(\w+)\}/g;

/** Built-in English or French labels, overridable per key by the host. */
export function dashboardLabel(
  key: DashboardLabelKey,
  locale: string,
  translate?: DashboardTranslate,
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

/** `translations` keyed `dashboard.<key>` (or `<key>`) as a label override. */
export const dashboardTranslate =
  (translations?: Readonly<Record<string, unknown>>): DashboardTranslate =>
  (key, fallback) => {
    const value =
      translations?.[`dashboard.${key}`] ?? translations?.[key] ?? fallback;
    return typeof value === "string" ? value : fallback;
  };

const METRIC_LABELS: Record<DashboardKpiMetric, DashboardLabelKey> = {
  count: "metricCount",
  sum: "metricSum",
  avg: "metricAvg",
  min: "metricMin",
  max: "metricMax",
};

/** KPI metrics in menu order with their labels. */
export const dashboardMetricOptions = (
  locale: string,
  translate?: DashboardTranslate
): { value: DashboardKpiMetric; label: string }[] =>
  (Object.keys(METRIC_LABELS) as DashboardKpiMetric[]).map((value) => ({
    value,
    label: dashboardLabel(METRIC_LABELS[value], locale, translate),
  }));

/** The widget's title: its own, its view's name, the KPI label, or the table's name. */
export function dashboardWidgetTitle(
  widget: DashboardWidget,
  context: {
    locale: string;
    translate?: DashboardTranslate;
    table?: Pick<DashboardTableInfo, "name">;
    view?: Pick<DashboardView, "name">;
  }
): string {
  if (widget.title) {
    return widget.title;
  }
  if (widget.type === "note") {
    return dashboardLabel("typeNote", context.locale, context.translate);
  }
  const tableName = context.table?.name ?? widget.tableId ?? "";
  if (widget.type === "kpi") {
    const label = text(widget.settings.label);
    return label || tableName;
  }
  return context.view?.name
    ? context.view.name
    : `${tableName} › ${dashboardLabel("defaultView", context.locale, context.translate)}`;
}

/** Whether a select filter's option tags are colored: its first target table's setting. */
export function dashboardFilterColoredTags(
  filter: DashboardFilter,
  tables: Readonly<Record<string, DashboardTableInfo>>
): boolean {
  const table = filter.targets
    .map((target) => tables[target.tableId])
    .find(Boolean);
  return table?.coloredTags !== false;
}

/** Calendar day `YYYY-MM-DD` as a local date. */
export function dashboardDay(value?: string): Date | undefined {
  if (!(value && DATE_ONLY.test(value))) {
    return;
  }
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

/** A picked calendar day as `YYYY-MM-DD`. */
export function dashboardDayValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The column a filter's dates read in: its first target's. */
export function dashboardFilterColumn(
  filter: DashboardFilter,
  tables: Readonly<Record<string, DashboardTableInfo>>
): DashboardColumn | undefined {
  for (const target of filter.targets) {
    const column = tables[target.tableId]?.columns.find(
      (item) => item.id === target.columnId
    );
    if (column) {
      return column;
    }
  }
  return;
}

/**
 * What a date range filter's button shows, e.g. "Sep 1, 2026 – Sep 10, 2026":
 * the days in the target column's day format when given.
 */
export function dashboardDateRangeText(
  value: unknown,
  locale: string,
  translate?: DashboardTranslate,
  column?: DashboardColumn
): string {
  const { start, end } = dateRangeOf(value);
  const format = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const show = (day?: string) => {
    const date = dashboardDay(day);
    if (!date) {
      return "";
    }
    return column ? formatColumnDay(day, column, locale) : format.format(date);
  };
  if (start && end) {
    return dashboardLabel("dateRange", locale, translate, {
      start: show(start),
      end: show(end),
    });
  }
  if (start) {
    return dashboardLabel("fromDate", locale, translate, { date: show(start) });
  }
  if (end) {
    return dashboardLabel("untilDate", locale, translate, { date: show(end) });
  }
  return dashboardLabel("anyDate", locale, translate);
}
