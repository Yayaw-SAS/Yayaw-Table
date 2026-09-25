/**
 * Dashboards: sections of widgets (views of any table, numbers, notes,
 * full-page tables and host blocks) with dashboard-wide filters. Framework-
 * neutral and shared by the React and Vue editions (synced to Vue by
 * `scripts/sync-table-contracts.mjs`), so both lay out, filter, load and
 * label dashboards the same way. The JSON grammar and its validator live in
 * `dashboard-schema.ts` and grid layouts in `dashboard-layout.ts`; what moved
 * there is still exported from here.
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
import { isCalendarDay, normalizeDateFilterRules } from "../date-filter-days";
import { formLocaleMatch } from "../form-text";
import { normalizeFilterEnvelope } from "../table-contracts";
import { type ColumnValueFormat, formatColumnDay } from "../value-format";
import {
  clampLayoutItem,
  compactLayout,
  DASHBOARD_ROW_HEIGHT,
  defaultWidgetSize,
} from "./dashboard-layout";
import {
  DASHBOARD_DATE_PRESETS,
  DASHBOARD_KPI_DEFAULTS,
  DASHBOARD_KPI_METRICS,
  type Dashboard,
  type DashboardDatePreset,
  type DashboardDateRange,
  type DashboardFilter,
  type DashboardFilterOption,
  type DashboardFilterTarget,
  type DashboardFilterType,
  type DashboardInlineView,
  type DashboardJsonObject,
  type DashboardKpiBetter,
  type DashboardKpiMetric,
  type DashboardKpiSettings,
  type DashboardOverflow,
  type DashboardSection,
  type DashboardText,
  type DashboardWidget,
  dashboardDateRange,
  dashboardKpiSettings,
  dashboardSelectValues,
  dashboardText,
  dashboardWidgetOrder,
  normalizeDashboardFilter,
  normalizeDashboardFilterValue,
} from "./dashboard-schema";

// Moved in version 2 ---------------------------------------------------------------

export type {
  DashboardDirection,
  DashboardLayoutItem,
  DashboardResize,
} from "./dashboard-layout";
// biome-ignore lint/performance/noBarrelFile: the layout helpers and the grammar lived here before dashboards had sections; hosts still import them from this module.
export {
  applyGridLayout,
  canMoveLayoutItem,
  canResizeLayoutItem,
  clampLayoutItem,
  compactLayout,
  DASHBOARD_COLUMNS,
  DASHBOARD_MARGIN,
  DASHBOARD_MAX_HEIGHT,
  DASHBOARD_PHONE_MAX_WIDTH,
  DASHBOARD_ROW_HEIGHT,
  dashboardColumnsForWidth,
  defaultWidgetSize,
  findFreeSpot,
  layoutRows,
  moveLayoutItem,
  normalizeLayout,
  resizeLayoutItem,
  resolveLayout,
  stackLayout,
} from "./dashboard-layout";
export type {
  Dashboard,
  DashboardDatePreset,
  DashboardDateRange,
  DashboardFilter,
  DashboardFilterOption,
  DashboardFilterTarget,
  DashboardFilterType,
  DashboardIssue,
  DashboardIssueCode,
  DashboardKpiBetter,
  DashboardKpiCompare,
  DashboardKpiMetric,
  DashboardKpiSettings,
  DashboardKpiSparkline,
  DashboardOverflow,
  DashboardSection,
  DashboardV1,
  DashboardWidget,
  DashboardWidgetType,
} from "./dashboard-schema";
export {
  addDashboardWidget,
  createDashboard,
  DASHBOARD_DATE_PRESETS,
  DASHBOARD_VERSION,
  dashboardKpiSettings,
  moveDashboardWidget,
  nextWidgetId,
  normalizeDashboard,
  removeDashboardWidget,
  resizeDashboardWidget,
  validateDashboard,
} from "./dashboard-schema";

// Contract ----------------------------------------------------------------------

export interface DashboardSummary {
  id: string;
  name: string;
}

/**
 * `actions.dashboards`: the host stores dashboards. `load` may return JSON of
 * any version (1, or 0 without `version`); it is migrated to version 2 before
 * use, and `save` receives version 2.
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

// Widgets -----------------------------------------------------------------------

/**
 * Size of a widget about to be added: by its type, for a block by its
 * `defaultSize`, and for a view by the display mode of its inline settings,
 * of its saved view, or of the table's default view.
 */
export function dashboardWidgetSize(
  widget: Pick<DashboardWidget, "type" | "viewId" | "view">,
  context: {
    views?: readonly DashboardView[];
    table?: Pick<DashboardTableInfo, "defaultDisplayMode">;
    /** The host's block, for block widgets. */
    block?: { defaultSize?: { w: number; h: number } };
  } = {}
): { w: number; h: number } {
  const blockSize = widget.type === "block" && context.block?.defaultSize;
  if (blockSize) {
    const { w, h } = clampLayoutItem({
      widgetId: "",
      x: 0,
      y: 0,
      ...blockSize,
    });
    return { w, h };
  }
  if (widget.type !== "view") {
    return defaultWidgetSize(widget.type);
  }
  if (widget.view) {
    return defaultWidgetSize("view", widgetDisplayMode({ ...widget.view }));
  }
  const view = widget.viewId
    ? context.views?.find((item) => item.id === widget.viewId)
    : undefined;
  const mode = view
    ? widgetDisplayMode(view.config)
    : text(context.table?.defaultDisplayMode) || "table";
  return defaultWidgetSize("view", mode);
}

/** Widget types the widget dialog adds and edits. */
export type DashboardDraftType = DashboardWidget["type"];

/** What the widget dialog collects before a widget is added or changed. */
export interface DashboardWidgetDraft {
  type: DashboardDraftType;
  tableId: string;
  /** Saved view; empty for the table's default view (or with `view`). */
  viewId: string;
  /** Inline settings (a custom view), instead of `viewId`. */
  view?: DashboardInlineView;
  /** The title in the language edited (a number's label when it has no title). */
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
  /** Block widgets: the host block's key. */
  block?: string;
  /** Block widgets: their props (JSON). */
  props?: DashboardJsonObject;
}

/**
 * The widget a draft changes: its title keeps its other languages, and the
 * settings the dialog does not show (a trend's buckets, say) are kept.
 */
export interface DashboardDraftEdit {
  widget: DashboardWidget;
  /** The language the dialog edits texts in. */
  locale: string;
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
  compareDays: DASHBOARD_KPI_DEFAULTS.compareDays,
  compareBetter: "up",
  sparkline: false,
});

const DEFAULT_SPARKLINE = {
  bucket: "month",
  buckets: DASHBOARD_KPI_DEFAULTS.sparklineBuckets,
};

/** A number's settings; a trend added from the dialog covers the last 6 months. */
function kpiDraftSettings(
  draft: DashboardWidgetDraft,
  edit?: DashboardDraftEdit
): Record<string, unknown> {
  const previous = edit?.widget.settings ?? {};
  // A number with a title of its own keeps its label; others use it as their title.
  const label =
    edit?.widget.title === undefined
      ? draft.title.trim()
      : text(previous.label);
  const reads = draft.metric !== "count" && Boolean(draft.metricColumn);
  const dateColumn = draft.dateColumn.trim();
  return {
    metric: draft.metric,
    ...(reads ? { metricColumn: draft.metricColumn } : {}),
    ...(label ? { label } : {}),
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
          sparkline: isRecord(previous.sparkline)
            ? previous.sparkline
            : { ...DEFAULT_SPARKLINE },
        }
      : {}),
  };
}

/** The saved view or inline settings a draft names. */
const draftSource = (
  draft: DashboardWidgetDraft
): Pick<DashboardWidget, "tableId" | "viewId" | "view"> => {
  if (draft.view) {
    return { tableId: draft.tableId, view: draft.view };
  }
  return {
    tableId: draft.tableId,
    ...(draft.viewId ? { viewId: draft.viewId } : {}),
  };
};

/** Settings of the edited widget, without the keys a draft sets. */
const keptSettings = (
  edit: DashboardDraftEdit | undefined,
  keys: readonly string[]
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(edit?.widget.settings ?? {}).filter(
      ([key]) => !keys.includes(key)
    )
  );

/**
 * The widget a draft describes (without its id). With `edit`, the widget it
 * changes: its title keeps its other languages and the settings the dialog
 * does not show are kept.
 */
export function dashboardWidgetFromDraft(
  draft: DashboardWidgetDraft,
  edit?: DashboardDraftEdit
): Omit<DashboardWidget, "id"> {
  const typed = draft.title.trim();
  const title = edit
    ? editDashboardText(edit.widget.title, edit.locale, typed)
    : typed || undefined;
  const titled = title ? { title } : {};
  switch (draft.type) {
    case "note":
      return {
        type: "note",
        ...titled,
        settings: { ...keptSettings(edit, ["text"]), text: draft.text },
      };
    case "block":
      return {
        type: "block",
        block: draft.block ?? "",
        ...(draft.props && Object.keys(draft.props).length
          ? { props: draft.props }
          : {}),
        ...titled,
        settings: keptSettings(edit, []),
      };
    case "table":
      return {
        type: "table",
        ...draftSource(draft),
        ...titled,
        settings: keptSettings(edit, []),
      };
    case "view":
      return {
        type: "view",
        ...draftSource(draft),
        ...titled,
        settings: {
          ...keptSettings(edit, ["overflow"]),
          ...(draft.overflow === "scroll" ? { overflow: "scroll" } : {}),
        },
      };
    default:
      return {
        type: "kpi",
        ...draftSource(draft),
        // A new number's title is its label; one with a title keeps it.
        ...(edit?.widget.title === undefined ? {} : titled),
        settings: kpiDraftSettings(draft, edit),
      };
  }
}

/** The draft of a widget, to change it in the widget dialog. */
export function dashboardWidgetDraft(
  widget: DashboardWidget,
  locale: string
): DashboardWidgetDraft {
  const draft: DashboardWidgetDraft = {
    ...emptyWidgetDraft(widget.tableId ?? ""),
    type: widget.type,
    viewId: widget.view ? "" : (widget.viewId ?? ""),
    ...(widget.view ? { view: widget.view } : {}),
    title: dashboardTextInput(widget.title, locale),
  };
  if (widget.type === "note") {
    draft.text = String(widget.settings.text ?? "");
  } else if (widget.type === "view") {
    draft.overflow = widgetOverflow(widget);
  } else if (widget.type === "block") {
    draft.block = widget.block ?? "";
    draft.props = widget.props ?? {};
  } else if (widget.type === "kpi") {
    const kpi = dashboardKpiSettings(widget);
    draft.title ||= kpi.label ?? "";
    draft.metric = kpi.metric;
    draft.metricColumn = kpi.metricColumn ?? "";
    draft.dateColumn = kpi.dateColumn ?? "";
    draft.compare = Boolean(kpi.compare);
    draft.compareDays = kpi.compare?.days ?? DASHBOARD_KPI_DEFAULTS.compareDays;
    draft.compareBetter = kpi.compare?.better ?? "up";
    draft.sparkline = Boolean(kpi.sparkline);
  }
  return draft;
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

/** The view settings a KPI widget renders: its view's filters, as a number chart. */
export function kpiViewConfig(
  widget: DashboardWidget,
  base: Record<string, unknown> = {}
): Record<string, unknown> {
  const metric = DASHBOARD_KPI_METRICS.includes(
    widget.settings.metric as DashboardKpiMetric
  )
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
 * What a table or KPI widget shows: its inline settings, else its saved
 * view's (the table's defaults without either), as a number chart for KPIs.
 */
export function widgetViewConfig(
  widget: DashboardWidget,
  view?: Pick<DashboardView, "config">
): Record<string, unknown> {
  let base: Record<string, unknown> = {};
  if (widget.view) {
    base = { ...widget.view };
  } else if (isRecord(view?.config)) {
    base = view.config;
  }
  return widget.type === "kpi" ? kpiViewConfig(widget, base) : { ...base };
}

/** The saved view a widget's table starts from: none for inline settings. */
export const dashboardWidgetViewId = (
  widget: Pick<DashboardWidget, "view" | "viewId">
): string | null => (widget.view ? null : (widget.viewId ?? null));

/** What `openView` receives besides the source and saved view: a widget's inline view. */
export interface DashboardOpenViewContext {
  view?: DashboardInlineView;
}

/** `openView`'s context for a widget: its inline view, when it has one. */
export const dashboardOpenViewContext = (
  widget: Pick<DashboardWidget, "view">
): DashboardOpenViewContext | undefined =>
  widget.view ? { view: widget.view } : undefined;

/** Display mode a view widget renders (`table` by default). */
export const widgetDisplayMode = (config: Record<string, unknown>): string =>
  text(config.displayMode) || "table";

/**
 * What a widget's view resolves to: its inline settings (no saved view
 * needed), its saved view once the source's views are loaded (`views`
 * undefined until then), or the source's default view.
 */
export type DashboardWidgetView =
  | { status: "loading" }
  | { status: "missing" }
  | {
      status: "ready";
      /** The saved view the widget names; null for inline settings and the default view. */
      viewId: string | null;
      /** That saved view. */
      view?: DashboardView;
      /** The settings the widget starts from: inline, the saved view's, or `{}` (the source's defaults). */
      config: Record<string, unknown>;
    };

/** Resolves the view a widget shows from its source's saved views. */
export function resolveWidgetView(
  widget: Pick<DashboardWidget, "view" | "viewId">,
  views?: readonly DashboardView[]
): DashboardWidgetView {
  if (widget.view) {
    return { status: "ready", viewId: null, config: { ...widget.view } };
  }
  if (!widget.viewId) {
    return { status: "ready", viewId: null, config: {} };
  }
  if (!views) {
    return { status: "loading" };
  }
  const view = views.find((item) => item.id === widget.viewId);
  return view
    ? { status: "ready", viewId: view.id, view, config: { ...view.config } }
    : { status: "missing" };
}

// Full-page tables ------------------------------------------------------------------

/**
 * The `instanceId` of a `table` widget: none (the table's canonical URL keys,
 * `view` and `<tableId>-…`) for the first table of the screen in display
 * order, so links to the list page keep working; the widget's id for the
 * others.
 */
export function dashboardTableInstanceId(
  dashboard: Pick<Dashboard, "sections" | "widgets">,
  widgetId: string
): string | undefined {
  const tables = new Set(
    dashboard.widgets
      .filter((widget) => widget.type === "table")
      .map((widget) => widget.id)
  );
  const first = dashboardWidgetOrder(dashboard).find((id) => tables.has(id));
  return first === widgetId ? undefined : widgetId;
}

const SCREEN_VIEW_PREFIX = "screen:";

/** The id of a screen's default view for a table widget: `screen:<dashboardId>:<widgetId>`. */
export const dashboardScreenViewId = (
  dashboardId: string,
  widgetId: string
): string => `${SCREEN_VIEW_PREFIX}${dashboardId}:${widgetId}`;

/**
 * Whether a view id is a screen's default view (`screen:…`): a system view the
 * screen document holds, never stored with the source's saved views.
 */
export const isDashboardViewId = (id: unknown): boolean =>
  typeof id === "string" && id.startsWith(SCREEN_VIEW_PREFIX);

/** A table widget's inline view as the saved view its table starts from. */
export interface DashboardScreenView {
  id: string;
  /** The source: views saved from the page table keep `tableId = sourceId`. */
  tableId: string;
  name: string;
  config: Record<string, unknown>;
  createdById: string;
  isSystem: true;
  isDefault: true;
  isGlobal: true;
  canEdit: false;
  canDelete: false;
}

/**
 * The system default view a `table` widget's inline view becomes: the
 * reader's favorite view still comes first, then this one.
 */
export function dashboardScreenView(
  dashboardId: string,
  widget: Pick<DashboardWidget, "id" | "tableId" | "view">,
  name: string
): DashboardScreenView | undefined {
  if (!(widget.view && widget.tableId)) {
    return;
  }
  return {
    id: dashboardScreenViewId(dashboardId, widget.id),
    tableId: widget.tableId,
    name,
    config: { ...widget.view },
    createdById: "screen",
    isSystem: true,
    isDefault: true,
    isGlobal: true,
    canEdit: false,
    canDelete: false,
  };
}

/**
 * The views a page table starts with: the screen's view first, then the
 * source's; the screen's view (or its saved view, `defaultViewId`) is the only
 * default, so arrival shows the reader's favorite, else this default.
 */
export function dashboardTableViews<
  T extends { id: string; isDefault?: boolean },
>(
  views: readonly T[],
  defaults: { screenView?: T; defaultViewId?: string | null }
): T[] {
  const { screenView } = defaults;
  const list = screenView
    ? [screenView, ...views.filter((view) => view.id !== screenView.id)]
    : [...views];
  const defaultId = screenView?.id ?? defaults.defaultViewId;
  if (!defaultId) {
    return list;
  }
  return list.map((view) => {
    const isDefault = view.id === defaultId;
    return Boolean(view.isDefault) === isDefault
      ? view
      : { ...view, isDefault };
  });
}

/**
 * Actions whose `views.list` answers with the screen's default view marked
 * (`dashboardTableViews`), whether it returns views or `{ data: views }`.
 */
export function withDashboardTableViews<
  T extends { views?: { list?: (context: never) => unknown } },
>(actions: T, defaultViewId: string | null | undefined): T {
  const views = actions.views;
  const list = views?.list as
    | ((context: unknown) => Promise<unknown> | unknown)
    | undefined;
  if (!(views && list && defaultViewId)) {
    return actions;
  }
  const mark = (data: readonly unknown[]) =>
    dashboardTableViews(
      data.filter(isRecord) as { id: string; isDefault?: boolean }[],
      { defaultViewId }
    );
  return {
    ...actions,
    views: {
      ...views,
      list: async (context: unknown) => {
        const result = await list(context);
        if (Array.isArray(result)) {
          return mark(result);
        }
        return isRecord(result) && Array.isArray(result.data)
          ? { ...result, data: mark(result.data) }
          : result;
      },
    },
  };
}

// Mutations -------------------------------------------------------------------------

/** Actions that change a table's records. */
const MUTATIONS = [
  "create",
  "update",
  "delete",
  "duplicate",
  "bulkDelete",
  "bulkCopy",
  "bulkUpdate",
] as const;

type AnyFunction = (...args: never[]) => unknown;

/** `fn`, calling `onSettled` once it has answered or failed. */
const signalled =
  (fn: AnyFunction, onSettled: () => void) =>
  async (...args: unknown[]): Promise<unknown> => {
    try {
      return await (fn as (...values: unknown[]) => unknown)(...args);
    } finally {
      onSettled();
    }
  };

/**
 * A page table's actions that call `onMutated` after each change settles:
 * `create`, `update`, `delete`, `duplicate`, the bulk actions,
 * `import.importRows` and the file tree's `move` and `createFolder`. The
 * dashboard then reloads the other widgets of that source (numbers, views,
 * blocks).
 */
export function withMutationSignal<T extends object>(
  actions: T,
  onMutated: () => void
): T {
  const source = actions as Record<string, unknown>;
  const wrapped: Record<string, unknown> = { ...source };
  for (const name of MUTATIONS) {
    const fn = source[name];
    if (typeof fn === "function") {
      wrapped[name] = signalled(fn as AnyFunction, onMutated);
    }
  }
  const imports = source.import;
  if (isRecord(imports) && typeof imports.importRows === "function") {
    wrapped.import = {
      ...imports,
      importRows: signalled(imports.importRows as AnyFunction, onMutated),
    };
  }
  const tree = source.tree;
  if (isRecord(tree)) {
    const next: Record<string, unknown> = { ...tree };
    for (const name of ["move", "createFolder"]) {
      if (typeof tree[name] === "function") {
        next[name] = signalled(tree[name] as AnyFunction, onMutated);
      }
    }
    wrapped.tree = next;
  }
  return wrapped as T;
}

// Sections a reader sees --------------------------------------------------------------

const sectionHasWidgets = (section: DashboardSection): boolean =>
  section.type === "grid"
    ? section.layout.length > 0
    : section.widgetIds.length > 0;

/**
 * The sections as a reader sees them: without the `hidden` widgets (grids
 * close their gaps, top gravity) and without sections left empty. For
 * display only: the document keeps every widget and place.
 */
export function dashboardVisibleSections(
  sections: readonly DashboardSection[],
  hidden: ReadonlySet<string> = new Set()
): DashboardSection[] {
  const visible = hidden.size
    ? sections.map((section): DashboardSection => {
        if (section.type === "flow") {
          return {
            ...section,
            widgetIds: section.widgetIds.filter((id) => !hidden.has(id)),
          };
        }
        const layout = section.layout.filter(
          (item) => !hidden.has(item.widgetId)
        );
        return {
          ...section,
          layout:
            layout.length === section.layout.length
              ? section.layout
              : compactLayout(layout),
        };
      })
    : [...sections];
  return visible.filter(sectionHasWidgets);
}

// Notices ---------------------------------------------------------------------------

/**
 * `meta.notice` of a `list` or `aggregate` answer: the source has nothing to
 * show for a reason (`{ code: "notConfigured", message }`). Widgets show it,
 * muted, instead of empty data.
 */
export interface DashboardNotice {
  code?: string;
  message?: string;
}

/** The notice a `list` or `aggregate` answer carries in `meta.notice` (an object or a text). */
export function dashboardListNotice(
  result: unknown
): DashboardNotice | undefined {
  const notice =
    isRecord(result) && isRecord(result.meta) ? result.meta.notice : undefined;
  if (typeof notice === "string") {
    return notice.trim() ? { message: notice.trim() } : undefined;
  }
  if (!isRecord(notice)) {
    return;
  }
  const code = text(notice.code);
  const message = text(notice.message);
  return code || message
    ? { ...(code ? { code } : {}), ...(message ? { message } : {}) }
    : undefined;
}

/** Actions whose `list` and `aggregate` report the notices they answer. */
export function withNoticeCapture<
  T extends {
    list?: (params: never) => unknown;
    aggregate?: (params: never) => unknown;
  },
>(actions: T, onNotice: (notice: DashboardNotice | undefined) => void): T {
  const capture =
    (fn: AnyFunction) =>
    async (...args: unknown[]): Promise<unknown> => {
      const result = await (fn as (...values: unknown[]) => unknown)(...args);
      onNotice(dashboardListNotice(result));
      return result;
    };
  return {
    ...actions,
    ...(actions.list ? { list: capture(actions.list) } : {}),
    ...(actions.aggregate ? { aggregate: capture(actions.aggregate) } : {}),
  };
}

// Fitting records ----------------------------------------------------------------

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

/** Days `compare.days` offers in the widget picker. */
export const DASHBOARD_COMPARE_DAYS = [7, 30, 90, 365] as const;

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
    integer(days, DASHBOARD_KPI_DEFAULTS.compareDays),
    1,
    DASHBOARD_KPI_DEFAULTS.maxCompareDays
  );
  const { start, end } = dashboardDateRange(range);
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

/**
 * The dashboard's date range on a widget's column, when an active date filter
 * targets it: its days, a preset's resolved around `today`.
 */
export function dashboardDateRangeFor(
  dashboard: Pick<Dashboard, "filters">,
  widget: Pick<DashboardWidget, "id" | "tableId">,
  columnId: string,
  today: string = dashboardDayValue(new Date())
): DashboardDateRange | undefined {
  for (const filter of dashboard.filters) {
    const target =
      filter.type === "dateRange" && isDashboardFilterActive(filter)
        ? filter.targets.find((item) => targetsWidget(item, widget))
        : undefined;
    if (target?.columnId === columnId) {
      return resolveDashboardDateRange(filter.value, today);
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
  const rules = dashboardFilterRules(dashboard, widget, today);
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
  const range = dashboardDateRangeFor(dashboard, widget, dateColumn, today);
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

/**
 * A saved view's query as list parameters: its filters (date rules as the
 * viewer's days, whatever an older view saved) and search.
 */
export function dashboardViewParams(
  config: Record<string, unknown> = {}
): Record<string, unknown> {
  const columnFilters = Array.isArray(config.columnFilters)
    ? config.columnFilters.filter(isRecord)
    : [];
  const search = text(config.globalSearch);
  return {
    advancedFilters: normalizeDateFilterRules(config.advancedFilters ?? []),
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
  /** The source answered a `meta.notice` (e.g. not configured): shown instead of the figure. */
  notice?: DashboardNotice;
}

type ActionFn = (params: never) => unknown;

/**
 * Runs a KPI's requests through the table's `aggregate` (or its `list`, when
 * the host cannot group), each with the view's query and its own rules sent
 * as `requiredFilters`. A `meta.notice` in any answer comes back as `notice`.
 */
export async function loadDashboardKpi(input: {
  plan: DashboardKpiPlan;
  actions: { list?: ActionFn; aggregate?: ActionFn };
  params: Record<string, unknown>;
  locale: string;
  signal?: AbortSignal;
}): Promise<DashboardKpiResult> {
  let notice: DashboardNotice | undefined;
  const noticed = withNoticeCapture(input.actions, (found) => {
    notice ??= found;
  });
  const answers = await Promise.all(
    input.plan.queries.map(async (query) => {
      const actions = withDashboardFilters(noticed, query.rules) as {
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
    ...(notice ? { notice } : {}),
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

/** Whether a filter currently filters something. */
export function isDashboardFilterActive(
  filter: Pick<DashboardFilter, "type" | "value">
): boolean {
  if (filter.type === "dateRange") {
    const range = dashboardDateRange(filter.value);
    return Boolean(range.start || range.end || range.preset);
  }
  return dashboardSelectValues(filter.value).length > 0;
}

/** Last day of a calendar month (`month` 1–12). */
const monthEnd = (year: number, month: number): string =>
  new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
const pad2 = (value: number) => String(value).padStart(2, "0");

/** The days of a relative preset around `today` (`YYYY-MM-DD`). */
function presetRange(
  preset: DashboardDatePreset,
  today: string
): { start: string; end: string } {
  const [year = 1970, month = 1] = today.split("-").map(Number);
  switch (preset) {
    case "last7Days":
      return { start: shiftDashboardDay(today, -6), end: today };
    case "last30Days":
      return { start: shiftDashboardDay(today, -29), end: today };
    case "last90Days":
      return { start: shiftDashboardDay(today, -89), end: today };
    case "thisMonth":
      return {
        start: `${year}-${pad2(month)}-01`,
        end: monthEnd(year, month),
      };
    case "lastMonth": {
      const previousYear = month === 1 ? year - 1 : year;
      const previous = month === 1 ? 12 : month - 1;
      return {
        start: `${previousYear}-${pad2(previous)}-01`,
        end: monthEnd(previousYear, previous),
      };
    }
    default:
      return { start: `${year}-01-01`, end: `${year}-12-31` };
  }
}

/**
 * A date range filter's days: its own, or its preset's around `today` (the
 * reader's calendar day, so presets follow the reader's time zone): the last
 * 7, 30 or 90 days up to today, this calendar month, the previous one, this
 * year. Invalid values give no days.
 */
export function resolveDashboardDateRange(
  value: unknown,
  today: string = dashboardDayValue(new Date())
): { start?: string; end?: string } {
  const range = dashboardDateRange(value);
  if (!range.preset) {
    return range;
  }
  return DATE_ONLY.test(today) ? presetRange(range.preset, today) : {};
}

/** The advanced filter rule of a dashboard filter on one column (presets resolved around `today`). */
export function dashboardFilterRule(
  filter: Pick<DashboardFilter, "id" | "type" | "value">,
  columnId: string,
  today: string = dashboardDayValue(new Date())
): UnknownRecord | undefined {
  const base = { id: `dashboard-${filter.id}`, columnId, isActive: true };
  if (filter.type === "select") {
    const values = dashboardSelectValues(filter.value);
    return values.length
      ? { ...base, type: "select", operator: "isAnyOf", values }
      : undefined;
  }
  const { start, end } = resolveDashboardDateRange(filter.value, today);
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

/**
 * The dashboard's filter rules for one widget, on that widget's columns;
 * relative date presets resolve around `today` (the reader's day).
 */
export function dashboardFilterRules(
  dashboard: Pick<Dashboard, "filters">,
  widget: Pick<DashboardWidget, "id" | "tableId" | "type">,
  today: string = dashboardDayValue(new Date())
): UnknownRecord[] {
  if (widget.type === "note" || widget.type === "block" || !widget.tableId) {
    return [];
  }
  const rules: UnknownRecord[] = [];
  for (const filter of dashboard.filters) {
    const target = filter.targets.find((item) => targetsWidget(item, widget));
    const rule = target && dashboardFilterRule(filter, target.columnId, today);
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
        ? normalizeDashboardFilterValue({ ...filter, value })
        : filter
    ),
  };
}

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
  const added = normalizeDashboardFilter({
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
  widget: Pick<DashboardWidget, "id" | "tableId" | "type">,
  today: string = dashboardDayValue(new Date())
): string => JSON.stringify(dashboardFilterRules(dashboard, widget, today));

// Reader's filter values --------------------------------------------------------------

/** A filter's value: a date range (days or a preset) or the chosen options. */
export type DashboardFilterValue = DashboardDateRange | string[];

/**
 * Values a reader picked, by filter id: view state kept in the URL, never
 * written to the document. `null` is a filter the reader cleared (its default
 * no longer applies).
 */
export type DashboardViewerFilters = Readonly<
  Record<string, DashboardFilterValue | null>
>;

/** A filter's URL key: `<dashboardId>.<filterId>`. */
export const dashboardFilterUrlKey = (
  dashboardId: string,
  filterId: string
): string => `${dashboardId}.${filterId}`;

const RANGE_SEPARATOR = "..";

/**
 * A filter value as URL values: a preset (`last30Days`), days
 * (`2026-09-01..2026-09-30`, `2026-09-01..`, `..2026-09-30`) or one value per
 * option; `[""]` when the filter filters nothing.
 */
export function encodeDashboardFilterValue(
  filter: Pick<DashboardFilter, "type">,
  value: unknown
): string[] {
  if (filter.type === "select") {
    const values = dashboardSelectValues(value);
    return values.length ? values : [""];
  }
  const range = dashboardDateRange(value);
  if (range.preset) {
    return [range.preset];
  }
  return range.start || range.end
    ? [`${range.start ?? ""}${RANGE_SEPARATOR}${range.end ?? ""}`]
    : [""];
}

/** URL values back as a filter value; `null` when they filter nothing. */
export function decodeDashboardFilterValue(
  filter: Pick<DashboardFilter, "type">,
  values: readonly string[]
): DashboardFilterValue | null {
  if (filter.type === "select") {
    const chosen = dashboardSelectValues(values);
    return chosen.length ? chosen : null;
  }
  const first = values.at(0) ?? "";
  const [start, end] = first.includes(RANGE_SEPARATOR)
    ? first.split(RANGE_SEPARATOR)
    : [undefined, undefined];
  const range = dashboardDateRange(
    (DASHBOARD_DATE_PRESETS as readonly string[]).includes(first)
      ? { preset: first }
      : { start, end }
  );
  return range.start || range.end || range.preset ? range : null;
}

/** The values a URL gives a dashboard's filters: only the filters it names. */
export function readDashboardFilterValues(
  dashboard: Pick<Dashboard, "id" | "filters">,
  search: string | URLSearchParams
): Record<string, DashboardFilterValue | null> {
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search;
  const values: Record<string, DashboardFilterValue | null> = {};
  for (const filter of dashboard.filters) {
    const key = dashboardFilterUrlKey(dashboard.id, filter.id);
    if (params.has(key)) {
      values[filter.id] = decodeDashboardFilterValue(
        filter,
        params.getAll(key)
      );
    }
  }
  return values;
}

/**
 * A URL search with the reader's values of a dashboard's filters (one key per
 * filter the reader changed; the other keys are left as they are).
 */
export function writeDashboardFilterValues(
  dashboard: Pick<Dashboard, "id" | "filters">,
  search: string | URLSearchParams,
  values: DashboardViewerFilters
): string {
  const params = new URLSearchParams(search);
  for (const filter of dashboard.filters) {
    const key = dashboardFilterUrlKey(dashboard.id, filter.id);
    params.delete(key);
    if (Object.hasOwn(values, filter.id)) {
      for (const value of encodeDashboardFilterValue(
        filter,
        values[filter.id]
      )) {
        params.append(key, value);
      }
    }
  }
  return params.toString();
}

/**
 * The reader's values with one filter set: dropped when it equals the
 * document's default (the URL then leaves it out), `null` when cleared.
 */
export function setDashboardViewerFilter(
  dashboard: Pick<Dashboard, "filters">,
  values: DashboardViewerFilters,
  filterId: string,
  value: DashboardFilterValue | null | undefined
): Record<string, DashboardFilterValue | null> {
  const filter = dashboard.filters.find((item) => item.id === filterId);
  if (!filter) {
    return { ...values };
  }
  const next: Record<string, DashboardFilterValue | null> = Object.fromEntries(
    Object.entries(values).filter(([id]) => id !== filterId)
  );
  const picked = normalizeDashboardFilterValue({
    type: filter.type,
    value: value ?? undefined,
  });
  const same =
    JSON.stringify(encodeDashboardFilterValue(filter, picked.value)) ===
    JSON.stringify(encodeDashboardFilterValue(filter, filter.value));
  if (!same) {
    next[filterId] = picked.value ?? null;
  }
  return next;
}

/** The dashboard with the reader's filter values instead of the defaults. */
export function withDashboardFilterValues<T extends Pick<Dashboard, "filters">>(
  dashboard: T,
  values: DashboardViewerFilters
): T {
  if (!Object.keys(values).length) {
    return dashboard;
  }
  return {
    ...dashboard,
    filters: dashboard.filters.map((filter) =>
      Object.hasOwn(values, filter.id)
        ? normalizeDashboardFilterValue({
            ...filter,
            value: values[filter.id] ?? undefined,
          })
        : filter
    ),
  };
}

/**
 * The filters' current values by filter id, for host blocks: date ranges with
 * their days (a preset's resolved around `today`, the preset kept), chosen
 * options; nothing for a filter that filters nothing.
 */
export function dashboardFilterValues(
  dashboard: Pick<Dashboard, "filters">,
  today: string = dashboardDayValue(new Date())
): Record<string, DashboardFilterValue | undefined> {
  return Object.fromEntries(
    dashboard.filters.map((filter) => {
      if (!isDashboardFilterActive(filter)) {
        return [filter.id, undefined];
      }
      if (filter.type === "select") {
        return [filter.id, dashboardSelectValues(filter.value)];
      }
      const { preset } = dashboardDateRange(filter.value);
      return [
        filter.id,
        {
          ...resolveDashboardDateRange(filter.value, today),
          ...(preset ? { preset } : {}),
        },
      ];
    })
  );
}

// Blocks setting filters -------------------------------------------------------------

/** Why a block's `setFilter` refused a value. */
export type DashboardSetFilterCode = "invalidValue" | "unknownFilter";

/**
 * What a block's `setFilter` answers: the value the filter now holds (none
 * when cleared), or why the value was refused (the filter keeps its value).
 */
export type DashboardSetFilterResult =
  | { ok: true; value?: DashboardFilterValue }
  | { ok: false; code: DashboardSetFilterCode; message: string };

const DATE_RANGE_KEYS = new Set(["start", "end", "preset"]);

function dateRangeProblem(value: unknown): boolean {
  if (!isRecord(value)) {
    return true;
  }
  if (Object.keys(value).some((key) => !DATE_RANGE_KEYS.has(key))) {
    return true;
  }
  const { end, preset, start } = value;
  if (preset !== undefined) {
    const known = (DASHBOARD_DATE_PRESETS as readonly unknown[]).includes(
      preset
    );
    return !known || start !== undefined || end !== undefined;
  }
  const days = [start, end].filter((day) => day !== undefined);
  return (
    days.some((day) => !isCalendarDay(day)) ||
    (typeof start === "string" && typeof end === "string" && end < start)
  );
}

const isSelectItem = (item: unknown): boolean =>
  (typeof item === "string" && item !== "") ||
  (typeof item === "number" && Number.isFinite(item));

/**
 * Checks a value a block sets on a screen filter, as the filter bar would
 * set it: the filter exists; a select takes texts (one, or a list) among its
 * options when it has some (`filter.options`, else `options.options`, the
 * first target column's, which the renderer passes); a date range takes
 * `{ start?, end? }` days (`YYYY-MM-DD`, the start first) or a known
 * `preset` alone. `undefined` and `null` clear the filter, as does an empty
 * list or range. Never throws.
 */
export function checkDashboardFilterValue(
  dashboard: Pick<Dashboard, "filters">,
  filterId: string,
  value: unknown,
  options: {
    options?: readonly DashboardFilterOption[];
    locale?: string;
    translate?: DashboardTranslate;
  } = {}
): DashboardSetFilterResult {
  const locale = options.locale ?? "en";
  const filter = dashboard.filters.find((item) => item.id === filterId);
  if (!filter) {
    return {
      ok: false,
      code: "unknownFilter",
      message: dashboardLabel("unknownFilter", locale, options.translate, {
        filter: filterId,
      }),
    };
  }
  if (value === undefined || value === null) {
    return { ok: true };
  }
  const name = dashboardText(filter.label, locale) || filter.id;
  const refuse = (key: DashboardLabelKey, params = {}) =>
    ({
      ok: false,
      code: "invalidValue",
      message: dashboardLabel(key, locale, options.translate, {
        filter: name,
        ...params,
      }),
    }) as const;
  if (filter.type === "dateRange") {
    if (dateRangeProblem(value)) {
      return refuse("invalidDateRange");
    }
    const range = dashboardDateRange(value);
    return range.start || range.end || range.preset
      ? { ok: true, value: range }
      : { ok: true };
  }
  const items = Array.isArray(value) ? value : [value];
  if (!items.every(isSelectItem)) {
    return refuse("invalidSelect");
  }
  const values = dashboardSelectValues(items);
  const known = filter.options?.length ? filter.options : options.options;
  const unknown = known?.length
    ? values.find((item) => !known.some((option) => option.value === item))
    : undefined;
  if (unknown !== undefined) {
    return refuse("unknownOption", { value: unknown });
  }
  return values.length ? { ok: true, value: values } : { ok: true };
}

/**
 * The rules the screen's filters give a source's requests, for blocks that
 * query it (a facet list): every filter targeting the source (whatever
 * `widgetIds` it names), but those in `exclude`; relative periods resolve
 * around `today`.
 */
export function dashboardSourceFilterRules(
  dashboard: Pick<Dashboard, "filters">,
  tableId: string,
  options: { exclude?: readonly string[]; today?: string } = {}
): UnknownRecord[] {
  const today = options.today ?? dashboardDayValue(new Date());
  const rules: UnknownRecord[] = [];
  for (const filter of dashboard.filters) {
    if (options.exclude?.includes(filter.id)) {
      continue;
    }
    const target = filter.targets.find((item) => item.tableId === tableId);
    const rule = target && dashboardFilterRule(filter, target.columnId, today);
    if (rule) {
      rules.push(rule);
    }
  }
  return rules;
}

// Saved views -------------------------------------------------------------------

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
  typeTable: "Full-page table",
  typeBlock: "Block",
  unavailableForbidden: "You don’t have access to this data.",
  unavailableNotConfigured: "This source is not configured yet.",
  unavailableNotFound: "This source no longer exists.",
  unavailableError: "This source is not available.",
  unknownBlock: "Unavailable block",
  noticeDefault: "Nothing to show here yet.",
  screenDefaultView: "Screen default",
  presets: "Periods",
  presetLast7Days: "Last 7 days",
  presetLast30Days: "Last 30 days",
  presetLast90Days: "Last 90 days",
  presetThisMonth: "This month",
  presetLastMonth: "Last month",
  presetThisYear: "This year",
  addSection: "Add section",
  sectionGrid: "Grid of cards",
  sectionFlow: "Full width",
  sectionTitle: "Section title",
  sectionNumber: "Section {number}",
  sectionMenu: "Section options for {title}",
  addWidgetHere: "Add widget here",
  emptySection: "No widgets here yet.",
  removeSectionTitle: "Remove {title}?",
  removeSectionOne: "Its widget is removed with it.",
  removeSectionMany: "Its {count} widgets are removed with it.",
  sectionRemoved: "{title} removed",
  editWidget: "Edit…",
  editView: "Edit view…",
  useViewCopy: "Use a copy of this view",
  moveToSection: "Move to section",
  makeScreenDefault: "Make the current view the screen default",
  viewCopied: "{title} now uses a copy of its view",
  screenDefaultSet: "The current view is now the screen default",
  movedToSection: "{title} moved to {section}",
  editWidgetTitle: "Edit the widget",
  stepWhat: "What",
  stepSource: "Source",
  stepSettings: "Settings",
  stepOf: "Step {step} of {count}",
  chooseKind: "What should the widget show?",
  chooseSource: "Choose a source",
  kindKpi: "Number",
  kindKpiHint: "One figure over the records of a view",
  kindView: "View",
  kindViewHint: "Records in any display mode",
  kindTable: "Table page",
  kindTableHint: "A source’s full list page, at full width",
  kindNote: "Note",
  kindNoteHint: "Text",
  blocks: "Blocks",
  searchSources: "Search sources",
  noSources: "No source matches.",
  loadingSources: "Loading the sources…",
  sourcesError: "The sources could not be listed: {error}",
  sourceLoading: "Loading {source}…",
  back: "Back",
  apply: "Apply",
  startFrom: "Start from",
  savedViews: "Saved views",
  customView: "Custom view",
  customViewHint:
    "Its records, sort, columns and display are set in the view editor.",
  blockProps: "Properties (JSON)",
  invalidJson: "This is not valid JSON.",
  propsRefused: "The block refuses these properties:",
  viewEditorTitle: "Edit view",
  viewEditorDescription:
    "The table is the view: change its filters, sort, columns and display, then apply.",
  unsavedChanges: "Unsaved changes",
  close: "Close",
  discardTitle: "Discard your changes?",
  discardDescription: "The view keeps its previous settings.",
  keepEditing: "Keep editing",
  discard: "Discard",
  applyAndClose: "Apply and close",
  saveIssues: "The screen was not saved. Fix these problems first:",
  dismiss: "Dismiss",
  unknownFilter: "The screen has no filter “{filter}”.",
  invalidDateRange:
    "The filter “{filter}” takes days (YYYY-MM-DD, the start first) or a period.",
  invalidSelect: "The filter “{filter}” takes one text or a list of texts.",
  unknownOption: "“{value}” is not an option of the filter “{filter}”.",
  facetBlock: "Facet list",
  facetBlockDescription:
    "A column’s values with their number of records; a click sets a screen filter.",
  facetAll: "All",
  facetClear: "Clear",
  facetLoading: "Counting…",
  facetEmpty: "No values",
  facetError: "The values could not load.",
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
  typeTable: "Table pleine page",
  typeBlock: "Bloc",
  unavailableForbidden: "Vous n’avez pas accès à ces données.",
  unavailableNotConfigured: "Cette source n’est pas encore configurée.",
  unavailableNotFound: "Cette source n’existe plus.",
  unavailableError: "Cette source n’est pas disponible.",
  unknownBlock: "Bloc indisponible",
  noticeDefault: "Rien à afficher pour l’instant.",
  screenDefaultView: "Vue de l’écran",
  presets: "Périodes",
  presetLast7Days: "7 derniers jours",
  presetLast30Days: "30 derniers jours",
  presetLast90Days: "90 derniers jours",
  presetThisMonth: "Ce mois-ci",
  presetLastMonth: "Le mois dernier",
  presetThisYear: "Cette année",
  addSection: "Ajouter une section",
  sectionGrid: "Grille de cartes",
  sectionFlow: "Pleine largeur",
  sectionTitle: "Titre de la section",
  sectionNumber: "Section {number}",
  sectionMenu: "Options de la section {title}",
  addWidgetHere: "Ajouter un widget ici",
  emptySection: "Aucun widget ici pour l’instant.",
  removeSectionTitle: "Retirer {title} ?",
  removeSectionOne: "Son widget est retiré avec elle.",
  removeSectionMany: "Ses {count} widgets sont retirés avec elle.",
  sectionRemoved: "{title} retirée",
  editWidget: "Modifier…",
  editView: "Modifier la vue…",
  useViewCopy: "Utiliser une copie de cette vue",
  moveToSection: "Déplacer vers la section",
  makeScreenDefault: "Faire de la vue actuelle la vue par défaut de l’écran",
  viewCopied: "{title} utilise maintenant une copie de sa vue",
  screenDefaultSet:
    "La vue actuelle est maintenant la vue par défaut de l’écran",
  movedToSection: "{title} déplacé vers {section}",
  editWidgetTitle: "Modifier le widget",
  stepWhat: "Quoi",
  stepSource: "Source",
  stepSettings: "Réglages",
  stepOf: "Étape {step} sur {count}",
  chooseKind: "Que doit afficher le widget ?",
  chooseSource: "Choisir une source",
  kindKpi: "Nombre",
  kindKpiHint: "Un chiffre calculé sur les enregistrements d’une vue",
  kindView: "Vue",
  kindViewHint: "Des enregistrements, dans n’importe quel affichage",
  kindTable: "Page de table",
  kindTableHint: "La page de liste complète d’une source, en pleine largeur",
  kindNote: "Note",
  kindNoteHint: "Du texte",
  blocks: "Blocs",
  searchSources: "Rechercher une source",
  noSources: "Aucune source ne correspond.",
  loadingSources: "Chargement des sources…",
  sourcesError: "Les sources n’ont pas pu être listées : {error}",
  sourceLoading: "Chargement de {source}…",
  back: "Retour",
  apply: "Appliquer",
  startFrom: "Partir de",
  savedViews: "Vues enregistrées",
  customView: "Vue personnalisée",
  customViewHint:
    "Ses enregistrements, son tri, ses colonnes et son affichage se règlent dans l’éditeur de vue.",
  blockProps: "Propriétés (JSON)",
  invalidJson: "Ce n’est pas du JSON valide.",
  propsRefused: "Le bloc refuse ces propriétés :",
  viewEditorTitle: "Modifier la vue",
  viewEditorDescription:
    "Le tableau est la vue : modifiez ses filtres, son tri, ses colonnes et son affichage, puis appliquez.",
  unsavedChanges: "Modifications non appliquées",
  close: "Fermer",
  discardTitle: "Abandonner vos modifications ?",
  discardDescription: "La vue garde ses réglages précédents.",
  keepEditing: "Continuer à modifier",
  discard: "Abandonner",
  applyAndClose: "Appliquer et fermer",
  saveIssues:
    "L’écran n’a pas été enregistré. Corrigez d’abord ces problèmes :",
  dismiss: "Masquer",
  unknownFilter: "L’écran n’a pas de filtre « {filter} ».",
  invalidDateRange:
    "Le filtre « {filter} » prend des jours (AAAA-MM-JJ, le début d’abord) ou une période.",
  invalidSelect:
    "Le filtre « {filter} » prend un texte ou une liste de textes.",
  unknownOption: "« {value} » n’est pas une option du filtre « {filter} ».",
  facetBlock: "Liste de facettes",
  facetBlockDescription:
    "Les valeurs d’une colonne avec leur nombre d’enregistrements ; un clic règle un filtre de l’écran.",
  facetAll: "Toutes",
  facetClear: "Effacer",
  facetLoading: "Calcul…",
  facetEmpty: "Aucune valeur",
  facetError: "Les valeurs n’ont pas pu être chargées.",
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

const PRESET_LABELS: Record<DashboardDatePreset, DashboardLabelKey> = {
  last7Days: "presetLast7Days",
  last30Days: "presetLast30Days",
  last90Days: "presetLast90Days",
  thisMonth: "presetThisMonth",
  lastMonth: "presetLastMonth",
  thisYear: "presetThisYear",
};

/** The relative periods a date range filter offers, in menu order, with their labels. */
export const dashboardDatePresetOptions = (
  locale: string,
  translate?: DashboardTranslate
): { value: DashboardDatePreset; label: string }[] =>
  DASHBOARD_DATE_PRESETS.map((value) => ({
    value,
    label: dashboardLabel(PRESET_LABELS[value], locale, translate),
  }));

const UNAVAILABLE_LABELS: Record<string, DashboardLabelKey> = {
  forbidden: "unavailableForbidden",
  notConfigured: "unavailableNotConfigured",
  notFound: "unavailableNotFound",
  error: "unavailableError",
};

/**
 * Why a widget shows nothing: the host's message, else the reason's label
 * ("You don't have access to this data.", "This source is not configured
 * yet."…).
 */
export function dashboardUnavailableText(
  reason: string | undefined,
  message: string | undefined,
  locale: string,
  translate?: DashboardTranslate
): string {
  const own = text(message);
  if (own) {
    return own;
  }
  return dashboardLabel(
    (reason ? UNAVAILABLE_LABELS[reason] : undefined) ?? "unavailableError",
    locale,
    translate
  );
}

/** What a `meta.notice` says: its message, else its code's label, else a neutral text. */
export function dashboardNoticeText(
  notice: DashboardNotice,
  locale: string,
  translate?: DashboardTranslate
): string {
  const known = notice.code ? UNAVAILABLE_LABELS[notice.code] : undefined;
  return (
    text(notice.message) ||
    dashboardLabel(known ?? "noticeDefault", locale, translate)
  );
}

/** KPI metrics in menu order with their labels. */
export const dashboardMetricOptions = (
  locale: string,
  translate?: DashboardTranslate
): { value: DashboardKpiMetric; label: string }[] =>
  (Object.keys(METRIC_LABELS) as DashboardKpiMetric[]).map((value) => ({
    value,
    label: dashboardLabel(METRIC_LABELS[value], locale, translate),
  }));

/**
 * The widget's title: its own (in `locale`), the KPI label, its saved view's
 * name, the source's name (inline views and full-page tables) or the block's
 * label (its key when the host has no label).
 */
export function dashboardWidgetTitle(
  widget: DashboardWidget,
  context: {
    locale: string;
    translate?: DashboardTranslate;
    table?: Pick<DashboardTableInfo, "name">;
    view?: Pick<DashboardView, "name">;
    /** The host's block, for block widgets. */
    block?: { label?: DashboardText };
  }
): string {
  const own = dashboardText(widget.title, context.locale);
  if (own) {
    return own;
  }
  if (widget.type === "note") {
    return dashboardLabel("typeNote", context.locale, context.translate);
  }
  if (widget.type === "block") {
    return (
      dashboardText(context.block?.label, context.locale) ||
      (widget.block ?? "")
    );
  }
  const tableName = context.table?.name ?? widget.tableId ?? "";
  if (widget.type === "kpi") {
    const label = text(widget.settings.label);
    return label || tableName;
  }
  if (widget.type === "table" || widget.view) {
    return tableName;
  }
  return context.view?.name
    ? context.view.name
    : `${tableName} › ${dashboardLabel("defaultView", context.locale, context.translate)}`;
}

/**
 * A text with the version `locale` reads replaced by `value` (a rename in
 * edit mode): a plain text stays plain, a localized one keeps its other
 * languages.
 */
export function setDashboardText(
  text: DashboardText | undefined,
  locale: string,
  value: string
): DashboardText {
  if (text === undefined || typeof text === "string") {
    return value;
  }
  const shown = formLocaleMatch(Object.keys(text), locale) ?? locale;
  return { ...text, [shown]: value };
}

/**
 * What a text input shows for `locale`: a plain text, or exactly that
 * language's version of a localized one (`""` until it is written; no
 * fallback to another language).
 */
export function dashboardTextInput(
  text: DashboardText | undefined,
  locale: string
): string {
  if (text === undefined || typeof text === "string") {
    return text ?? "";
  }
  const key = formLocaleMatch(Object.keys(text), locale);
  return key ? (text[key] ?? "") : "";
}

/**
 * A text with the version `locale` reads set to `value`: a plain text stays
 * plain, a localized one keeps its other languages. An empty value removes
 * that version, and the text when nothing is left.
 */
export function editDashboardText(
  text: DashboardText | undefined,
  locale: string,
  value: string
): DashboardText | undefined {
  if (text === undefined || typeof text === "string") {
    return value === "" ? undefined : value;
  }
  const key = formLocaleMatch(Object.keys(text), locale) ?? locale;
  const others = Object.entries(text).filter(([name]) => name !== key);
  const entries = value === "" ? others : [...others, [key, value]];
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/** A filter's name in `locale`, else its id. */
export const dashboardFilterLabel = (
  filter: Pick<DashboardFilter, "id" | "label">,
  locale: string
): string => dashboardText(filter.label, locale) || filter.id;

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
  const { start, end, preset } = dashboardDateRange(value);
  if (preset) {
    return dashboardLabel(PRESET_LABELS[preset], locale, translate);
  }
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
