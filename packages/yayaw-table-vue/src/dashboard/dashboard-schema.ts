/**
 * Dashboard JSON v2, the grammar of dashboards and screens: sections (grids
 * of cards and full-width flows), widgets (saved or inline views, numbers,
 * notes, full-page tables and host blocks) and filters.
 *
 * - `validateDashboard` reads versions 0, 1 and 2, writes version 2, repairs
 *   what it can and reports the rest with JSON paths (errors and warnings).
 * - `checkDashboardReferences` checks the sources, views, columns and blocks
 *   a document names against what a host offers.
 * - `dashboardJsonSchema` describes documents for AI tools (MCP inputs).
 * - `canonicalDashboardJson` and `dashboardFingerprint` compare documents.
 * - The builders (`createDashboard`, `addDashboardSection`,
 *   `addDashboardWidget`, `moveWidgetToSection`…) change documents.
 *
 * Pure and server-safe (no React, Vue or CSS), so hosts run it on their
 * servers; shared by the React and Vue editions (synced to Vue). A new widget
 * or section type bumps `DASHBOARD_VERSION`: older documents are migrated on
 * read, newer ones refused, and a type a version does not know is dropped.
 */
import type { ChartBucket } from "../chart-model";
import { DISPLAY_MODE_IDS } from "../display-modes";
import {
  type FormText,
  normalizeFormText,
  resolveFormText,
} from "../form-text";
import { TABLE_DENSITY_OPTIONS } from "../table-contracts";
import {
  copyJson,
  describeValue,
  jsonPath,
  sanitizeViewConfig,
  VIEW_CONFIG_LIMITS,
  VIEW_FILTER_OPERATORS,
  VIEW_MODE_SETTING_KEYS,
  type ViewConfig,
  type ViewJsonObject,
} from "../view-config";
import {
  applyGridLayout,
  canMoveLayoutItem,
  canResizeLayoutItem,
  compactLayout,
  DASHBOARD_COLUMNS,
  DASHBOARD_MAX_HEIGHT,
  type DashboardDirection,
  type DashboardLayoutItem,
  type DashboardResize,
  defaultWidgetSize,
  findFreeSpot,
  moveLayoutItem,
  normalizeLayout,
  resizeLayoutItem,
  resolveLayout,
  sameLayout,
} from "./dashboard-layout";
import type { DashboardSourceSummary } from "./dashboard-sources";

// Grammar -----------------------------------------------------------------------

/** Version of the JSON `validateDashboard` writes. */
export const DASHBOARD_VERSION = 2;

export const DASHBOARD_WIDGET_TYPES = [
  "view",
  "kpi",
  "note",
  "table",
  "block",
] as const;
export type DashboardWidgetType = (typeof DASHBOARD_WIDGET_TYPES)[number];

export const DASHBOARD_SECTION_TYPES = ["grid", "flow"] as const;
export type DashboardSectionType = (typeof DASHBOARD_SECTION_TYPES)[number];

export const DASHBOARD_FILTER_TYPES = ["dateRange", "select"] as const;
export type DashboardFilterType = (typeof DASHBOARD_FILTER_TYPES)[number];

export const DASHBOARD_KPI_METRICS = [
  "count",
  "sum",
  "avg",
  "min",
  "max",
] as const;
export type DashboardKpiMetric = (typeof DASHBOARD_KPI_METRICS)[number];

/** Buckets a number's trend line can use. */
export const DASHBOARD_SPARKLINE_BUCKETS = [
  "day",
  "week",
  "month",
  "quarter",
  "year",
] as const satisfies readonly ChartBucket[];

/**
 * What a view widget does with records that do not fit its height: `fit`
 * (the default) shows the ones that fit and "+N more"; `scroll` keeps the
 * view's pagination and scrolls inside the widget.
 */
export const DASHBOARD_OVERFLOWS = ["fit", "scroll"] as const;
export type DashboardOverflow = (typeof DASHBOARD_OVERFLOWS)[number];

/** Where a host block goes: a grid card, a full-width flow item, or either. */
export const DASHBOARD_BLOCK_PLACEMENTS = ["grid", "flow", "any"] as const;
export type DashboardBlockPlacement =
  (typeof DASHBOARD_BLOCK_PLACEMENTS)[number];

/** Ids of widgets, sections and filters. */
export const DASHBOARD_ID_PATTERN = /^[A-Za-z0-9][\w-]{0,63}$/;
/** Keys of host blocks, e.g. `home.summary` or `media.storage`. */
export const DASHBOARD_BLOCK_PATTERN = /^[A-Za-z][\w.:-]{0,63}$/;

/** Widget types each version knows; the others are dropped on read. */
const VERSION_WIDGET_TYPES: Readonly<
  Record<number, readonly DashboardWidgetType[]>
> = {
  0: ["view", "kpi", "note"],
  1: ["view", "kpi", "note"],
  2: DASHBOARD_WIDGET_TYPES,
};

/**
 * A text readers see: one string for every language, or one per language
 * (`{ en: "Sales", fr: "Ventes" }`), as in forms.
 */
export type DashboardText = FormText;

/** A JSON object, such as a block's properties. */
export type DashboardJsonObject = ViewJsonObject;

/** Inline view settings: a saved view's `config`, sanitized by `sanitizeViewConfig`. */
export type DashboardInlineView = ViewConfig;

/**
 * A widget. `view`: a view of `tableId` (a saved view, `viewId`, or inline
 * settings, `view`; the source's default without either) in its display
 * mode, `settings: { overflow? }`. `kpi`: one number over the view's
 * records, `settings: DashboardKpiSettings`. `note`: text, `settings: { text
 * }`, rendered by the host's `renderMarkdown`. `table` (flow sections only):
 * the source as a full-page table, the view as its default view. `block`: a
 * host block (`block`, its key, and `props`, JSON).
 */
export interface DashboardWidget {
  id: string;
  type: DashboardWidgetType;
  /** Title shown instead of the view's, the source's or the block's name. */
  title?: DashboardText;
  /** Source of `view`, `kpi` and `table` widgets. */
  tableId?: string;
  /** A saved view of the source. */
  viewId?: string;
  /** Inline view settings, instead of `viewId`. */
  view?: DashboardInlineView;
  /** `block` widgets: the host block's key. */
  block?: string;
  /** `block` widgets: the block's properties. */
  props?: DashboardJsonObject;
  settings: Record<string, unknown>;
}

interface DashboardSectionBase {
  id: string;
  title?: DashboardText;
}

/** Cards on a 4-column grid, each where `layout` puts it. */
export interface DashboardGridSection extends DashboardSectionBase {
  type: "grid";
  layout: DashboardLayoutItem[];
}

/** Widgets stacked at full width and their natural height, in `widgetIds` order. */
export interface DashboardFlowSection extends DashboardSectionBase {
  type: "flow";
  widgetIds: string[];
}

export type DashboardSection = DashboardGridSection | DashboardFlowSection;

/**
 * Relative periods a date range filter can hold instead of fixed days,
 * resolved when the widgets query, in the viewer's time zone: the last 7, 30
 * or 90 days up to today, this calendar month, the previous one, this year.
 */
export const DASHBOARD_DATE_PRESETS = [
  "last7Days",
  "last30Days",
  "last90Days",
  "thisMonth",
  "lastMonth",
  "thisYear",
] as const;
export type DashboardDatePreset = (typeof DASHBOARD_DATE_PRESETS)[number];

/**
 * A date range filter's value: calendar days `YYYY-MM-DD` (both optional), or
 * a relative `preset` (then the days are left out).
 */
export interface DashboardDateRange {
  start?: string;
  end?: string;
  preset?: DashboardDatePreset;
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
 * sent to the source's `list`/`aggregate`. `value` is a date range (days or a
 * relative preset) or the chosen options: the default readers start from
 * (the values they pick stay in the URL); empty values filter nothing.
 */
export interface DashboardFilter {
  id: string;
  type: DashboardFilterType;
  label: DashboardText;
  targets: DashboardFilterTarget[];
  /** Choices of a select filter; by default the first target column's options. */
  options?: DashboardFilterOption[];
  value?: DashboardDateRange | string[];
}

/** Dashboard JSON, version 2: sections in order, the widgets they place, filters. */
export interface Dashboard {
  version: typeof DASHBOARD_VERSION;
  id: string;
  name: DashboardText;
  description?: DashboardText;
  sections: DashboardSection[];
  widgets: DashboardWidget[];
  filters: DashboardFilter[];
  updatedAt?: string;
}

/** A widget of version 1 (before sections): views, numbers and notes. */
export interface DashboardV1Widget {
  id: string;
  type: "view" | "kpi" | "note";
  tableId?: string;
  viewId?: string;
  title?: string;
  settings: Record<string, unknown>;
}

export interface DashboardV1Filter extends Omit<DashboardFilter, "label"> {
  label: string;
}

/**
 * Dashboard JSON, version 1: one grid (`layout`), before sections.
 * `validateDashboard` migrates it to a grid section `main`.
 */
export interface DashboardV1 {
  version: 1;
  id: string;
  name: string;
  layout: DashboardLayoutItem[];
  widgets: DashboardV1Widget[];
  filters: DashboardV1Filter[];
  updatedAt?: string;
}

/** A text in `locale`: its locale, its language, else the first version; `""` without one. */
export const dashboardText = (
  text: DashboardText | undefined,
  locale?: string
): string => resolveFormText(text, locale) ?? "";

// Numbers -----------------------------------------------------------------------

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

/** Defaults and bounds of number widgets' comparisons and trends. */
export const DASHBOARD_KPI_DEFAULTS = {
  compareDays: 30,
  maxCompareDays: 3660,
  sparklineBuckets: 6,
  minSparklineBuckets: 2,
  maxSparklineBuckets: 24,
} as const;

type Row = Record<string, unknown>;

const isRecord = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";
const integer = (value: unknown, fallback: number): number => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
};
const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
const oneOf = <T extends string>(
  list: readonly T[],
  value: unknown
): T | undefined =>
  typeof value === "string" && (list as readonly string[]).includes(value)
    ? (value as T)
    : undefined;

const optionRecord = (value: unknown): Row | undefined => {
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
    days: clamp(
      integer(input.days, DASHBOARD_KPI_DEFAULTS.compareDays),
      1,
      DASHBOARD_KPI_DEFAULTS.maxCompareDays
    ),
    better: input.better === "down" ? "down" : "up",
  };
}

function normalizeSparkline(value: unknown): DashboardKpiSparkline | undefined {
  const input = optionRecord(value);
  if (!input) {
    return;
  }
  return {
    bucket: oneOf(DASHBOARD_SPARKLINE_BUCKETS, input.bucket) ?? "month",
    buckets: clamp(
      integer(input.buckets, DASHBOARD_KPI_DEFAULTS.sparklineBuckets),
      DASHBOARD_KPI_DEFAULTS.minSparklineBuckets,
      DASHBOARD_KPI_DEFAULTS.maxSparklineBuckets
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
  const settings = isRecord(widget.settings) ? widget.settings : {};
  const metric = oneOf(DASHBOARD_KPI_METRICS, settings.metric) ?? "count";
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

// Filters -------------------------------------------------------------------------

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
/** Options and chosen values a select filter keeps. */
const MAX_FILTER_OPTIONS = 200;
/** Columns one filter applies to. */
const MAX_FILTER_TARGETS = 50;

/**
 * A date range filter's value: a known relative `preset` alone, else calendar
 * days only.
 */
export function dashboardDateRange(value: unknown): DashboardDateRange {
  const range = isRecord(value) ? value : {};
  const preset = oneOf(DASHBOARD_DATE_PRESETS, range.preset);
  if (preset) {
    return { preset };
  }
  const start = text(range.start);
  const end = text(range.end);
  return {
    ...(DATE_ONLY.test(start) ? { start } : {}),
    ...(DATE_ONLY.test(end) ? { end } : {}),
  };
}

/** A select filter's value: distinct, non-empty texts. */
export const dashboardSelectValues = (value: unknown): string[] =>
  Array.isArray(value)
    ? [
        ...new Set(
          value
            .filter(
              (item) => typeof item === "string" || typeof item === "number"
            )
            .map(String)
            .filter((item) => item !== "")
        ),
      ].slice(0, MAX_FILTER_OPTIONS)
    : [];

/** A filter with its value normalized, and without it when it filters nothing. */
export function normalizeDashboardFilterValue<
  T extends Pick<DashboardFilter, "type" | "value">,
>(filter: T): T {
  const { value: _value, ...rest } = filter;
  const value =
    filter.type === "dateRange"
      ? dashboardDateRange(filter.value)
      : dashboardSelectValues(filter.value);
  const empty = Array.isArray(value)
    ? value.length === 0
    : !(value.start || value.end || value.preset);
  return (empty ? rest : { ...rest, value }) as T;
}

// Limits and issues ---------------------------------------------------------------

export interface DashboardLimits {
  /** Sections of a document. */
  sections: number;
  /** Widgets of a document. */
  widgets: number;
  /** Filters of a document. */
  filters: number;
  /** Characters of a name, title, section title or filter label (per language). */
  title: number;
  /** Characters of a description (per language). */
  description: number;
  /** Characters of a note. */
  note: number;
  /** Characters of JSON a block's props may take. */
  blockProps: number;
  /** Nesting of a block's props. */
  blockPropsDepth: number;
  /** Sort rules, column filters and filter rules of an inline view, each. */
  viewRules: number;
  /** Bytes of a whole document, as JSON. */
  document: number;
}

export const DASHBOARD_LIMITS: Readonly<DashboardLimits> = {
  sections: 12,
  widgets: 50,
  filters: 12,
  title: 120,
  description: 500,
  note: 20_000,
  blockProps: 16_384,
  blockPropsDepth: 8,
  viewRules: 50,
  document: 262_144,
};

export type DashboardIssueCode =
  | "invalidDashboard"
  | "unsupportedVersion"
  | "invalidWidget"
  | "duplicateWidget"
  | "invalidSection"
  | "duplicateSection"
  | "invalidFilter"
  | "invalidValue"
  | "truncated"
  | "tooLarge"
  | "invalidBlockProps"
  | "invalidLayout"
  | "orphanWidget"
  | "misplacedWidget"
  | "invalidId"
  | "unknownKey"
  | "conflictingView"
  | "unknownBlock"
  | "unknownSource"
  | "unavailableSource"
  | "unknownView"
  | "unknownColumn"
  | "unsupportedDisplayMode";

export type DashboardIssueSeverity = "error" | "warning";

/**
 * Errors mean the document lost or cannot use something it asked for (the
 * host should not save it as is); warnings are repairs that keep its meaning.
 */
export const DASHBOARD_ISSUE_SEVERITY: Readonly<
  Record<DashboardIssueCode, DashboardIssueSeverity>
> = {
  invalidDashboard: "error",
  unsupportedVersion: "error",
  invalidWidget: "error",
  duplicateWidget: "error",
  invalidSection: "error",
  duplicateSection: "error",
  invalidFilter: "error",
  invalidValue: "error",
  truncated: "error",
  tooLarge: "error",
  invalidBlockProps: "error",
  invalidLayout: "warning",
  orphanWidget: "warning",
  misplacedWidget: "warning",
  invalidId: "warning",
  unknownKey: "warning",
  conflictingView: "warning",
  unknownBlock: "warning",
  unknownSource: "error",
  unavailableSource: "warning",
  unknownView: "error",
  unknownColumn: "error",
  unsupportedDisplayMode: "error",
};

export interface DashboardIssue {
  code: DashboardIssueCode;
  message: string;
  severity: DashboardIssueSeverity;
  /**
   * Where, as a JSON path in the document read (`widgets[2].view.sorting[0].id`);
   * absent for the whole document.
   */
  path?: string;
}

/** A problem a block's `validateProps` finds in its props. */
export interface DashboardBlockProblem {
  message: string;
  /** Path inside the props (`items[0].href`). */
  path?: string;
  /** `error` by default. */
  severity?: DashboardIssueSeverity;
}

/** What a block's `validateProps` returns: the problems found, or nothing. */
export type DashboardBlockPropsCheck =
  | readonly (string | DashboardBlockProblem)[]
  | undefined
  // biome-ignore lint/suspicious/noConfusingVoidType: a host's check may return nothing when the props are valid.
  | void;

/**
 * What a host says of one of its blocks, without its code: name, where it
 * goes, its default size and props, and the props contract. Pure data (and a
 * check), so servers and AI tools read it; the renderers' `DashboardBlock`
 * adds the component.
 */
export interface DashboardBlockSchema {
  /** Name in pickers, and the widget's title when it has none. */
  label?: DashboardText;
  description?: DashboardText;
  /** Heading the block is listed under in pickers, e.g. "Media". */
  group?: DashboardText;
  /** A grid card, a full-width flow item, or either (`any`, the default). */
  placement?: DashboardBlockPlacement;
  /** Grid size of a new widget of this block (columns and rows). */
  defaultSize?: { w: number; h: number };
  /** Props a new widget starts with; renderers apply them under the widget's own. */
  defaultProps?: DashboardJsonObject;
  /** JSON Schema of `props`, merged into `dashboardJsonSchema` for AI tools. */
  propsSchema?: Record<string, unknown>;
  /**
   * Checks `props` (a safe JSON copy) and returns its problems, as texts or
   * `DashboardBlockProblem`s; nothing when they are valid. May throw.
   */
  validateProps?: (props: DashboardJsonObject) => DashboardBlockPropsCheck;
}

/** @deprecated Renamed `DashboardBlockSchema`. */
export type DashboardBlockDefinition = DashboardBlockSchema;

/** The host's blocks, by key. */
export type DashboardBlocks = Readonly<Record<string, DashboardBlockSchema>>;

export interface DashboardValidationOptions {
  limits?: Partial<DashboardLimits>;
  /** The host's blocks: unknown keys are reported and `validateProps` runs. */
  blocks?: DashboardBlocks;
}

export interface DashboardValidation {
  /** The document as version 2, repaired; absent when the input is not a dashboard or too new. */
  dashboard?: Dashboard;
  issues: DashboardIssue[];
  /** A document and no errors: safe to save as is. */
  ok: boolean;
  /** The version the input was migrated from. */
  migratedFrom?: 0 | 1;
}

const MAX_ISSUES = 200;
const MAX_ID_LENGTH = 200;
const TIMESTAMP_LENGTH = 64;

interface Context {
  version: number;
  limits: DashboardLimits;
  blocks?: DashboardBlocks;
  issues: DashboardIssue[];
  issue: (
    code: DashboardIssueCode,
    message: string,
    path?: string,
    severity?: DashboardIssueSeverity
  ) => void;
}

function resolveLimits(limits: Partial<DashboardLimits> = {}): DashboardLimits {
  const resolved = { ...DASHBOARD_LIMITS };
  for (const key of Object.keys(resolved) as (keyof DashboardLimits)[]) {
    const value = limits[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      resolved[key] = Math.floor(value);
    }
  }
  return resolved;
}

function createContext(
  version: number,
  options: DashboardValidationOptions
): Context {
  const issues: DashboardIssue[] = [];
  return {
    version,
    limits: resolveLimits(options.limits),
    ...(options.blocks ? { blocks: options.blocks } : {}),
    issues,
    issue: (code, message, path, severity) => {
      if (issues.length < MAX_ISSUES) {
        issues.push({
          code,
          message,
          severity: severity ?? DASHBOARD_ISSUE_SEVERITY[code],
          ...(path ? { path } : {}),
        });
      } else if (issues.length === MAX_ISSUES) {
        issues.push({
          code: "truncated",
          message: `More problems were found; only the first ${MAX_ISSUES} are listed.`,
          severity: "error",
        });
      }
    },
  };
}

/** `prefix` followed by a path relative to it (`sorting[0]`, `["odd key"]`, `[2]`). */
const joinPath = (prefix: string, relative: string): string => {
  if (!relative) {
    return prefix;
  }
  if (!prefix || relative.startsWith("[")) {
    return `${prefix}${relative}`;
  }
  return `${prefix}.${relative}`;
};

function unknownKeys(
  value: Row,
  known: readonly string[],
  path: string,
  context: Context,
  where: string
) {
  for (const key of Object.keys(value)) {
    if (!known.includes(key)) {
      context.issue(
        "unknownKey",
        `"${key}" is not part of ${where} and was removed.`,
        jsonPath(path, key)
      );
    }
  }
}

/** A list, or `[]` with an issue; lists over `max` are cut. */
function listOf(
  value: unknown,
  path: string,
  context: Context,
  code: DashboardIssueCode,
  max: number
): unknown[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    context.issue(code, `Expected a list, got ${describeValue(value)}.`, path);
    return [];
  }
  if (value.length > max) {
    context.issue(
      "truncated",
      `Only the first ${max} items are kept (${value.length} given).`,
      path
    );
    return value.slice(0, max);
  }
  return value;
}

/** A trimmed text of at most `max` characters, or undefined. */
function plainText(
  value: unknown,
  path: string,
  context: Context,
  max: number
): string | undefined {
  if (value === undefined) {
    return;
  }
  if (typeof value !== "string") {
    context.issue(
      "invalidValue",
      `Expected a text, got ${describeValue(value)}.`,
      path
    );
    return;
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    context.issue("truncated", `Texts are cut at ${max} characters.`, path);
    return trimmed.slice(0, max);
  }
  return trimmed || undefined;
}

/** A localized text (`"Sales"` or `{ en, fr }`), each version cut at `max` characters. */
function localizedText(
  value: unknown,
  path: string,
  context: Context,
  max: number
): DashboardText | undefined {
  if (value === undefined || value === "") {
    return;
  }
  const normalized = normalizeFormText(value);
  if (normalized === undefined || typeof normalized === "string") {
    if (normalized === undefined && typeof value !== "string") {
      context.issue(
        "invalidValue",
        `Expected a text or { language: text }, got ${describeValue(value)}.`,
        path
      );
    }
    return normalized === undefined
      ? undefined
      : plainText(normalized, path, context, max);
  }
  if (
    isRecord(value) &&
    Object.keys(normalized).length < Object.keys(value).length
  ) {
    context.issue(
      "invalidValue",
      "Texts are keyed by language tags (en, fr, pt-BR) with non-empty texts; the others were removed.",
      path
    );
  }
  const entries = Object.entries(normalized).map(
    ([locale, content]): [string, string] => [
      locale,
      plainText(content, jsonPath(path, locale), context, max) ?? content,
    ]
  );
  return Object.fromEntries(entries);
}

const ID_DIACRITICS = /[\u0300-\u036f]/g;
const ID_UNSAFE = /[^A-Za-z0-9_-]+/g;
const ID_EDGES = /^[-_]+|[-_]+$/g;
const ID_LENGTH = 64;

/** A readable id from any text: `"Chiffre d'affaires"` → `"chiffre-d-affaires"`. */
export function dashboardSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(ID_DIACRITICS, "")
    .toLowerCase()
    .replace(ID_UNSAFE, "-")
    .replace(ID_EDGES, "")
    .slice(0, ID_LENGTH)
    .replace(ID_EDGES, "");
}

/** `base`, or `base-2`, `base-3`… when taken; at most 64 characters. */
function uniqueId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) {
    return base;
  }
  for (let index = 2; ; index += 1) {
    const suffix = `-${index}`;
    const candidate = `${base.slice(0, ID_LENGTH - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
}

/** An id as written: a trimmed text, or a finite number as text; `""` otherwise. */
function rawId(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return typeof value === "string" ? value.trim() : "";
}

interface Identified {
  raw: string;
  path: string;
  id: string;
}

/**
 * Final ids: valid ids stay, others become slugs (or `<prefix>-N`), unique
 * among all of them. Valid ids are reserved first, so a slug never takes one.
 */
function assignIds(
  entries: readonly Pick<Identified, "raw" | "path">[],
  prefix: string,
  kind: string,
  context: Context
): string[] {
  const taken = new Set(
    entries
      .map((entry) => entry.raw)
      .filter((raw) => DASHBOARD_ID_PATTERN.test(raw))
  );
  return entries.map((entry, index) => {
    if (DASHBOARD_ID_PATTERN.test(entry.raw)) {
      return entry.raw;
    }
    const id = uniqueId(
      dashboardSlug(entry.raw) || `${prefix}-${index + 1}`,
      taken
    );
    taken.add(id);
    context.issue(
      "invalidId",
      entry.raw
        ? `${kind} id ${describeValue(entry.raw)} became "${id}": ids are letters, digits, "-" and "_" (64 at most).`
        : `A ${kind.toLowerCase()} without an id got "${id}".`,
      jsonPath(entry.path, "id")
    );
    return id;
  });
}

// Widgets -------------------------------------------------------------------------

/** Fields each widget type takes, besides `id`, `type`, `title` and `settings`. */
const WIDGET_FIELDS: Readonly<Record<DashboardWidgetType, readonly string[]>> =
  {
    view: ["tableId", "viewId", "view"],
    kpi: ["tableId", "viewId", "view"],
    note: [],
    table: ["tableId", "viewId", "view"],
    block: ["block", "props"],
  };
const WIDGET_COMMON = ["id", "type", "title", "settings"];

/** Settings each widget type takes. */
const SETTING_KEYS: Readonly<Record<DashboardWidgetType, readonly string[]>> = {
  view: ["overflow"],
  kpi: [
    "metric",
    "metricColumn",
    "label",
    "dateColumn",
    "compare",
    "sparkline",
  ],
  note: ["text"],
  table: [],
  block: [],
};

const isWidgetType = (
  value: unknown,
  version: number
): value is DashboardWidgetType =>
  typeof value === "string" &&
  (VERSION_WIDGET_TYPES[version] ?? []).includes(value as DashboardWidgetType);

function viewSettings(value: Row, path: string, context: Context): Row {
  const { overflow } = value;
  if (overflow === "scroll") {
    return { overflow };
  }
  if (overflow !== undefined && overflow !== "fit") {
    context.issue(
      "invalidValue",
      `"overflow" is "fit" or "scroll", got ${describeValue(overflow)}.`,
      jsonPath(path, "overflow")
    );
  }
  return {};
}

function kpiIssues(
  value: Row,
  settings: DashboardKpiSettings,
  path: string,
  context: Context
) {
  if (
    value.metric !== undefined &&
    !oneOf(DASHBOARD_KPI_METRICS, value.metric)
  ) {
    context.issue(
      "invalidValue",
      `Unknown metric ${describeValue(value.metric)}: ${DASHBOARD_KPI_METRICS.join(", ")}.`,
      jsonPath(path, "metric")
    );
  } else if (value.metric !== undefined && value.metric !== settings.metric) {
    context.issue(
      "invalidValue",
      `The "${String(value.metric)}" metric needs a number column ("metricColumn"); the widget counts records.`,
      jsonPath(path, "metricColumn")
    );
  }
  for (const key of ["compare", "sparkline"] as const) {
    const given = value[key] !== undefined && value[key] !== false;
    if (given && !settings[key]) {
      context.issue(
        "invalidValue",
        settings.dateColumn
          ? `"${key}" is true or an object of its options.`
          : `"${key}" needs a date column ("dateColumn").`,
        jsonPath(path, key)
      );
    }
  }
}

function kpiSettings(value: Row, path: string, context: Context): Row {
  const label = plainText(
    value.label,
    jsonPath(path, "label"),
    context,
    context.limits.title
  );
  for (const key of ["metricColumn", "dateColumn"]) {
    plainText(value[key], jsonPath(path, key), context, MAX_ID_LENGTH);
  }
  const { label: _label, ...settings } = dashboardKpiSettings({
    settings: value,
  });
  kpiIssues(value, settings, path, context);
  return { ...settings, ...(label ? { label } : {}) };
}

function noteSettings(value: Row, path: string, context: Context): Row {
  const noteText = value.text;
  if (noteText === undefined) {
    return {};
  }
  if (typeof noteText !== "string") {
    context.issue(
      "invalidValue",
      `A note's text is a text, got ${describeValue(noteText)}.`,
      jsonPath(path, "text")
    );
    return {};
  }
  const max = context.limits.note;
  if (noteText.length > max) {
    context.issue(
      "truncated",
      `Notes are cut at ${max} characters.`,
      jsonPath(path, "text")
    );
    return { text: noteText.slice(0, max) };
  }
  return { text: noteText };
}

function settingsOf(
  type: DashboardWidgetType,
  value: unknown,
  path: string,
  context: Context
): Row {
  if (value === undefined) {
    return type === "kpi" ? { metric: "count" } : {};
  }
  if (!isRecord(value)) {
    context.issue(
      "invalidValue",
      `Widget settings are an object, got ${describeValue(value)}.`,
      path
    );
    return type === "kpi" ? { metric: "count" } : {};
  }
  unknownKeys(
    value,
    SETTING_KEYS[type],
    path,
    context,
    `${type} widget settings`
  );
  switch (type) {
    case "view":
      return viewSettings(value, path, context);
    case "kpi":
      return kpiSettings(value, path, context);
    case "note":
      return noteSettings(value, path, context);
    default:
      return {};
  }
}

/** Views: the source, and a saved view or inline settings (inline wins). */
function sourceFields(
  value: Row,
  path: string,
  context: Context
): Pick<DashboardWidget, "tableId" | "viewId" | "view"> | undefined {
  const tableId = plainText(
    value.tableId,
    jsonPath(path, "tableId"),
    context,
    MAX_ID_LENGTH
  );
  if (!tableId) {
    context.issue(
      "invalidWidget",
      `A ${String(value.type)} widget needs a source ("tableId"); it was dropped.`,
      path
    );
    return;
  }
  const viewId = plainText(
    value.viewId,
    jsonPath(path, "viewId"),
    context,
    MAX_ID_LENGTH
  );
  if (value.view === undefined) {
    return { tableId, ...(viewId ? { viewId } : {}) };
  }
  const viewPath = jsonPath(path, "view");
  const { config, issues } = sanitizeViewConfig(value.view, {
    rules: context.limits.viewRules,
  });
  for (const issue of issues) {
    context.issue(issue.code, issue.message, joinPath(viewPath, issue.path));
  }
  if (viewId) {
    context.issue(
      "conflictingView",
      `The widget has both a saved view ("viewId") and inline settings ("view"); the inline settings are kept.`,
      jsonPath(path, "viewId")
    );
  }
  return { tableId, view: config };
}

/** Problems a block's `validateProps` returned, as issues. */
function blockProblems(problems: unknown, path: string, context: Context) {
  if (!Array.isArray(problems)) {
    return;
  }
  for (const problem of problems.slice(0, MAX_ISSUES)) {
    if (typeof problem === "string") {
      context.issue("invalidBlockProps", problem, path);
    } else if (isRecord(problem) && typeof problem.message === "string") {
      context.issue(
        "invalidBlockProps",
        problem.message,
        joinPath(path, typeof problem.path === "string" ? problem.path : ""),
        problem.severity === "warning" ? "warning" : "error"
      );
    }
  }
}

/** A block's props: a safe JSON copy, then the host's `validateProps`. */
function blockProps(
  value: unknown,
  block: string,
  path: string,
  context: Context
): DashboardJsonObject {
  if (value !== undefined && !isRecord(value)) {
    context.issue(
      "invalidBlockProps",
      `Block props are a JSON object, got ${describeValue(value)}.`,
      path
    );
  }
  const copy = copyJson(
    isRecord(value) ? value : {},
    {
      depth: context.limits.blockPropsDepth,
      size: context.limits.blockProps,
    },
    path
  );
  for (const issue of copy.issues) {
    context.issue("invalidBlockProps", issue.message, issue.path);
  }
  if (copy.oversize) {
    context.issue(
      "tooLarge",
      `Block props are larger than ${context.limits.blockProps} characters of JSON; they were removed.`,
      path
    );
  }
  const props = !copy.oversize && isRecord(copy.value) ? copy.value : {};
  const definition =
    context.blocks && Object.hasOwn(context.blocks, block)
      ? context.blocks[block]
      : undefined;
  try {
    blockProblems(definition?.validateProps?.(props), path, context);
  } catch (error) {
    context.issue(
      "invalidBlockProps",
      `The "${block}" block rejected its props: ${error instanceof Error ? error.message : String(error)}`,
      path
    );
  }
  return props;
}

/** A block's props as `validateDashboard` reads them. */
export interface DashboardBlockPropsResult {
  /** The props kept: a safe JSON copy (`{}` when they were removed). */
  props: DashboardJsonObject;
  /** Problems, with paths inside the props. */
  issues: DashboardIssue[];
  /** No error: the props can be saved as they are. */
  ok: boolean;
}

/**
 * Checks a block's props as `validateDashboard` does: a JSON object, copied
 * safely (no prototype keys or functions, 8 levels and 16 KB at most), then
 * the host block's `validateProps`. Editors run it before applying props.
 */
export function checkDashboardBlockProps(
  block: string,
  props: unknown,
  options: DashboardValidationOptions = {}
): DashboardBlockPropsResult {
  const context = createContext(DASHBOARD_VERSION, options);
  const kept = blockProps(props, block, "", context);
  return {
    props: kept,
    issues: context.issues,
    ok: !context.issues.some((issue) => issue.severity === "error"),
  };
}

function blockFields(
  value: Row,
  path: string,
  context: Context
): Pick<DashboardWidget, "block" | "props"> | undefined {
  const block = typeof value.block === "string" ? value.block.trim() : "";
  if (!DASHBOARD_BLOCK_PATTERN.test(block)) {
    context.issue(
      "invalidWidget",
      `A block widget needs a block key ("block"), got ${describeValue(value.block)}; it was dropped.`,
      path
    );
    return;
  }
  if (context.blocks && !Object.hasOwn(context.blocks, block)) {
    context.issue(
      "unknownBlock",
      `This host has no "${block}" block; the widget shows as unavailable.`,
      jsonPath(path, "block")
    );
  }
  const props = blockProps(
    value.props,
    block,
    jsonPath(path, "props"),
    context
  );
  return { block, ...(Object.keys(props).length ? { props } : {}) };
}

interface ParsedWidget {
  widget: DashboardWidget;
  raw: string;
  path: string;
}

function widgetOf(
  value: unknown,
  path: string,
  context: Context
): ParsedWidget | undefined {
  if (!isRecord(value)) {
    context.issue(
      "invalidWidget",
      `Widgets are objects, got ${describeValue(value)}.`,
      path
    );
    return;
  }
  const { type } = value;
  if (!isWidgetType(type, context.version)) {
    context.issue(
      "invalidWidget",
      `Unknown widget type ${describeValue(type)} in version ${context.version}; the widget was dropped.`,
      jsonPath(path, "type")
    );
    return;
  }
  unknownKeys(
    value,
    [...WIDGET_COMMON, ...WIDGET_FIELDS[type]],
    path,
    context,
    `a ${type} widget`
  );
  let fields: Partial<DashboardWidget> | undefined = {};
  if (WIDGET_FIELDS[type].includes("tableId")) {
    fields = sourceFields(value, path, context);
  } else if (type === "block") {
    fields = blockFields(value, path, context);
  }
  if (!fields) {
    return;
  }
  const title = localizedText(
    value.title,
    jsonPath(path, "title"),
    context,
    context.limits.title
  );
  return {
    raw: rawId(value.id),
    path,
    widget: {
      id: "",
      type,
      ...(title ? { title } : {}),
      ...fields,
      settings: settingsOf(
        type,
        value.settings,
        jsonPath(path, "settings"),
        context
      ),
    },
  };
}

/** Widgets as read: invalid ones dropped, duplicates of an id dropped, ids repaired. */
function collectWidgets(value: unknown, context: Context): ParsedWidget[] {
  const parsed: ParsedWidget[] = [];
  const entries = listOf(
    value,
    "widgets",
    context,
    "invalidWidget",
    context.limits.widgets
  );
  for (const [index, entry] of entries.entries()) {
    const path = jsonPath("widgets", index);
    const widget = widgetOf(entry, path, context);
    if (widget?.raw && parsed.some((other) => other.raw === widget.raw)) {
      context.issue(
        "duplicateWidget",
        `Widget "${widget.raw}" appears twice; this one was dropped.`,
        path
      );
    } else if (widget) {
      parsed.push(widget);
    }
  }
  const ids = assignIds(parsed, "widget", "Widget", context);
  for (const [index, entry] of parsed.entries()) {
    entry.widget.id = ids[index] ?? entry.widget.id;
  }
  return parsed;
}

// Sections ------------------------------------------------------------------------

interface SectionReference {
  raw: string;
  path: string;
  place?: Omit<DashboardLayoutItem, "widgetId">;
}

interface ParsedSection {
  raw: string;
  path: string;
  type: DashboardSectionType;
  title?: DashboardText;
  references: SectionReference[];
}

const LAYOUT_ITEM_KEYS = ["widgetId", "x", "y", "w", "h"];
/** react-grid-layout items (version 0) key the widget `i` and carry their own options. */
const LEGACY_LAYOUT_KEYS = [
  "i",
  "id",
  "minW",
  "minH",
  "maxW",
  "maxH",
  "static",
  "moved",
  "isDraggable",
  "isResizable",
];

function layoutReferences(
  value: unknown,
  path: string,
  context: Context
): SectionReference[] {
  const references: SectionReference[] = [];
  const max = context.limits.widgets * 2;
  for (const [index, item] of listOf(
    value,
    path,
    context,
    "invalidLayout",
    max
  ).entries()) {
    const itemPath = jsonPath(path, index);
    const raw = isRecord(item)
      ? rawId(
          item.widgetId ??
            (context.version === 0 ? (item.i ?? item.id) : undefined)
        )
      : "";
    if (!(isRecord(item) && raw)) {
      context.issue(
        "invalidLayout",
        "Layout items are `{ widgetId, x, y, w, h }`; this one was removed.",
        itemPath
      );
      continue;
    }
    unknownKeys(
      item,
      context.version === 0
        ? [...LAYOUT_ITEM_KEYS, ...LEGACY_LAYOUT_KEYS]
        : LAYOUT_ITEM_KEYS,
      itemPath,
      context,
      "a layout item"
    );
    references.push({
      raw,
      path: itemPath,
      place: {
        x: integer(item.x, 0),
        y: integer(item.y, 0),
        w: integer(item.w, 1),
        h: integer(item.h, 1),
      },
    });
  }
  return references;
}

function flowReferences(
  value: unknown,
  path: string,
  context: Context
): SectionReference[] {
  const references: SectionReference[] = [];
  const max = context.limits.widgets * 2;
  for (const [index, item] of listOf(
    value,
    path,
    context,
    "invalidLayout",
    max
  ).entries()) {
    const itemPath = jsonPath(path, index);
    const raw = rawId(item);
    if (raw) {
      references.push({ raw, path: itemPath });
    } else {
      context.issue(
        "invalidLayout",
        `Flow sections list widget ids, got ${describeValue(item)}.`,
        itemPath
      );
    }
  }
  return references;
}

function sectionOf(
  value: unknown,
  path: string,
  context: Context
): ParsedSection | undefined {
  if (!isRecord(value)) {
    context.issue(
      "invalidSection",
      `Sections are objects, got ${describeValue(value)}.`,
      path
    );
    return;
  }
  const type = oneOf(DASHBOARD_SECTION_TYPES, value.type);
  if (!type) {
    context.issue(
      "invalidSection",
      `Unknown section type ${describeValue(value.type)}: grid or flow. Its widgets go to other sections.`,
      jsonPath(path, "type")
    );
    return;
  }
  const places = type === "grid" ? "layout" : "widgetIds";
  unknownKeys(
    value,
    ["id", "type", "title", places],
    path,
    context,
    `a ${type} section`
  );
  const title = localizedText(
    value.title,
    jsonPath(path, "title"),
    context,
    context.limits.title
  );
  const references =
    type === "grid"
      ? layoutReferences(value.layout, jsonPath(path, "layout"), context)
      : flowReferences(value.widgetIds, jsonPath(path, "widgetIds"), context);
  return {
    raw: rawId(value.id),
    path,
    type,
    ...(title ? { title } : {}),
    references,
  };
}

function collectSections(
  value: unknown,
  context: Context
): (ParsedSection & { id: string })[] {
  const parsed: ParsedSection[] = [];
  const entries = listOf(
    value,
    "sections",
    context,
    "invalidSection",
    context.limits.sections
  );
  for (const [index, entry] of entries.entries()) {
    const path = jsonPath("sections", index);
    const section = sectionOf(entry, path, context);
    if (section?.raw && parsed.some((other) => other.raw === section.raw)) {
      context.issue(
        "duplicateSection",
        `Section "${section.raw}" appears twice; this one was dropped and its widgets go to other sections.`,
        path
      );
    } else if (section) {
      parsed.push(section);
    }
  }
  const ids = assignIds(parsed, "section", "Section", context);
  return parsed.map((section, index) => ({
    ...section,
    id: ids[index] ?? `section-${index + 1}`,
  }));
}

/**
 * Section types a widget may go in: full-page tables in flows, blocks where
 * their host puts them (`placement`, read from the host's `blocks`), the
 * others anywhere.
 */
export function dashboardAcceptedSections(
  widget: Pick<DashboardWidget, "type" | "block">,
  blocks?: DashboardBlocks
): readonly DashboardSectionType[] {
  if (widget.type === "table") {
    return ["flow"];
  }
  const placement =
    widget.type === "block" &&
    widget.block &&
    blocks &&
    Object.hasOwn(blocks, widget.block)
      ? blocks[widget.block]?.placement
      : undefined;
  if (placement === "grid" || placement === "flow") {
    return [placement];
  }
  return DASHBOARD_SECTION_TYPES;
}

/** An unused section id: `preferred` when free, else `section-N`. */
export function nextSectionId(
  sections: readonly { id: string }[],
  preferred?: string
): string {
  const ids = new Set(sections.map((section) => section.id));
  if (preferred && !ids.has(preferred)) {
    return preferred;
  }
  let index = sections.length + 1;
  while (ids.has(`section-${index}`)) {
    index += 1;
  }
  return `section-${index}`;
}

const emptySection = (
  type: DashboardSectionType,
  id: string,
  title?: DashboardText
): DashboardSection =>
  type === "grid"
    ? { id, type, ...(title ? { title } : {}), layout: [] }
    : { id, type, ...(title ? { title } : {}), widgetIds: [] };

/** The widget added to a section: at the first free spot of a grid, at `index` of a flow. */
function withWidget(
  section: DashboardSection,
  widget: Pick<DashboardWidget, "id" | "type">,
  place: { size?: { w: number; h: number }; index?: number } = {}
): DashboardSection {
  if (section.type === "flow") {
    const widgetIds = [...section.widgetIds];
    widgetIds.splice(place.index ?? widgetIds.length, 0, widget.id);
    return { ...section, widgetIds };
  }
  const size = place.size ?? defaultWidgetSize(widget.type);
  const spot = findFreeSpot(section.layout, size);
  return {
    ...section,
    layout: resolveLayout(
      [...section.layout, { widgetId: widget.id, ...spot, ...size }],
      widget.id
    ),
  };
}

interface Placement {
  sections: DashboardSection[];
  /** Section of each placed widget. */
  placed: Map<string, string>;
  /** Widgets a section cannot hold, and where they were found. */
  misplaced: Map<string, string>;
}

/** Places each section's references: unknown, repeated and misplaced ones are removed. */
function placeReferences(
  parsed: readonly (ParsedSection & { id: string })[],
  widgets: ReadonlyMap<string, DashboardWidget>,
  context: Context
): Placement {
  const placement: Placement = {
    sections: [],
    placed: new Map(),
    misplaced: new Map(),
  };
  for (const section of parsed) {
    const layout: DashboardLayoutItem[] = [];
    const widgetIds: string[] = [];
    for (const reference of section.references) {
      const widget = widgets.get(reference.raw);
      if (!widget) {
        context.issue(
          "invalidLayout",
          `No widget "${reference.raw}"; the reference was removed.`,
          reference.path
        );
        continue;
      }
      if (
        placement.placed.has(widget.id) ||
        placement.misplaced.has(widget.id)
      ) {
        context.issue(
          "invalidLayout",
          `Widget "${widget.id}" is already placed; this place was removed.`,
          reference.path
        );
        continue;
      }
      if (
        !dashboardAcceptedSections(widget, context.blocks).includes(
          section.type
        )
      ) {
        placement.misplaced.set(widget.id, reference.path);
        continue;
      }
      placement.placed.set(widget.id, section.id);
      if (reference.place) {
        layout.push({ widgetId: widget.id, ...reference.place });
      } else {
        widgetIds.push(widget.id);
      }
    }
    placement.sections.push(
      section.type === "grid"
        ? repairedGrid(section, layout, widgets, context)
        : {
            id: section.id,
            type: "flow",
            ...(section.title ? { title: section.title } : {}),
            widgetIds,
          }
    );
  }
  return placement;
}

/** A grid section's layout inside the grid, without overlaps; repairs are reported. */
function repairedGrid(
  section: ParsedSection & { id: string },
  items: DashboardLayoutItem[],
  widgets: ReadonlyMap<string, DashboardWidget>,
  context: Context
): DashboardGridSection {
  const members = items.map((item) => ({
    id: item.widgetId,
    type:
      [...widgets.values()].find((widget) => widget.id === item.widgetId)
        ?.type ?? "view",
  }));
  const layout = normalizeLayout(items, members);
  if (!sameLayout(items, layout)) {
    context.issue(
      "invalidLayout",
      `The layout of section "${section.id}" overlapped or left the ${DASHBOARD_COLUMNS}-column grid; it was repaired.`,
      jsonPath(section.path, "layout")
    );
  }
  return {
    id: section.id,
    type: "grid",
    ...(section.title ? { title: section.title } : {}),
    layout,
  };
}

/**
 * Widgets no section holds (orphans, and misplaced ones) go to the first
 * section that takes them, created when there is none.
 */
function placeRemaining(
  placement: Placement,
  parsed: readonly ParsedWidget[],
  context: Context
): Set<string> {
  const dropped = new Set<string>();
  for (const { widget, path } of parsed) {
    if (placement.placed.has(widget.id)) {
      continue;
    }
    const accepted = dashboardAcceptedSections(widget, context.blocks);
    let index = placement.sections.findIndex((section) =>
      accepted.includes(section.type)
    );
    if (index < 0 && placement.sections.length >= context.limits.sections) {
      context.issue(
        "truncated",
        `Widget "${widget.id}" needs a ${accepted[0]} section and the dashboard has ${context.limits.sections} already; it was dropped.`,
        path
      );
      dropped.add(widget.id);
      continue;
    }
    if (index < 0) {
      const type = accepted[0] ?? "grid";
      placement.sections.push(
        emptySection(
          type,
          nextSectionId(
            placement.sections,
            type === "grid" ? "main" : undefined
          )
        )
      );
      index = placement.sections.length - 1;
    }
    const target = placement.sections[index];
    if (!target) {
      continue;
    }
    placement.sections[index] = withWidget(target, widget);
    placement.placed.set(widget.id, target.id);
    const from = placement.misplaced.get(widget.id);
    if (from) {
      context.issue(
        "misplacedWidget",
        `A ${widget.type} widget cannot go in a ${accepted.includes("grid") ? "flow" : "grid"} section; "${widget.id}" moved to section "${target.id}".`,
        from
      );
    } else {
      context.issue(
        "orphanWidget",
        `Widget "${widget.id}" was in no section; it was added to section "${target.id}".`,
        path
      );
    }
  }
  return dropped;
}

// Filters (reading) ------------------------------------------------------------------

type Report = (
  code: DashboardIssueCode,
  message: string,
  path?: string
) => void;
const silent: Report = () => undefined;

function targetOf(
  value: unknown,
  path: string,
  widgetIds: ReadonlyMap<string, string> | undefined,
  report: Report
): DashboardFilterTarget | undefined {
  if (!isRecord(value)) {
    report(
      "invalidFilter",
      "Filter targets are `{ tableId, columnId, widgetIds? }`.",
      path
    );
    return;
  }
  const tableId = text(value.tableId).slice(0, MAX_ID_LENGTH);
  const columnId = text(value.columnId).slice(0, MAX_ID_LENGTH);
  if (!(tableId && columnId)) {
    report(
      "invalidFilter",
      "Filter targets need a source (tableId) and a column (columnId); this one was removed.",
      path
    );
    return;
  }
  if (!Array.isArray(value.widgetIds)) {
    return { tableId, columnId };
  }
  const ids: string[] = [];
  for (const [index, item] of value.widgetIds.entries()) {
    const raw = rawId(item);
    const id = widgetIds ? widgetIds.get(raw) : raw;
    if (id) {
      ids.push(id);
    } else {
      report(
        "invalidFilter",
        `No widget ${describeValue(item)}; it was removed from the target.`,
        jsonPath(jsonPath(path, "widgetIds"), index)
      );
    }
  }
  if (!ids.length && value.widgetIds.length) {
    report(
      "invalidFilter",
      "None of this target's widgets exist; the target was removed.",
      path
    );
    return;
  }
  return {
    tableId,
    columnId,
    ...(ids.length ? { widgetIds: [...new Set(ids)] } : {}),
  };
}

const optionsOf = (value: unknown): DashboardFilterOption[] =>
  Array.isArray(value)
    ? value
        .slice(0, MAX_FILTER_OPTIONS)
        .filter(isRecord)
        .map((option) => ({
          value: String(option.value ?? ""),
          label: String(option.label ?? option.value ?? ""),
        }))
    : [];

interface FilterReading {
  report: Report;
  widgetIds?: ReadonlyMap<string, string>;
  titleLength: number;
  localize?: (value: unknown, path: string) => DashboardText | undefined;
}

function filterOf(
  value: unknown,
  path: string,
  reading: FilterReading
): (DashboardFilter & { raw: string }) | undefined {
  const { report } = reading;
  if (!isRecord(value)) {
    report(
      "invalidFilter",
      `Filters are objects, got ${describeValue(value)}.`,
      path
    );
    return;
  }
  const type = oneOf(DASHBOARD_FILTER_TYPES, value.type);
  const raw = rawId(value.id);
  if (!type) {
    report(
      "invalidFilter",
      `Unknown filter type ${describeValue(value.type)}: dateRange or select; the filter was dropped.`,
      jsonPath(path, "type")
    );
    return;
  }
  const targets: DashboardFilterTarget[] = [];
  const list = Array.isArray(value.targets)
    ? value.targets.slice(0, MAX_FILTER_TARGETS)
    : [];
  for (const [index, item] of list.entries()) {
    const target = targetOf(
      item,
      jsonPath(jsonPath(path, "targets"), index),
      reading.widgetIds,
      report
    );
    if (target) {
      targets.push(target);
    }
  }
  const label =
    (reading.localize
      ? reading.localize(value.label, jsonPath(path, "label"))
      : normalizeFormText(value.label)) ??
    (raw || type);
  const options = optionsOf(value.options);
  return normalizeDashboardFilterValue({
    raw,
    id: raw,
    type,
    label:
      typeof label === "string" ? label.slice(0, reading.titleLength) : label,
    targets,
    ...(options.length ? { options } : {}),
    ...(value.value === undefined
      ? {}
      : { value: value.value as DashboardFilter["value"] }),
  });
}

/** A filter as a builder receives it: targets without a source or column are dropped. */
export function normalizeDashboardFilter(
  value: unknown
): DashboardFilter | undefined {
  const filter = filterOf(value, "", {
    report: silent,
    titleLength: DASHBOARD_LIMITS.title,
  });
  if (!(filter && DASHBOARD_ID_PATTERN.test(filter.raw))) {
    return;
  }
  const { raw: _raw, ...rest } = filter;
  return rest;
}

const FILTER_KEYS = ["id", "type", "label", "targets", "options", "value"];

function collectFilters(
  value: unknown,
  widgetIds: ReadonlyMap<string, string>,
  context: Context
): DashboardFilter[] {
  const parsed: (DashboardFilter & { raw: string; path: string })[] = [];
  const entries = listOf(
    value,
    "filters",
    context,
    "invalidFilter",
    context.limits.filters
  );
  const reading: FilterReading = {
    report: context.issue,
    widgetIds,
    titleLength: context.limits.title,
    localize: (label, path) =>
      localizedText(label, path, context, context.limits.title),
  };
  for (const [index, entry] of entries.entries()) {
    const path = jsonPath("filters", index);
    if (isRecord(entry)) {
      unknownKeys(entry, FILTER_KEYS, path, context, "a filter");
    }
    const filter = filterOf(entry, path, reading);
    if (filter?.raw && parsed.some((other) => other.raw === filter.raw)) {
      context.issue(
        "invalidFilter",
        `Filter "${filter.raw}" appears twice; this one was dropped.`,
        path
      );
    } else if (filter) {
      parsed.push({ ...filter, path });
    }
  }
  const ids = assignIds(parsed, "filter", "Filter", context);
  return parsed.map(({ raw: _raw, path: _path, ...filter }, index) => ({
    ...filter,
    id: ids[index] ?? filter.id,
  }));
}

// Validation ----------------------------------------------------------------------

const DOCUMENT_KEYS: Readonly<Record<number, readonly string[]>> = {
  0: ["version", "id", "name", "layout", "widgets", "filters", "updatedAt"],
  1: ["version", "id", "name", "layout", "widgets", "filters", "updatedAt"],
  2: [
    "version",
    "id",
    "name",
    "description",
    "sections",
    "widgets",
    "filters",
    "updatedAt",
  ],
};

const utf8Length = (value: string): number =>
  new TextEncoder().encode(value).length;

/** The sections a document reads: version 2's, or the one grid of older versions. */
function sectionsOf(
  input: Row,
  context: Context
): (ParsedSection & { id: string })[] {
  if (context.version === 2) {
    return collectSections(input.sections, context);
  }
  // Versions 0 and 1: the layout is the only section, a grid named `main`.
  return [
    {
      raw: "main",
      id: "main",
      path: "",
      type: "grid",
      references: layoutReferences(input.layout, "layout", context),
    },
  ];
}

function documentOf(input: Row, id: string, context: Context): Dashboard {
  unknownKeys(
    input,
    DOCUMENT_KEYS[context.version] ?? [],
    "",
    context,
    `a version ${context.version} dashboard`
  );
  const parsedWidgets = collectWidgets(input.widgets, context);
  const byRaw = new Map<string, DashboardWidget>();
  for (const { raw, widget } of parsedWidgets) {
    if (raw) {
      byRaw.set(raw, widget);
    }
  }
  const placement = placeReferences(sectionsOf(input, context), byRaw, context);
  const dropped = placeRemaining(placement, parsedWidgets, context);
  const widgets = parsedWidgets
    .map((entry) => entry.widget)
    .filter((widget) => !dropped.has(widget.id));
  const finalIds = new Map([...byRaw].map(([raw, widget]) => [raw, widget.id]));
  const filters = collectFilters(input.filters, finalIds, context);
  const name =
    localizedText(input.name, "name", context, context.limits.title) ?? "";
  const description =
    context.version === 2
      ? localizedText(
          input.description,
          "description",
          context,
          context.limits.description
        )
      : undefined;
  const updatedAt = plainText(
    input.updatedAt,
    "updatedAt",
    context,
    TIMESTAMP_LENGTH
  );
  return {
    version: DASHBOARD_VERSION,
    id,
    name,
    ...(description ? { description } : {}),
    sections: placement.sections,
    widgets,
    filters,
    ...(updatedAt ? { updatedAt } : {}),
  };
}

/** A version as written, for messages. */
const versionText = (value: unknown): string =>
  typeof value === "number" || typeof value === "string"
    ? JSON.stringify(value).slice(0, 20)
    : describeValue(value);

function validate(
  input: unknown,
  options: DashboardValidationOptions
): DashboardValidation {
  const refuse = (
    code: DashboardIssueCode,
    message: string
  ): DashboardValidation => ({
    issues: [{ code, message, severity: "error" }],
    ok: false,
  });
  const id = isRecord(input) ? rawId(input.id) : "";
  if (!(isRecord(input) && id)) {
    return refuse(
      "invalidDashboard",
      "Not a dashboard: dashboards are objects with an id."
    );
  }
  if (id.length > MAX_ID_LENGTH) {
    return refuse(
      "invalidDashboard",
      `Dashboard ids are at most ${MAX_ID_LENGTH} characters.`
    );
  }
  const version = input.version === undefined ? 0 : Number(input.version);
  if (
    !Number.isInteger(version) ||
    version < 0 ||
    version > DASHBOARD_VERSION
  ) {
    return refuse(
      "unsupportedVersion",
      `Dashboard version ${versionText(input.version)} is not supported (latest: ${DASHBOARD_VERSION}).`
    );
  }
  const context = createContext(version, options);
  const dashboard = documentOf(input, id, context);
  const size = utf8Length(JSON.stringify(dashboard));
  if (size > context.limits.document) {
    context.issue(
      "tooLarge",
      `The dashboard takes ${size} bytes of JSON; the limit is ${context.limits.document}.`
    );
  }
  return {
    dashboard,
    issues: context.issues,
    ok: !context.issues.some((issue) => issue.severity === "error"),
    ...(version < DASHBOARD_VERSION ? { migratedFrom: version as 0 | 1 } : {}),
  };
}

/**
 * Checks and repairs dashboard JSON of any version, and returns it as version
 * 2. Version 1 becomes one grid section (`main`) holding its layout; version
 * 0 (no `version`) also reads react-grid-layout items (`i`); newer versions
 * are refused (`unsupportedVersion`). Widget types a version does not know
 * are dropped.
 *
 * Each issue has a code, a severity and a JSON path in the input. Errors
 * (`ok: false`) mean something the document asked for was lost: invalid
 * widgets, sections, filters and values, cut lists and texts, oversized
 * documents or block props, props the host's block rejected. Warnings are
 * repairs that keep the meaning: layouts put back inside the grid, orphan and
 * misplaced widgets moved to a section that takes them, ids made valid and
 * unique (references follow), unknown keys removed, inline views preferred
 * to saved ones, unknown blocks (only with `blocks`). Never throws.
 */
export function validateDashboard(
  input: unknown,
  options: DashboardValidationOptions = {}
): DashboardValidation {
  try {
    return validate(input, options);
  } catch (error) {
    // Unreadable input (throwing getters, proxies) is refused, not thrown.
    return {
      issues: [
        {
          code: "invalidDashboard",
          message: `The dashboard could not be read: ${error instanceof Error ? error.message : String(error)}`,
          severity: "error",
        },
      ],
      ok: false,
    };
  }
}

/**
 * Lenient reading: the repaired version 2 document, whatever its issues.
 * Throws only when the input is not a dashboard or comes from a newer version.
 */
export function normalizeDashboard(
  input: unknown,
  options: DashboardValidationOptions = {}
): Dashboard {
  const { dashboard, issues } = validateDashboard(input, options);
  if (!dashboard) {
    throw new Error(issues.at(0)?.message ?? "Not a dashboard.");
  }
  return dashboard;
}

// References ------------------------------------------------------------------------

export interface DashboardReferenceOptions {
  /** What the host offers this user, by source id. */
  sources: Readonly<Record<string, DashboardSourceSummary>>;
  /** The host's blocks. */
  blocks?: DashboardBlocks;
}

export interface DashboardReferences {
  issues: DashboardIssue[];
  /** No errors: every source, view and column named exists. */
  ok: boolean;
}

const COLUMN_SETTING = /Column$/;
const COLUMN_LIST_SETTING = /(?:^c|C)olumns$|ColumnIds$/;

interface ColumnReference {
  columnId: string;
  path: string;
}

function listReferences(value: unknown, path: string): ColumnReference[] {
  return Array.isArray(value)
    ? value.flatMap((columnId, index) =>
        typeof columnId === "string"
          ? [{ columnId, path: jsonPath(path, index) }]
          : []
      )
    : [];
}

/** Columns a mode's settings name: `*Column` texts and `*Columns` / `*ColumnIds` lists. */
function modeReferences(settings: unknown, path: string): ColumnReference[] {
  if (!isRecord(settings)) {
    return [];
  }
  return Object.entries(settings).flatMap(([key, value]) => {
    if (COLUMN_SETTING.test(key) && typeof value === "string" && value) {
      return [{ columnId: value, path: jsonPath(path, key) }];
    }
    return COLUMN_LIST_SETTING.test(key)
      ? listReferences(value, jsonPath(path, key))
      : [];
  });
}

/** Every column an inline view names: sorts, filters, visibility, order, widths, pinning, grouping and mode settings. */
function viewReferences(
  view: DashboardInlineView,
  path: string
): ColumnReference[] {
  const at = (key: string) => jsonPath(path, key);
  const keyed = (record: Record<string, unknown> | undefined, key: string) =>
    Object.keys(record ?? {}).map((columnId) => ({
      columnId,
      path: jsonPath(at(key), columnId),
    }));
  return [
    ...(view.sorting ?? []).map((sort, index) => ({
      columnId: sort.id,
      path: jsonPath(jsonPath(at("sorting"), index), "id"),
    })),
    ...(view.columnFilters ?? []).map((filter, index) => ({
      columnId: filter.id,
      path: jsonPath(jsonPath(at("columnFilters"), index), "id"),
    })),
    ...(view.advancedFilters ?? []).map((rule, index) => ({
      columnId: rule.columnId,
      path: jsonPath(jsonPath(at("advancedFilters"), index), "columnId"),
    })),
    ...keyed(view.columnVisibility, "columnVisibility"),
    ...keyed(view.columnSizing, "columnSizing"),
    ...listReferences(view.columnOrder, at("columnOrder")),
    ...listReferences(view.grouping, at("grouping")),
    ...listReferences(
      view.columnPinning?.left,
      jsonPath(at("columnPinning"), "left")
    ),
    ...listReferences(
      view.columnPinning?.right,
      jsonPath(at("columnPinning"), "right")
    ),
    ...Object.keys(VIEW_MODE_SETTING_KEYS).flatMap((mode) =>
      modeReferences(Reflect.get(view, mode), at(mode))
    ),
  ];
}

function widgetReferences(
  widget: DashboardWidget,
  path: string
): ColumnReference[] {
  const references = widget.view
    ? viewReferences(widget.view, jsonPath(path, "view"))
    : [];
  if (widget.type === "kpi") {
    for (const key of ["metricColumn", "dateColumn"]) {
      const columnId = widget.settings[key];
      if (typeof columnId === "string" && columnId) {
        references.push({
          columnId,
          path: jsonPath(jsonPath(path, "settings"), key),
        });
      }
    }
  }
  return references;
}

function checkColumns(
  summary: DashboardSourceSummary,
  references: readonly ColumnReference[],
  report: Report
) {
  if (!summary.columns) {
    return;
  }
  const known = new Set(summary.columns.map((column) => column.id));
  for (const { columnId, path } of references) {
    if (!known.has(columnId)) {
      report(
        "unknownColumn",
        `Source "${summary.id}" has no column "${columnId}".`,
        path
      );
    }
  }
}

/** The source a widget or filter names, when it exists and is available to this user. */
function availableSource(
  tableId: string,
  path: string,
  sources: DashboardReferenceOptions["sources"],
  report: Report
): DashboardSourceSummary | undefined {
  const summary = Object.hasOwn(sources, tableId)
    ? sources[tableId]
    : undefined;
  if (!summary) {
    report("unknownSource", `No source "${tableId}".`, path);
    return;
  }
  if (summary.available === false) {
    report(
      "unavailableSource",
      `Source "${tableId}" is not available (${summary.unavailableReason ?? "error"})${summary.unavailableMessage ? `: ${summary.unavailableMessage}` : ""}; its widgets show as unavailable.`,
      path
    );
    return;
  }
  return summary;
}

function checkWidget(
  widget: DashboardWidget,
  path: string,
  options: DashboardReferenceOptions,
  report: Report
) {
  if (widget.type === "block") {
    if (
      options.blocks &&
      widget.block &&
      !Object.hasOwn(options.blocks, widget.block)
    ) {
      report(
        "unknownBlock",
        `This host has no "${widget.block}" block.`,
        jsonPath(path, "block")
      );
    }
    return;
  }
  if (!widget.tableId) {
    return;
  }
  const summary = availableSource(
    widget.tableId,
    jsonPath(path, "tableId"),
    options.sources,
    report
  );
  if (!summary) {
    return;
  }
  if (
    widget.viewId &&
    summary.views &&
    !summary.views.some((view) => view.id === widget.viewId)
  ) {
    report(
      "unknownView",
      `Source "${summary.id}" has no view "${widget.viewId}".`,
      jsonPath(path, "viewId")
    );
  }
  const mode = widget.view?.displayMode;
  if (
    mode &&
    widget.type !== "kpi" &&
    summary.displayModes &&
    !summary.displayModes.includes(mode)
  ) {
    report(
      "unsupportedDisplayMode",
      `Source "${summary.id}" cannot show "${mode}"; it offers ${summary.displayModes.join(", ")}.`,
      jsonPath(jsonPath(path, "view"), "displayMode")
    );
  }
  checkColumns(summary, widgetReferences(widget, path), report);
}

/**
 * Checks what a (validated) document names against what the host offers:
 * sources (`unknownSource`, or `unavailableSource` when listed but
 * unavailable), saved views (`unknownView`), columns of sorts, filters,
 * visibility, KPI metrics and dates, display mode settings (`*Column`,
 * `*Columns`, `*ColumnIds`) and filter targets (`unknownColumn`), display
 * modes (`unsupportedDisplayMode`) and blocks (`unknownBlock`). Paths point
 * into the validated document. Details a summary leaves out (its `views`,
 * `columns` or `displayModes`) are not checked.
 */
export function checkDashboardReferences(
  dashboard: Dashboard,
  options: DashboardReferenceOptions
): DashboardReferences {
  const context = createContext(DASHBOARD_VERSION, {});
  const report: Report = context.issue;
  for (const [index, widget] of dashboard.widgets.entries()) {
    checkWidget(widget, jsonPath("widgets", index), options, report);
  }
  for (const [index, filter] of dashboard.filters.entries()) {
    for (const [targetIndex, target] of filter.targets.entries()) {
      const path = jsonPath(
        jsonPath(jsonPath("filters", index), "targets"),
        targetIndex
      );
      const summary = availableSource(
        target.tableId,
        jsonPath(path, "tableId"),
        options.sources,
        report
      );
      if (summary) {
        checkColumns(
          summary,
          [{ columnId: target.columnId, path: jsonPath(path, "columnId") }],
          report
        );
      }
    }
  }
  return {
    issues: context.issues,
    ok: !context.issues.some((issue) => issue.severity === "error"),
  };
}

// JSON Schema -------------------------------------------------------------------------

export interface DashboardJsonSchemaOptions {
  /** Source ids widgets and filters may name; any text without them. */
  sourceIds?: readonly string[];
  /** The host's blocks: each becomes a widget variant with its `propsSchema`. */
  blocks?: DashboardBlocks;
  limits?: Partial<DashboardLimits>;
}

type Schema = Record<string, unknown>;

const LOCALE_KEY = "^[A-Za-z]{2,3}(?:[-_][A-Za-z\\d]{2,8})*$";

const localizedSchema = (maxLength: number, description: string): Schema => ({
  description: `${description} A text, or one per language: { "en": "Sales", "fr": "Ventes" }.`,
  anyOf: [
    { type: "string", maxLength },
    {
      type: "object",
      propertyNames: { pattern: LOCALE_KEY },
      additionalProperties: { type: "string", minLength: 1, maxLength },
      minProperties: 1,
    },
  ],
});

const idSchema = (description: string): Schema => ({
  type: "string",
  pattern: DASHBOARD_ID_PATTERN.source,
  description,
});

const stringList = (maxItems: number): Schema => ({
  type: "array",
  maxItems,
  items: { type: "string", minLength: 1 },
});

function viewSchema(rules: number): Schema {
  const columns = VIEW_CONFIG_LIMITS.columns;
  const modes = Object.fromEntries(
    Object.entries(VIEW_MODE_SETTING_KEYS).map(([mode, keys]) => [
      mode,
      {
        type: "object",
        description: `Settings of the ${mode} display mode.`,
        propertyNames: { enum: [...keys] },
      },
    ])
  );
  return {
    type: "object",
    additionalProperties: false,
    description:
      "Inline view settings, as a saved view's config: display mode and its settings, filters, sorts, columns.",
    properties: {
      displayMode: { enum: [...DISPLAY_MODE_IDS] },
      density: { enum: TABLE_DENSITY_OPTIONS.map((option) => option.value) },
      footerCalculationsVisible: { type: "boolean" },
      globalSearch: { type: "string", maxLength: VIEW_CONFIG_LIMITS.text },
      pageSize: {
        type: "integer",
        minimum: 1,
        maximum: VIEW_CONFIG_LIMITS.pageSize,
      },
      sorting: {
        type: "array",
        maxItems: rules,
        items: {
          type: "object",
          required: ["id"],
          additionalProperties: false,
          properties: { id: { type: "string" }, desc: { type: "boolean" } },
        },
      },
      columnFilters: {
        type: "array",
        maxItems: rules,
        items: {
          type: "object",
          required: ["id", "value"],
          additionalProperties: false,
          properties: { id: { type: "string" }, value: {} },
        },
      },
      advancedFilters: {
        type: "array",
        maxItems: rules,
        description:
          'Filter rules, all matched (AND) unless every rule says joinOperator: "or".',
        items: {
          type: "object",
          required: ["columnId", "operator"],
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            columnId: { type: "string" },
            operator: { enum: [...VIEW_FILTER_OPERATORS] },
            type: { type: "string" },
            values: {},
            isActive: { type: "boolean" },
            joinOperator: { enum: ["and", "or"] },
            label: { type: "string" },
            createdAt: { type: "string" },
            updatedAt: { type: "string" },
          },
        },
      },
      columnOrder: stringList(columns),
      grouping: stringList(columns),
      columnVisibility: {
        type: "object",
        additionalProperties: { type: "boolean" },
      },
      columnSizing: {
        type: "object",
        additionalProperties: { type: "number", exclusiveMinimum: 0 },
      },
      columnPinning: {
        type: "object",
        additionalProperties: false,
        properties: { left: stringList(columns), right: stringList(columns) },
      },
      ...modes,
    },
  };
}

/** `The "media.storage" block (grid sections): Storage. Space used by media.` */
function blockDescription(key: string, block: DashboardBlockSchema): string {
  const where =
    block.placement && block.placement !== "any"
      ? ` (${block.placement} sections)`
      : "";
  const about = [
    dashboardText(block.label, "en"),
    dashboardText(block.description, "en"),
  ]
    .filter(Boolean)
    .join(". ");
  return `The "${key}" block${where}${about ? `: ${about}` : ""}.`;
}

function widgetSchemas(
  options: DashboardJsonSchemaOptions,
  limits: DashboardLimits
): Schema[] {
  const source: Schema = options.sourceIds?.length
    ? {
        enum: [...options.sourceIds],
        description: "The source (table) the widget reads.",
      }
    : {
        type: "string",
        minLength: 1,
        maxLength: MAX_ID_LENGTH,
        description: "The source (table) the widget reads.",
      };
  const common = {
    id: idSchema("Unique widget id, referenced by sections and filters."),
    title: localizedSchema(
      limits.title,
      "Title shown instead of the view's or source's name."
    ),
  };
  const sourced = (
    type: "view" | "kpi" | "table",
    settings: Schema,
    description: string
  ): Schema => ({
    type: "object",
    description,
    required: ["id", "type", "tableId"],
    additionalProperties: false,
    properties: {
      ...common,
      type: { const: type },
      tableId: source,
      viewId: {
        type: "string",
        description:
          "A saved view of the source; use `view` instead for inline settings.",
      },
      view: viewSchema(limits.viewRules),
      settings,
    },
  });
  const optionsOrTrue = (properties: Schema): Schema => ({
    anyOf: [
      { type: "boolean" },
      { type: "object", additionalProperties: false, properties },
    ],
  });
  const blocks = Object.entries(options.blocks ?? {});
  const blockVariants: Schema[] = blocks.length
    ? blocks.map(([key, block]) => ({
        type: "object",
        description: blockDescription(key, block),
        required: ["id", "type", "block"],
        additionalProperties: false,
        properties: {
          ...common,
          type: { const: "block" },
          block: { const: key },
          props: block.propsSchema ?? { type: "object" },
          settings: { type: "object", maxProperties: 0 },
        },
      }))
    : [
        {
          type: "object",
          description: "A block of the host, by key.",
          required: ["id", "type", "block"],
          additionalProperties: false,
          properties: {
            ...common,
            type: { const: "block" },
            block: { type: "string", pattern: DASHBOARD_BLOCK_PATTERN.source },
            props: { type: "object" },
            settings: { type: "object", maxProperties: 0 },
          },
        },
      ];
  return [
    sourced(
      "view",
      {
        type: "object",
        additionalProperties: false,
        properties: { overflow: { enum: [...DASHBOARD_OVERFLOWS] } },
      },
      "A view of a source in its display mode."
    ),
    sourced(
      "kpi",
      {
        type: "object",
        additionalProperties: false,
        properties: {
          metric: { enum: [...DASHBOARD_KPI_METRICS] },
          metricColumn: {
            type: "string",
            description: "Number column; required unless metric is count.",
          },
          label: { type: "string", maxLength: limits.title },
          dateColumn: {
            type: "string",
            description: "Date column; required by compare and sparkline.",
          },
          compare: optionsOrTrue({
            period: { const: "previous" },
            days: {
              type: "integer",
              minimum: 1,
              maximum: DASHBOARD_KPI_DEFAULTS.maxCompareDays,
            },
            better: { enum: ["up", "down"] },
          }),
          sparkline: optionsOrTrue({
            bucket: { enum: [...DASHBOARD_SPARKLINE_BUCKETS] },
            buckets: {
              type: "integer",
              minimum: DASHBOARD_KPI_DEFAULTS.minSparklineBuckets,
              maximum: DASHBOARD_KPI_DEFAULTS.maxSparklineBuckets,
            },
          }),
        },
      },
      "One number over the records of a view."
    ),
    {
      type: "object",
      description: "Text, rendered as the host's markdown.",
      required: ["id", "type"],
      additionalProperties: false,
      properties: {
        ...common,
        type: { const: "note" },
        settings: {
          type: "object",
          additionalProperties: false,
          properties: { text: { type: "string", maxLength: limits.note } },
        },
      },
    },
    sourced(
      "table",
      { type: "object", maxProperties: 0 },
      "The source as a full-page table (flow sections only)."
    ),
    ...blockVariants,
  ];
}

function sectionSchemas(limits: DashboardLimits): Schema[] {
  const common = {
    id: idSchema("Unique section id."),
    title: localizedSchema(limits.title, "Section heading."),
  };
  return [
    {
      type: "object",
      description: "Cards on a 4-column grid.",
      required: ["id", "type", "layout"],
      additionalProperties: false,
      properties: {
        ...common,
        type: { const: "grid" },
        layout: {
          type: "array",
          maxItems: limits.widgets,
          items: {
            type: "object",
            required: ["widgetId", "x", "y", "w", "h"],
            additionalProperties: false,
            properties: {
              widgetId: { type: "string" },
              x: {
                type: "integer",
                minimum: 0,
                maximum: DASHBOARD_COLUMNS - 1,
              },
              y: { type: "integer", minimum: 0 },
              w: { type: "integer", minimum: 1, maximum: DASHBOARD_COLUMNS },
              h: { type: "integer", minimum: 1, maximum: DASHBOARD_MAX_HEIGHT },
            },
          },
        },
      },
    },
    {
      type: "object",
      description:
        "Widgets stacked at full width and natural height; the only place for table widgets.",
      required: ["id", "type", "widgetIds"],
      additionalProperties: false,
      properties: {
        ...common,
        type: { const: "flow" },
        widgetIds: {
          type: "array",
          maxItems: limits.widgets,
          items: { type: "string" },
        },
      },
    },
  ];
}

function filterSchema(
  options: DashboardJsonSchemaOptions,
  limits: DashboardLimits
): Schema {
  return {
    type: "object",
    required: ["id", "type", "label", "targets"],
    additionalProperties: false,
    properties: {
      id: idSchema("Unique filter id."),
      type: { enum: [...DASHBOARD_FILTER_TYPES] },
      label: localizedSchema(limits.title, "Filter name."),
      targets: {
        type: "array",
        maxItems: MAX_FILTER_TARGETS,
        items: {
          type: "object",
          required: ["tableId", "columnId"],
          additionalProperties: false,
          properties: {
            tableId: options.sourceIds?.length
              ? { enum: [...options.sourceIds] }
              : { type: "string" },
            columnId: { type: "string" },
            widgetIds: {
              type: "array",
              items: { type: "string" },
              description:
                "Only these widgets; every widget of the source without it.",
            },
          },
        },
      },
      options: {
        type: "array",
        maxItems: MAX_FILTER_OPTIONS,
        items: {
          type: "object",
          required: ["value", "label"],
          additionalProperties: false,
          properties: { value: { type: "string" }, label: { type: "string" } },
        },
      },
      value: {
        description:
          "The default value: days or a relative preset for a date range (readers pick their own, kept in the URL), options for a select.",
        anyOf: [
          {
            type: "object",
            additionalProperties: false,
            properties: {
              start: { type: "string", format: "date" },
              end: { type: "string", format: "date" },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["preset"],
            properties: {
              preset: {
                enum: [...DASHBOARD_DATE_PRESETS],
                description:
                  "Resolved when the widgets query, in the reader's time zone: the last 7, 30 or 90 days, this month, last month, this year.",
              },
            },
          },
          { type: "array", items: { type: "string" } },
        ],
      },
    },
  };
}

/**
 * The JSON Schema of a version 2 document, for AI tool inputs (MCP). With
 * `sourceIds`, widgets and filters name only those sources; with `blocks`,
 * each block is a widget variant carrying its `propsSchema`. Its enums are
 * this module's constants.
 */
export function dashboardJsonSchema(
  options: DashboardJsonSchemaOptions = {}
): Schema {
  const limits = resolveLimits(options.limits);
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "YaYaw dashboard",
    description:
      "A dashboard or screen: sections (grid cards or full-width flows) placing widgets (views, numbers, notes, full-page tables, host blocks), and filters joined to the widgets' queries.",
    type: "object",
    required: ["version", "id", "name", "sections", "widgets", "filters"],
    additionalProperties: false,
    properties: {
      version: { const: DASHBOARD_VERSION },
      id: { type: "string", minLength: 1, maxLength: MAX_ID_LENGTH },
      name: localizedSchema(limits.title, "Dashboard name."),
      description: localizedSchema(
        limits.description,
        "What the dashboard is for."
      ),
      sections: {
        type: "array",
        maxItems: limits.sections,
        items: { oneOf: sectionSchemas(limits) },
      },
      widgets: {
        type: "array",
        maxItems: limits.widgets,
        items: { oneOf: widgetSchemas(options, limits) },
      },
      filters: {
        type: "array",
        maxItems: limits.filters,
        items: filterSchema(options, limits),
      },
      updatedAt: { type: "string", maxLength: TIMESTAMP_LENGTH },
    },
  };
}

// Fingerprint ---------------------------------------------------------------------

/** JSON with object keys sorted and `undefined` left out, at any depth. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? "null" : canonicalJson(item))).join(",")}]`;
  }
  if (isRecord(value)) {
    const entries = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort((a, b) => (a < b ? -1 : 1))
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * The document as canonical JSON: normalized to version 2, keys sorted, no
 * whitespace, without `updatedAt`. Equal documents give equal texts,
 * whatever their version, key order or save time.
 */
export function canonicalDashboardJson(input: unknown): string {
  const { updatedAt: _updatedAt, ...dashboard } = normalizeDashboard(input);
  return canonicalJson(dashboard);
}

// biome-ignore-start lint/suspicious/noBitwiseOperators: SHA-256 is defined on 32-bit words.
const SHA256_K = [
  0x42_8a_2f_98, 0x71_37_44_91, 0xb5_c0_fb_cf, 0xe9_b5_db_a5, 0x39_56_c2_5b,
  0x59_f1_11_f1, 0x92_3f_82_a4, 0xab_1c_5e_d5, 0xd8_07_aa_98, 0x12_83_5b_01,
  0x24_31_85_be, 0x55_0c_7d_c3, 0x72_be_5d_74, 0x80_de_b1_fe, 0x9b_dc_06_a7,
  0xc1_9b_f1_74, 0xe4_9b_69_c1, 0xef_be_47_86, 0x0f_c1_9d_c6, 0x24_0c_a1_cc,
  0x2d_e9_2c_6f, 0x4a_74_84_aa, 0x5c_b0_a9_dc, 0x76_f9_88_da, 0x98_3e_51_52,
  0xa8_31_c6_6d, 0xb0_03_27_c8, 0xbf_59_7f_c7, 0xc6_e0_0b_f3, 0xd5_a7_91_47,
  0x06_ca_63_51, 0x14_29_29_67, 0x27_b7_0a_85, 0x2e_1b_21_38, 0x4d_2c_6d_fc,
  0x53_38_0d_13, 0x65_0a_73_54, 0x76_6a_0a_bb, 0x81_c2_c9_2e, 0x92_72_2c_85,
  0xa2_bf_e8_a1, 0xa8_1a_66_4b, 0xc2_4b_8b_70, 0xc7_6c_51_a3, 0xd1_92_e8_19,
  0xd6_99_06_24, 0xf4_0e_35_85, 0x10_6a_a0_70, 0x19_a4_c1_16, 0x1e_37_6c_08,
  0x27_48_77_4c, 0x34_b0_bc_b5, 0x39_1c_0c_b3, 0x4e_d8_aa_4a, 0x5b_9c_ca_4f,
  0x68_2e_6f_f3, 0x74_8f_82_ee, 0x78_a5_63_6f, 0x84_c8_78_14, 0x8c_c7_02_08,
  0x90_be_ff_fa, 0xa4_50_6c_eb, 0xbe_f9_a3_f7, 0xc6_71_78_f2,
] as const;

type Sha256State = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

const SHA256_START: Readonly<Sha256State> = [
  0x6a_09_e6_67, 0xbb_67_ae_85, 0x3c_6e_f3_72, 0xa5_4f_f5_3a, 0x51_0e_52_7f,
  0x9b_05_68_8c, 0x1f_83_d9_ab, 0x5b_e0_cd_19,
];

const rotate = (value: number, bits: number): number =>
  (value >>> bits) | (value << (32 - bits));

/** The message schedule of one 64-byte block. */
function sha256Schedule(view: DataView, offset: number): number[] {
  const words: number[] = [];
  for (let index = 0; index < 16; index += 1) {
    words.push(view.getUint32(offset + index * 4));
  }
  for (let index = 16; index < 64; index += 1) {
    const early = words[index - 15] ?? 0;
    const late = words[index - 2] ?? 0;
    const s0 = rotate(early, 7) ^ rotate(early, 18) ^ (early >>> 3);
    const s1 = rotate(late, 17) ^ rotate(late, 19) ^ (late >>> 10);
    words.push(
      ((words[index - 16] ?? 0) + s0 + (words[index - 7] ?? 0) + s1) >>> 0
    );
  }
  return words;
}

function sha256Block(
  state: Sha256State,
  words: readonly number[]
): Sha256State {
  let [a, b, c, d, e, f, g, h] = state;
  for (let index = 0; index < 64; index += 1) {
    const s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
    const choice = (e & f) ^ (~e & g);
    const t1 =
      (h + s1 + choice + (SHA256_K[index] ?? 0) + (words[index] ?? 0)) >>> 0;
    const s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
    const majority = (a & b) ^ (a & c) ^ (b & c);
    h = g;
    g = f;
    f = e;
    e = (d + t1) >>> 0;
    d = c;
    c = b;
    b = a;
    a = (t1 + s0 + majority) >>> 0;
  }
  return [
    (state[0] + a) >>> 0,
    (state[1] + b) >>> 0,
    (state[2] + c) >>> 0,
    (state[3] + d) >>> 0,
    (state[4] + e) >>> 0,
    (state[5] + f) >>> 0,
    (state[6] + g) >>> 0,
    (state[7] + h) >>> 0,
  ];
}

/** SHA-256 of a text's UTF-8 bytes, as 64 hexadecimal digits. */
export function sha256Hex(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const blocks = Math.ceil((bytes.length + 9) / 64);
  const data = new Uint8Array(blocks * 64);
  data.set(bytes);
  data[bytes.length] = 0x80;
  const view = new DataView(data.buffer);
  const bits = bytes.length * 8;
  view.setUint32(data.length - 8, Math.floor(bits / 0x1_00_00_00_00));
  view.setUint32(data.length - 4, bits >>> 0);
  let state: Sha256State = [...SHA256_START];
  for (let offset = 0; offset < data.length; offset += 64) {
    state = sha256Block(state, sha256Schedule(view, offset));
  }
  return state.map((word) => word.toString(16).padStart(8, "0")).join("");
}
// biome-ignore-end lint/suspicious/noBitwiseOperators: SHA-256 is defined on 32-bit words.

/**
 * SHA-256 (hex) of `canonicalDashboardJson`: a stable fingerprint, the same in
 * browsers and on servers, to tell whether a document (a screen's default,
 * say) changed. Synchronous and dependency-free.
 */
export const dashboardFingerprint = (input: unknown): string =>
  sha256Hex(canonicalDashboardJson(input));

// Builders --------------------------------------------------------------------------

/** An empty dashboard: one grid section, `main`. */
export const createDashboard = (
  id: string,
  name: DashboardText
): Dashboard => ({
  version: DASHBOARD_VERSION,
  id,
  name,
  sections: [{ id: "main", type: "grid", layout: [] }],
  widgets: [],
  filters: [],
});

/** A widget id not used yet. */
export function nextWidgetId(widgets: readonly { id: string }[]): string {
  const ids = new Set(widgets.map((widget) => widget.id));
  let index = widgets.length + 1;
  while (ids.has(`widget-${index}`)) {
    index += 1;
  }
  return `widget-${index}`;
}

/** Widget ids in display order: sections in order, each grid in reading order. */
export const dashboardWidgetOrder = (
  dashboard: Pick<Dashboard, "sections">
): string[] =>
  dashboard.sections.flatMap((section) =>
    section.type === "grid"
      ? [...section.layout]
          .sort((a, b) => a.y - b.y || a.x - b.x)
          .map((item) => item.widgetId)
      : section.widgetIds
  );

/** The section holding a widget. */
export const dashboardWidgetSection = (
  dashboard: Pick<Dashboard, "sections">,
  widgetId: string
): DashboardSection | undefined =>
  dashboard.sections.find((section) =>
    section.type === "grid"
      ? section.layout.some((item) => item.widgetId === widgetId)
      : section.widgetIds.includes(widgetId)
  );

export interface DashboardSectionDraft {
  type: DashboardSectionType;
  /** Kept when valid and free; `section-N` otherwise. */
  id?: string;
  title?: DashboardText;
}

/** Adds an empty section at `index` (the end by default). */
export function addDashboardSection(
  dashboard: Dashboard,
  section: DashboardSectionDraft,
  index = dashboard.sections.length
): Dashboard {
  const free =
    section.id &&
    DASHBOARD_ID_PATTERN.test(section.id) &&
    !dashboard.sections.some((item) => item.id === section.id);
  const id =
    free && section.id ? section.id : nextSectionId(dashboard.sections);
  const sections = [...dashboard.sections];
  sections.splice(index, 0, emptySection(section.type, id, section.title));
  return { ...dashboard, sections };
}

/** Where `addDashboardWidget` and `moveWidgetToSection` put a widget. */
export interface DashboardWidgetPlacement {
  /**
   * The section; by default the first one that takes the widget (a grid for
   * cards, a flow for tables), created when there is none.
   */
  sectionId?: string;
  /** Grid sections: the size, by default the widget type's (`defaultWidgetSize`). */
  size?: { w: number; h: number };
  /** Flow sections: the position among its widgets, the end by default. */
  index?: number;
  /** The host's blocks: a block goes only where its `placement` allows. */
  blocks?: DashboardBlocks;
}

const isSize = (value: unknown): value is { w: number; h: number } =>
  isRecord(value) && typeof value.w === "number" && typeof value.h === "number";

/** The dashboard with the widget placed in the section the placement asks for (or the first that takes it). */
function placeWidget(
  dashboard: Dashboard,
  widget: DashboardWidget,
  placement: DashboardWidgetPlacement
): Dashboard {
  const accepted = dashboardAcceptedSections(widget, placement.blocks);
  let sections = dashboard.sections;
  let target =
    sections.find(
      (section) =>
        section.id === placement.sectionId && accepted.includes(section.type)
    ) ?? sections.find((section) => accepted.includes(section.type));
  if (!target) {
    const type = accepted[0] ?? "grid";
    target = emptySection(
      type,
      nextSectionId(sections, type === "grid" ? "main" : undefined)
    );
    sections = [...sections, target];
  }
  const targetId = target.id;
  return {
    ...dashboard,
    sections: sections.map((section) =>
      section.id === targetId ? withWidget(section, widget, placement) : section
    ),
  };
}

/**
 * Adds a widget: in a grid section at the first free spot (at `size`, by
 * default its type's), in a flow section at `index` (the end). A table widget
 * goes to a flow section. The third argument may also be a size alone.
 */
export function addDashboardWidget(
  dashboard: Dashboard,
  widget: Omit<DashboardWidget, "id"> & { id?: string },
  placement: DashboardWidgetPlacement | { w: number; h: number } = {}
): Dashboard {
  const taken = dashboard.widgets.some((item) => item.id === widget.id);
  const id = widget.id && !taken ? widget.id : nextWidgetId(dashboard.widgets);
  const added: DashboardWidget = {
    ...widget,
    id,
    settings: widget.settings ?? {},
  };
  return placeWidget(
    { ...dashboard, widgets: [...dashboard.widgets, added] },
    added,
    isSize(placement) ? { size: placement } : placement
  );
}

/** The sections without this widget; grids close the gap. */
const sectionsWithout = (
  sections: readonly DashboardSection[],
  widgetId: string
): DashboardSection[] =>
  sections.map((section) => {
    if (section.type === "flow") {
      return section.widgetIds.includes(widgetId)
        ? {
            ...section,
            widgetIds: section.widgetIds.filter((id) => id !== widgetId),
          }
        : section;
    }
    return section.layout.some((item) => item.widgetId === widgetId)
      ? {
          ...section,
          layout: compactLayout(
            section.layout.filter((item) => item.widgetId !== widgetId)
          ),
        }
      : section;
  });

/** Removes a widget, its place and its mentions in filter targets. */
export function removeDashboardWidget(
  dashboard: Dashboard,
  widgetId: string
): Dashboard {
  return {
    ...dashboard,
    widgets: dashboard.widgets.filter((widget) => widget.id !== widgetId),
    sections: sectionsWithout(dashboard.sections, widgetId),
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

/**
 * Moves a widget to another section (or, in a flow, to another `index`).
 * From a grid it keeps its size unless `size` is given. Unchanged when the
 * section does not exist or cannot hold the widget.
 */
export function moveWidgetToSection(
  dashboard: Dashboard,
  widgetId: string,
  sectionId: string,
  placement: Omit<DashboardWidgetPlacement, "sectionId"> = {}
): Dashboard {
  const widget = dashboard.widgets.find((item) => item.id === widgetId);
  const target = dashboard.sections.find((section) => section.id === sectionId);
  const accepted = widget
    ? dashboardAcceptedSections(widget, placement.blocks)
    : [];
  if (!(widget && target && accepted.includes(target.type))) {
    return dashboard;
  }
  const from = dashboardWidgetSection(dashboard, widgetId);
  if (
    from?.id === sectionId &&
    (from.type === "grid" || placement.index === undefined)
  ) {
    return dashboard;
  }
  const place =
    from?.type === "grid"
      ? from.layout.find((item) => item.widgetId === widgetId)
      : undefined;
  return placeWidget(
    { ...dashboard, sections: sectionsWithout(dashboard.sections, widgetId) },
    widget,
    {
      ...placement,
      sectionId,
      size: placement.size ?? (place ? { w: place.w, h: place.h } : undefined),
    }
  );
}

/** Whether the widget can move that way: around its grid, or up and down its flow. */
export function canMoveDashboardWidget(
  dashboard: Pick<Dashboard, "sections">,
  widgetId: string,
  direction: DashboardDirection
): boolean {
  const section = dashboardWidgetSection(dashboard, widgetId);
  if (section?.type === "grid") {
    return canMoveLayoutItem(section.layout, widgetId, direction);
  }
  const index = section ? section.widgetIds.indexOf(widgetId) : -1;
  if (!section || index < 0) {
    return false;
  }
  if (direction === "up") {
    return index > 0;
  }
  return direction === "down" && index < section.widgetIds.length - 1;
}

/** Keyboard moves: in a grid like a drag, in a flow one place up or down. */
export function moveDashboardWidget(
  dashboard: Dashboard,
  widgetId: string,
  direction: DashboardDirection
): Dashboard {
  const section = dashboardWidgetSection(dashboard, widgetId);
  if (!(section && canMoveDashboardWidget(dashboard, widgetId, direction))) {
    return dashboard;
  }
  let moved: DashboardSection;
  if (section.type === "grid") {
    moved = {
      ...section,
      layout: moveLayoutItem(section.layout, widgetId, direction),
    };
  } else {
    const widgetIds = [...section.widgetIds];
    const index = widgetIds.indexOf(widgetId);
    const other = index + (direction === "up" ? -1 : 1);
    widgetIds[index] = widgetIds[other] ?? widgetId;
    widgetIds[other] = widgetId;
    moved = { ...section, widgetIds };
  }
  return {
    ...dashboard,
    sections: dashboard.sections.map((item) =>
      item.id === section.id ? moved : item
    ),
  };
}

/** Whether the widget can grow or shrink that way (grid sections only). */
export function canResizeDashboardWidget(
  dashboard: Pick<Dashboard, "sections">,
  widgetId: string,
  change: DashboardResize
): boolean {
  const section = dashboardWidgetSection(dashboard, widgetId);
  return (
    section?.type === "grid" &&
    canResizeLayoutItem(section.layout, widgetId, change)
  );
}

/** Keyboard resizing in a grid section; flow widgets keep their natural size. */
export function resizeDashboardWidget(
  dashboard: Dashboard,
  widgetId: string,
  change: DashboardResize
): Dashboard {
  const section = dashboardWidgetSection(dashboard, widgetId);
  if (
    !(
      section?.type === "grid" &&
      canResizeLayoutItem(section.layout, widgetId, change)
    )
  ) {
    return dashboard;
  }
  const resized = {
    ...section,
    layout: resizeLayoutItem(section.layout, widgetId, change),
  };
  return {
    ...dashboard,
    sections: dashboard.sections.map((item) =>
      item.id === section.id ? resized : item
    ),
  };
}

/** Positions a grid section's gridstack reported; an unchanged layout keeps the same dashboard. */
export function applyDashboardSectionLayout(
  dashboard: Dashboard,
  sectionId: string,
  items: readonly DashboardLayoutItem[]
): Dashboard {
  const section = dashboard.sections.find((item) => item.id === sectionId);
  if (section?.type !== "grid") {
    return dashboard;
  }
  const applied = applyGridLayout(section, items);
  return applied === section
    ? dashboard
    : {
        ...dashboard,
        sections: dashboard.sections.map((item) =>
          item.id === sectionId ? applied : item
        ),
      };
}
