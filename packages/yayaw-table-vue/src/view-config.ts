/**
 * Saved-view settings (a saved view's `config`, without its identity) as a
 * dashboard embeds them (`widget.view`) and as hosts receive them from
 * browsers or AI tools. `sanitizeViewConfig` is strict and server-safe:
 * unknown keys are stripped, sizes capped, every value type-checked before a
 * display mode's normalizer reads it, and hostile JSON never throws. Pure and
 * shared by the React and Vue editions (synced to Vue).
 */
// biome-ignore-all assist/source/organizeImports: the React copy reads the planning engine from its parent folder, the Vue copy from beside it; both keep this order.
import { normalizeGanttView } from "./planning/engine";
import type { TableGanttViewConfig } from "./planning/types";
import {
  GENERIC_MODE_CONFIG_KEYS,
  type GenericModeViewConfigs,
  isTableDisplayMode,
  normalizeModeConfig,
  type TableDisplayMode,
} from "./display-modes";
import {
  type GalleryViewState,
  normalizeGalleryViewConfig,
} from "./gallery-view-state";
import { isTableDensity, type TableDensity } from "./table-contracts";

// JSON ---------------------------------------------------------------------------

/** A JSON object. */
export interface ViewJsonObject {
  [key: string]: ViewJson;
}

/** A JSON value. */
export type ViewJson =
  | string
  | number
  | boolean
  | null
  | ViewJson[]
  | ViewJsonObject;

type Row = Record<string, unknown>;

const isRecord = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** A JSON path: `base.key`, `base["odd key"]` or `base[3]`. */
export function jsonPath(base: string, key: string | number): string {
  if (typeof key === "number") {
    return `${base}[${key}]`;
  }
  if (!IDENTIFIER.test(key)) {
    return `${base}[${JSON.stringify(key)}]`;
  }
  return base ? `${base}.${key}` : key;
}

/** What a value is, for messages: a short quoted text, or its type. */
export function describeValue(value: unknown): string {
  if (typeof value === "string") {
    return JSON.stringify(value.length > 40 ? `${value.slice(0, 40)}…` : value);
  }
  if (Array.isArray(value)) {
    return "a list";
  }
  return value === null ? "null" : typeof value;
}

/** Keys never copied: they could reach an object's prototype. */
export const UNSAFE_JSON_KEYS: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

export interface JsonCopyOptions {
  /** Deepest nesting kept; deeper values are left out. */
  depth: number;
  /** Characters of JSON the copy may take; copying stops beyond. */
  size: number;
  /** Items kept per list; the others are left out. */
  items?: number;
  /** Characters kept per text; longer texts are cut. */
  text?: number;
}

export interface JsonCopyIssue {
  code: "invalidValue" | "truncated";
  path: string;
  message: string;
}

export interface JsonCopy {
  value?: ViewJson;
  issues: JsonCopyIssue[];
  /** The value was larger than `size`: the copy is incomplete. */
  oversize: boolean;
}

interface CopyState {
  options: JsonCopyOptions;
  issues: JsonCopyIssue[];
  size: number;
  oversize: boolean;
}

const MAX_COPY_ISSUES = 50;

function copyIssue(
  state: CopyState,
  code: JsonCopyIssue["code"],
  path: string,
  message: string
) {
  if (state.issues.length < MAX_COPY_ISSUES) {
    state.issues.push({ code, path, message });
  }
}

/** Counts `size` characters; false once the copy is too large. */
function charge(state: CopyState, size: number): boolean {
  state.size += size;
  if (state.size > state.options.size) {
    state.oversize = true;
  }
  return !state.oversize;
}

function copyText(value: string, path: string, state: CopyState) {
  const max = state.options.text;
  const text =
    max !== undefined && value.length > max ? value.slice(0, max) : value;
  if (text !== value) {
    copyIssue(state, "truncated", path, `Texts are cut at ${max} characters.`);
  }
  return charge(state, text.length + 2) ? text : undefined;
}

function copyPrimitive(
  value: unknown,
  path: string,
  state: CopyState
): ViewJson | undefined {
  if (typeof value === "string") {
    return copyText(value, path, state);
  }
  if (typeof value === "boolean") {
    return charge(state, 5) ? value : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return charge(state, String(value).length) ? value : undefined;
  }
  if (value !== undefined) {
    copyIssue(
      state,
      "invalidValue",
      path,
      `${describeValue(value)} is not JSON and was left out.`
    );
  }
  return;
}

function copyList(
  value: unknown[],
  depth: number,
  path: string,
  state: CopyState
): ViewJson[] {
  const max = state.options.items ?? value.length;
  if (value.length > max) {
    copyIssue(state, "truncated", path, `Lists keep their first ${max} items.`);
  }
  const list: ViewJson[] = [];
  for (const [index, item] of value.slice(0, max).entries()) {
    const copied = copyNode(item, depth, jsonPath(path, index), state);
    if (state.oversize) {
      break;
    }
    if (copied !== undefined) {
      list.push(copied);
    }
  }
  return list;
}

function copyObject(
  value: Row,
  depth: number,
  path: string,
  state: CopyState
): ViewJsonObject {
  const object: ViewJsonObject = {};
  const keys = Object.keys(value);
  const max = state.options.items ?? keys.length;
  if (keys.length > max) {
    copyIssue(
      state,
      "truncated",
      path,
      `Objects keep their first ${max} keys.`
    );
  }
  for (const key of keys.slice(0, max)) {
    const keyPath = jsonPath(path, key);
    if (UNSAFE_JSON_KEYS.has(key)) {
      copyIssue(state, "invalidValue", keyPath, `"${key}" is not allowed.`);
      continue;
    }
    const copied = copyNode(value[key], depth, keyPath, state);
    if (state.oversize || !charge(state, key.length + 3)) {
      break;
    }
    if (copied !== undefined) {
      object[key] = copied;
    }
  }
  return object;
}

function copyNode(
  value: unknown,
  depth: number,
  path: string,
  state: CopyState
): ViewJson | undefined {
  if (state.oversize) {
    return;
  }
  if (value === null) {
    return charge(state, 4) ? null : undefined;
  }
  if (typeof value !== "object") {
    return copyPrimitive(value, path, state);
  }
  if (depth <= 0) {
    copyIssue(
      state,
      "truncated",
      path,
      "Values nested this deep are left out."
    );
    return;
  }
  if (Array.isArray(value)) {
    return charge(state, 2)
      ? copyList(value, depth - 1, path, state)
      : undefined;
  }
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time)
      ? copyText(value.toISOString(), path, state)
      : undefined;
  }
  return charge(state, 2)
    ? copyObject(value as Row, depth - 1, path, state)
    : undefined;
}

/**
 * A deep copy of JSON data. Keys that could reach a prototype (`__proto__`,
 * `constructor`, `prototype`), functions, symbols, non-finite numbers and
 * values nested deeper than `depth` are left out, lists and texts are capped,
 * and copying stops at `size` characters of JSON. Never throws.
 */
export function copyJson(
  value: unknown,
  options: JsonCopyOptions,
  path = ""
): JsonCopy {
  const state: CopyState = { options, issues: [], size: 0, oversize: false };
  try {
    const copied = copyNode(value, options.depth, path, state);
    return {
      ...(copied === undefined || state.oversize ? {} : { value: copied }),
      issues: state.issues,
      oversize: state.oversize,
    };
  } catch {
    // Throwing getters and proxies are unreadable, not fatal.
    copyIssue(state, "invalidValue", path, "This value could not be read.");
    return { issues: state.issues, oversize: state.oversize };
  }
}

// Contract -------------------------------------------------------------------------

/** Filter operators a saved view may use: every operator of both editions. */
export const VIEW_FILTER_OPERATORS = [
  "contains",
  "notContains",
  "equals",
  "notEquals",
  "startsWith",
  "endsWith",
  "isEmpty",
  "isNotEmpty",
  "greaterThan",
  "greaterThanOrEqual",
  "lessThan",
  "lessThanOrEqual",
  "between",
  "before",
  "after",
  "is",
  "isNot",
  "isAnyOf",
  "isNoneOf",
  "in",
  "notIn",
  "containsAll",
  "containsNone",
  "isTrue",
  "isFalse",
  "withinDistance",
  "withinBounds",
] as const;

export type ViewFilterOperator = (typeof VIEW_FILTER_OPERATORS)[number];

const OPERATORS: ReadonlySet<string> = new Set(VIEW_FILTER_OPERATORS);

export interface ViewSort {
  id: string;
  desc: boolean;
}

export interface ViewColumnFilter {
  id: string;
  value: ViewJson;
}

/** An advanced filter rule. A view matching any rule marks each with `joinOperator: "or"`. */
export interface ViewFilterRule {
  id: string;
  columnId: string;
  operator: ViewFilterOperator;
  type?: string;
  values?: ViewJson;
  isActive: boolean;
  joinOperator?: "or";
  label?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ViewKanbanSettings {
  titleColumn?: string;
  cardColumnIds?: string[];
  showCardLabels?: boolean;
}

export interface ViewColumnPinning {
  left: string[];
  right: string[];
}

/** Saved-view settings, sanitized: what `initialView.config` and saved views take. */
export interface ViewConfig extends GenericModeViewConfigs {
  displayMode?: TableDisplayMode;
  density?: TableDensity;
  footerCalculationsVisible?: boolean;
  globalSearch?: string;
  sorting?: ViewSort[];
  columnFilters?: ViewColumnFilter[];
  advancedFilters?: ViewFilterRule[];
  columnOrder?: string[];
  columnVisibility?: Record<string, boolean>;
  columnSizing?: Record<string, number>;
  columnPinning?: ViewColumnPinning;
  grouping?: string[];
  pageSize?: number;
  kanban?: ViewKanbanSettings;
  gallery?: GalleryViewState;
  gantt?: TableGanttViewConfig;
}

export interface ViewConfigLimits {
  /** Sort rules, column filters and filter rules, each. */
  rules: number;
  /** Column ids in one list: order, visibility, widths, pinning, grouping, card properties. */
  columns: number;
  /** Values of one filter rule or column filter. */
  values: number;
  /** Characters of one text: column ids, the search, filter values. */
  text: number;
  /** Nesting kept in display mode settings. */
  depth: number;
  /** Largest page size. */
  pageSize: number;
  /** Characters of JSON the settings of one display mode may take. */
  modeSettings: number;
}

export const VIEW_CONFIG_LIMITS: Readonly<ViewConfigLimits> = {
  rules: 50,
  columns: 200,
  values: 100,
  text: 500,
  depth: 16,
  pageSize: 500,
  modeSettings: 65_536,
};

export type ViewConfigIssueCode = "invalidValue" | "truncated" | "unknownKey";

export interface ViewConfigIssue {
  code: ViewConfigIssueCode;
  message: string;
  /** Errors lost something the settings asked for; warnings only dropped unknown keys. */
  severity: "error" | "warning";
  /** JSON path inside the settings (`sorting[0].id`); empty for the settings themselves. */
  path: string;
}

export interface SanitizedViewConfig {
  config: ViewConfig;
  issues: ViewConfigIssue[];
}

const SEVERITY: Record<ViewConfigIssueCode, "error" | "warning"> = {
  invalidValue: "error",
  truncated: "error",
  unknownKey: "warning",
};
const MAX_ISSUES = 100;
/** Items kept per list inside display mode settings (form questions, stages…). */
const MODE_ITEMS = 1000;
/** Nesting of filter values: lists of ranges at most. */
const VALUE_DEPTH = 3;
const DATE_TEXT = 64;
const RULE_TYPE = /^[A-Za-z][\w-]{0,39}$/;

interface Context {
  limits: ViewConfigLimits;
  issues: ViewConfigIssue[];
  add: (code: ViewConfigIssueCode, path: string, message: string) => void;
}

/** Positive whole limits override the defaults; anything else is ignored. */
function resolveLimits(limits: Partial<ViewConfigLimits>): ViewConfigLimits {
  const resolved = { ...VIEW_CONFIG_LIMITS };
  for (const key of Object.keys(resolved) as (keyof ViewConfigLimits)[]) {
    const value = limits[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      resolved[key] = Math.floor(value);
    }
  }
  return resolved;
}

function createContext(limits: Partial<ViewConfigLimits>): Context {
  const issues: ViewConfigIssue[] = [];
  return {
    limits: resolveLimits(limits),
    issues,
    add: (code, path, message) => {
      if (issues.length < MAX_ISSUES) {
        issues.push({ code, message, severity: SEVERITY[code], path });
      } else if (issues.length === MAX_ISSUES) {
        issues.push({
          code: "truncated",
          message: `More problems were found; only the first ${MAX_ISSUES} are listed.`,
          severity: "error",
          path: "",
        });
      }
    },
  };
}

// Values ----------------------------------------------------------------------------

function unknownKeys(
  value: Row,
  known: ReadonlySet<string>,
  path: string,
  context: Context
) {
  for (const key of Object.keys(value)) {
    if (!known.has(key)) {
      context.add(
        "unknownKey",
        jsonPath(path, key),
        `"${key}" is not a setting here and was removed.`
      );
    }
  }
}

/** A trimmed text, cut at the text limit; undefined when empty or not a text. */
function textOf(
  value: unknown,
  path: string,
  context: Context,
  max = context.limits.text
): string | undefined {
  if (value === undefined) {
    return;
  }
  if (typeof value !== "string") {
    context.add(
      "invalidValue",
      path,
      `Expected a text, got ${describeValue(value)}.`
    );
    return;
  }
  const text = value.trim();
  if (text.length > max) {
    context.add("truncated", path, `Texts are cut at ${max} characters.`);
    return text.slice(0, max);
  }
  return text || undefined;
}

/** A text that must be there: `message` explains a missing one. */
function requiredText(
  value: unknown,
  path: string,
  context: Context,
  message: string
): string | undefined {
  const text = textOf(value, path, context);
  if (!text && (value === undefined || typeof value === "string")) {
    context.add("invalidValue", path, message);
  }
  return text;
}

/** The list, or undefined (with an issue) when the value is not one; long lists are cut. */
function listOf(
  value: unknown,
  path: string,
  context: Context,
  max: number
): unknown[] | undefined {
  if (!Array.isArray(value)) {
    context.add(
      "invalidValue",
      path,
      `Expected a list, got ${describeValue(value)}.`
    );
    return;
  }
  if (value.length > max) {
    context.add("truncated", path, `Only the first ${max} items are kept.`);
    return value.slice(0, max);
  }
  return value;
}

function booleanOf(
  value: unknown,
  path: string,
  context: Context
): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  context.add(
    "invalidValue",
    path,
    `Expected true or false, got ${describeValue(value)}.`
  );
  return;
}

/** Column ids: texts, each once. */
function columnIds(
  value: unknown,
  path: string,
  context: Context
): string[] | undefined {
  const items = listOf(value, path, context, context.limits.columns);
  if (!items) {
    return;
  }
  const ids: string[] = [];
  for (const [index, item] of items.entries()) {
    const itemPath = jsonPath(path, index);
    const id = textOf(item, itemPath, context);
    if (id && ids.includes(id)) {
      context.add("invalidValue", itemPath, `Column "${id}" appears twice.`);
    } else if (id) {
      ids.push(id);
    }
  }
  return ids;
}

/** A filter's value: JSON, lists capped, texts cut. */
function filterValue(
  value: unknown,
  path: string,
  context: Context
): ViewJson | undefined {
  const { text, values } = context.limits;
  const copy = copyJson(
    value,
    { depth: VALUE_DEPTH, items: values, text, size: (text + 3) * values },
    path
  );
  for (const issue of copy.issues) {
    context.add(issue.code, issue.path, issue.message);
  }
  if (copy.oversize) {
    context.add("truncated", path, "This filter value is too large.");
  }
  return copy.value;
}

// Fields ----------------------------------------------------------------------------

type FieldSanitizer = (
  value: unknown,
  path: string,
  context: Context,
  key: string
) => unknown;

const sanitizeDisplayMode: FieldSanitizer = (value, path, context) => {
  if (isTableDisplayMode(value)) {
    return value;
  }
  context.add(
    "invalidValue",
    path,
    `Unknown display mode ${describeValue(value)}.`
  );
  return;
};

const sanitizeDensity: FieldSanitizer = (value, path, context) => {
  if (isTableDensity(value)) {
    return value;
  }
  context.add("invalidValue", path, `Unknown density ${describeValue(value)}.`);
  return;
};

const sanitizeBoolean: FieldSanitizer = (value, path, context) =>
  booleanOf(value, path, context);

const sanitizeText: FieldSanitizer = (value, path, context) =>
  textOf(value, path, context);

const sanitizePageSize: FieldSanitizer = (value, path, context) => {
  const size = typeof value === "string" ? Number(value) : value;
  if (typeof size !== "number" || !Number.isFinite(size) || size < 1) {
    context.add(
      "invalidValue",
      path,
      `Page sizes are whole numbers from 1, got ${describeValue(value)}.`
    );
    return;
  }
  const max = context.limits.pageSize;
  if (size > max) {
    context.add("truncated", path, `Page sizes are at most ${max}.`);
    return max;
  }
  return Math.trunc(size);
};

const SORT_KEYS: ReadonlySet<string> = new Set(["id", "desc"]);

function sortOf(
  item: unknown,
  path: string,
  context: Context
): ViewSort | undefined {
  if (!isRecord(item)) {
    context.add("invalidValue", path, "Sort rules are `{ id, desc }` objects.");
    return;
  }
  unknownKeys(item, SORT_KEYS, path, context);
  const id = requiredText(
    item.id,
    jsonPath(path, "id"),
    context,
    "Sort rules need a column id."
  );
  if (!id) {
    return;
  }
  if (item.desc !== undefined && typeof item.desc !== "boolean") {
    context.add(
      "invalidValue",
      jsonPath(path, "desc"),
      "`desc` is true (descending) or false."
    );
    return;
  }
  return { id, desc: item.desc === true };
}

const sanitizeSorting: FieldSanitizer = (value, path, context) => {
  const items = listOf(value, path, context, context.limits.rules);
  const sorts: ViewSort[] = [];
  for (const [index, item] of (items ?? []).entries()) {
    const itemPath = jsonPath(path, index);
    const sort = sortOf(item, itemPath, context);
    if (sort && sorts.some((other) => other.id === sort.id)) {
      context.add(
        "invalidValue",
        itemPath,
        `Column "${sort.id}" is sorted twice.`
      );
    } else if (sort) {
      sorts.push(sort);
    }
  }
  return sorts.length ? sorts : undefined;
};

const COLUMN_FILTER_KEYS: ReadonlySet<string> = new Set(["id", "value"]);

function columnFilterOf(
  item: unknown,
  path: string,
  context: Context
): ViewColumnFilter | undefined {
  if (!isRecord(item)) {
    context.add(
      "invalidValue",
      path,
      "Column filters are `{ id, value }` objects."
    );
    return;
  }
  unknownKeys(item, COLUMN_FILTER_KEYS, path, context);
  const id = requiredText(
    item.id,
    jsonPath(path, "id"),
    context,
    "Column filters need a column id."
  );
  const value = filterValue(item.value, jsonPath(path, "value"), context);
  if (value === undefined && item.value === undefined) {
    context.add(
      "invalidValue",
      jsonPath(path, "value"),
      "Column filters need a value."
    );
  }
  return id && value !== undefined ? { id, value } : undefined;
}

const sanitizeColumnFilters: FieldSanitizer = (value, path, context) => {
  const items = listOf(value, path, context, context.limits.rules);
  const filters: ViewColumnFilter[] = [];
  for (const [index, item] of (items ?? []).entries()) {
    const itemPath = jsonPath(path, index);
    const filter = columnFilterOf(item, itemPath, context);
    if (filter && filters.some((other) => other.id === filter.id)) {
      context.add(
        "invalidValue",
        itemPath,
        `Column "${filter.id}" is filtered twice.`
      );
    } else if (filter) {
      filters.push(filter);
    }
  }
  return filters.length ? filters : undefined;
};

const RULE_KEYS: ReadonlySet<string> = new Set([
  "id",
  "columnId",
  "operator",
  "type",
  "values",
  "isActive",
  "joinOperator",
  "label",
  "createdAt",
  "updatedAt",
]);

function ruleStamp(
  value: unknown,
  path: string,
  context: Context
): string | undefined {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  return textOf(value, path, context, DATE_TEXT);
}

/** A rule's optional parts: type, values, label, stamps and its join. */
function ruleDetails(
  item: Row,
  path: string,
  context: Context
): Partial<ViewFilterRule> {
  const details: Partial<ViewFilterRule> = {};
  if (item.type !== undefined) {
    if (typeof item.type === "string" && RULE_TYPE.test(item.type)) {
      details.type = item.type;
    } else {
      context.add(
        "invalidValue",
        jsonPath(path, "type"),
        `Unknown rule type ${describeValue(item.type)}.`
      );
    }
  }
  if (item.values !== undefined) {
    const values = filterValue(item.values, jsonPath(path, "values"), context);
    if (values !== undefined) {
      details.values = values;
    }
  }
  const label = textOf(item.label, jsonPath(path, "label"), context);
  const createdAt = ruleStamp(
    item.createdAt,
    jsonPath(path, "createdAt"),
    context
  );
  const updatedAt = ruleStamp(
    item.updatedAt,
    jsonPath(path, "updatedAt"),
    context
  );
  if (label) {
    details.label = label;
  }
  if (createdAt) {
    details.createdAt = createdAt;
  }
  if (updatedAt) {
    details.updatedAt = updatedAt;
  }
  if (item.joinOperator === "or") {
    details.joinOperator = "or";
  } else if (item.joinOperator !== undefined && item.joinOperator !== "and") {
    context.add(
      "invalidValue",
      jsonPath(path, "joinOperator"),
      '`joinOperator` is "and" or "or".'
    );
  }
  return details;
}

function ruleOf(
  item: unknown,
  path: string,
  context: Context,
  index: number
): ViewFilterRule | undefined {
  if (!isRecord(item)) {
    context.add("invalidValue", path, "Filter rules are objects.");
    return;
  }
  unknownKeys(item, RULE_KEYS, path, context);
  const columnId = requiredText(
    item.columnId,
    jsonPath(path, "columnId"),
    context,
    "Filter rules need a column id."
  );
  if (!columnId) {
    return;
  }
  if (!(typeof item.operator === "string" && OPERATORS.has(item.operator))) {
    context.add(
      "invalidValue",
      jsonPath(path, "operator"),
      `Unknown filter operator ${describeValue(item.operator)}.`
    );
    return;
  }
  const isActive =
    item.isActive === undefined
      ? true
      : booleanOf(item.isActive, jsonPath(path, "isActive"), context);
  return {
    id: textOf(item.id, jsonPath(path, "id"), context) ?? `rule-${index + 1}`,
    columnId,
    operator: item.operator as ViewFilterOperator,
    isActive: isActive !== false,
    ...ruleDetails(item, path, context),
  };
}

const ENVELOPE_KEYS: ReadonlySet<string> = new Set(["filters", "joinOperator"]);

/** Rules as React stores them: one list, each marked `joinOperator: "or"` when any may match. */
const sanitizeAdvancedFilters: FieldSanitizer = (value, path, context) => {
  let list = value;
  let listPath = path;
  let anyOf = false;
  if (isRecord(value)) {
    // The Vue envelope: `{ filters, joinOperator }`.
    unknownKeys(value, ENVELOPE_KEYS, path, context);
    anyOf = value.joinOperator === "or";
    list = value.filters ?? [];
    listPath = jsonPath(path, "filters");
  }
  const items = listOf(list, listPath, context, context.limits.rules);
  const rules: ViewFilterRule[] = [];
  for (const [index, item] of (items ?? []).entries()) {
    const rule = ruleOf(item, jsonPath(listPath, index), context, index);
    if (rule) {
      rules.push(rule);
    }
  }
  if (!rules.length) {
    return;
  }
  anyOf ||= rules[0]?.joinOperator === "or";
  return rules.map(({ joinOperator: _join, ...rule }) =>
    anyOf ? { ...rule, joinOperator: "or" } : rule
  );
};

const sanitizeColumnList: FieldSanitizer = (value, path, context) => {
  const ids = columnIds(value, path, context);
  return ids?.length ? ids : undefined;
};

/** Entries of a column map, capped; keys are column ids. */
function columnEntries(
  value: unknown,
  path: string,
  context: Context
): [string, unknown, string][] {
  if (!isRecord(value)) {
    context.add(
      "invalidValue",
      path,
      `Expected an object, got ${describeValue(value)}.`
    );
    return [];
  }
  const keys = Object.keys(value);
  const max = context.limits.columns;
  if (keys.length > max) {
    context.add("truncated", path, `Only the first ${max} columns are kept.`);
  }
  const entries: [string, unknown, string][] = [];
  for (const key of keys.slice(0, max)) {
    const keyPath = jsonPath(path, key);
    const id = key.trim();
    if (!id || id.length > context.limits.text || UNSAFE_JSON_KEYS.has(id)) {
      context.add(
        "invalidValue",
        keyPath,
        `${describeValue(key)} is not a column id.`
      );
    } else {
      entries.push([id, value[key], keyPath]);
    }
  }
  return entries;
}

const sanitizeVisibility: FieldSanitizer = (value, path, context) => {
  const visibility: Record<string, boolean> = {};
  for (const [id, shown, keyPath] of columnEntries(value, path, context)) {
    const flag = booleanOf(shown, keyPath, context);
    if (flag !== undefined) {
      visibility[id] = flag;
    }
  }
  return Object.keys(visibility).length ? visibility : undefined;
};

const sanitizeSizing: FieldSanitizer = (value, path, context) => {
  const sizing: Record<string, number> = {};
  for (const [id, width, keyPath] of columnEntries(value, path, context)) {
    if (typeof width === "number" && Number.isFinite(width) && width > 0) {
      sizing[id] = Math.round(width);
    } else {
      context.add(
        "invalidValue",
        keyPath,
        "Column widths are positive numbers."
      );
    }
  }
  return Object.keys(sizing).length ? sizing : undefined;
};

const PINNING_KEYS: ReadonlySet<string> = new Set(["left", "right"]);

const sanitizePinning: FieldSanitizer = (value, path, context) => {
  if (!isRecord(value)) {
    context.add(
      "invalidValue",
      path,
      "Pinned columns are `{ left, right }` lists."
    );
    return;
  }
  unknownKeys(value, PINNING_KEYS, path, context);
  const side = (key: "left" | "right") =>
    value[key] === undefined
      ? []
      : (columnIds(value[key], jsonPath(path, key), context) ?? []);
  const left = side("left");
  const right = side("right");
  return left.length || right.length ? { left, right } : undefined;
};

// Display mode settings -------------------------------------------------------------

/** Kanban settings; `groupBy` (legacy) moves to the shared `grouping`. */
function normalizeKanbanSettings(
  value: unknown
): ViewKanbanSettings | undefined {
  if (!isRecord(value)) {
    return;
  }
  const settings: ViewKanbanSettings = {};
  const title =
    typeof value.titleColumn === "string" ? value.titleColumn.trim() : "";
  if (title) {
    settings.titleColumn = title;
  }
  if (Array.isArray(value.cardColumnIds)) {
    settings.cardColumnIds = value.cardColumnIds
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value.showCardLabels === "boolean") {
    settings.showCardLabels = value.showCardLabels;
  }
  return Object.keys(settings).length ? settings : undefined;
}

/** The gallery normalizer trims its column ids: they must be texts first. */
function normalizeGallerySettings(
  value: unknown
): GalleryViewState | undefined {
  if (!isRecord(value)) {
    return;
  }
  const typed: Row = { ...value };
  for (const key of ["imageColumn", "titleColumn"]) {
    if (typed[key] !== undefined && typeof typed[key] !== "string") {
      Reflect.deleteProperty(typed, key);
    }
  }
  return normalizeGalleryViewConfig(typed as GalleryViewState);
}

function normalizeGanttSettings(
  value: unknown
): TableGanttViewConfig | undefined {
  const gantt = normalizeGanttView(value);
  return Object.keys(gantt).length ? gantt : undefined;
}

type ModeNormalizer = (value: unknown) => object | undefined;

const MODE_NORMALIZERS: Readonly<Record<string, ModeNormalizer>> = {
  kanban: normalizeKanbanSettings,
  gallery: normalizeGallerySettings,
  gantt: normalizeGanttSettings,
  ...Object.fromEntries(
    GENERIC_MODE_CONFIG_KEYS.map((key): [string, ModeNormalizer] => [
      key,
      (value) => normalizeModeConfig(key, value),
    ])
  ),
};

/**
 * The settings each display mode keeps, so a dropped setting reads as an
 * invalid value (an error) and anything else as an unknown key (a warning).
 */
export const VIEW_MODE_SETTING_KEYS: Readonly<
  Record<string, readonly string[]>
> = {
  list: [
    "titleColumn",
    "cardColumnIds",
    "showCardLabels",
    "wrap",
    "showActions",
    "propertyAlign",
    "maxProperties",
    "mobileMaxProperties",
  ],
  kanban: ["titleColumn", "cardColumnIds", "showCardLabels"],
  gallery: [
    "imageColumn",
    "titleColumn",
    "cardColumnIds",
    "aspectRatio",
    "imageFit",
    "cardSize",
    "previewSize",
    "showCardLabels",
  ],
  filetree: [
    "parentColumn",
    "kindColumn",
    "nameColumn",
    "sizeColumn",
    "updatedColumn",
    "rootLabel",
    "showDetails",
    "foldersFirst",
    "expandedAll",
    "columns",
    "detailFields",
    "expanded",
    "sort",
    "defaultExpandedDepth",
  ],
  calendar: [
    "dateColumn",
    "endColumn",
    "titleColumn",
    "colorColumn",
    "layout",
    "weekStartsOn",
    "showWeekends",
    "allowDragUpdate",
    "allowResize",
    "allowCreate",
  ],
  chart: [
    "type",
    "xColumn",
    "metricColumn",
    "seriesColumn",
    "lineMetricColumn",
    "stacked",
    "cumulative",
    "hideEmpty",
    "showDataLabels",
    "showLegend",
    "fill",
    "bucket",
    "metric",
    "sort",
    "colors",
    "topN",
    "weekStartsOn",
    "stacking",
    "curve",
    "lineMetric",
    "stageOrder",
  ],
  feed: [
    "titleColumn",
    "authorColumn",
    "dateColumn",
    "bodyColumn",
    "mediaColumn",
    "propertyColumnIds",
    "dateDisplay",
    "density",
    "bodyLines",
    "pageSize",
    "showPropertyLabels",
    "infiniteScroll",
  ],
  map: [
    "locationColumn",
    "titleColumn",
    "colorColumn",
    "style",
    "cluster",
    "showPopupLabels",
    "searchOnMove",
    "popupColumns",
    "initialView",
    "center",
    "zoom",
  ],
  form: [
    "title",
    "description",
    "submitLabel",
    "successMessage",
    "closedMessage",
    "defaultLocale",
    "locales",
    "questions",
    "hiddenValues",
    "allowAnotherResponse",
    "rules",
    "layout",
    "review",
    "editButton",
    "redirectUrl",
  ],
  gantt: ["zoom", "weekStartsOn", "showDependencies", "anchorDate"],
};

/** Reports the settings a mode's normalizer left out. */
function reportDropped(
  key: string,
  input: ViewJsonObject,
  kept: object | undefined,
  path: string,
  context: Context
) {
  const known = VIEW_MODE_SETTING_KEYS[key] ?? [];
  for (const setting of Object.keys(input)) {
    if (kept && Object.hasOwn(kept, setting)) {
      continue;
    }
    const settingPath = jsonPath(path, setting);
    if (known.includes(setting)) {
      context.add(
        "invalidValue",
        settingPath,
        `${describeValue(input[setting])} is not a valid ${key} "${setting}".`
      );
    } else {
      context.add(
        "unknownKey",
        settingPath,
        `"${setting}" is not a ${key} setting and was removed.`
      );
    }
  }
}

const sanitizeModeSettings: FieldSanitizer = (value, path, context, key) => {
  const normalize = Object.hasOwn(MODE_NORMALIZERS, key)
    ? MODE_NORMALIZERS[key]
    : undefined;
  if (!(normalize && isRecord(value))) {
    context.add("invalidValue", path, `The ${key} settings are an object.`);
    return;
  }
  const source: Row = { ...value };
  if (key === "kanban") {
    // Moved to `grouping` by `sanitizeViewConfig`.
    Reflect.deleteProperty(source, "groupBy");
  }
  const copy = copyJson(
    source,
    {
      depth: context.limits.depth,
      size: context.limits.modeSettings,
      items: MODE_ITEMS,
    },
    path
  );
  for (const issue of copy.issues) {
    context.add(issue.code, issue.path, issue.message);
  }
  if (copy.oversize || !isRecord(copy.value)) {
    context.add(
      "truncated",
      path,
      `The ${key} settings are larger than ${context.limits.modeSettings} characters and were removed.`
    );
    return;
  }
  let kept: object | undefined;
  try {
    kept = normalize(copy.value);
  } catch {
    context.add("invalidValue", path, `The ${key} settings could not be read.`);
    return;
  }
  reportDropped(key, copy.value, kept, path, context);
  return kept;
};

// Settings --------------------------------------------------------------------------

const FIELDS: Readonly<Record<string, FieldSanitizer>> = {
  displayMode: sanitizeDisplayMode,
  density: sanitizeDensity,
  footerCalculationsVisible: sanitizeBoolean,
  globalSearch: sanitizeText,
  pageSize: sanitizePageSize,
  sorting: sanitizeSorting,
  columnFilters: sanitizeColumnFilters,
  advancedFilters: sanitizeAdvancedFilters,
  columnOrder: sanitizeColumnList,
  grouping: sanitizeColumnList,
  columnVisibility: sanitizeVisibility,
  columnSizing: sanitizeSizing,
  columnPinning: sanitizePinning,
  ...Object.fromEntries(
    Object.keys(MODE_NORMALIZERS).map((key): [string, FieldSanitizer] => [
      key,
      sanitizeModeSettings,
    ])
  ),
};

/** The keys saved-view settings may have, in the order they are read. */
export const VIEW_CONFIG_KEYS: readonly string[] = Object.keys(FIELDS);

/** Historical Vue names, read when the canonical name is absent. */
const ALIASES: Readonly<Record<string, string>> = {
  search: "globalSearch",
  filters: "columnFilters",
  pinning: "columnPinning",
};

/** A legacy Kanban `groupBy`, as the shared grouping. */
function legacyGrouping(
  kanban: unknown,
  context: Context
): string[] | undefined {
  if (!(isRecord(kanban) && kanban.groupBy !== undefined)) {
    return;
  }
  const column = textOf(kanban.groupBy, "kanban.groupBy", context);
  return column ? [column] : undefined;
}

/**
 * The canonical name of a key and its sanitizer; `false` for a historical
 * name whose canonical one is also there (the canonical one wins).
 */
function fieldOf(
  key: string,
  input: Row
): { name: string; field?: FieldSanitizer } | false {
  const alias = Object.hasOwn(ALIASES, key) ? ALIASES[key] : undefined;
  if (alias && Object.hasOwn(input, alias)) {
    return false;
  }
  const name = alias ?? key;
  return {
    name,
    field: Object.hasOwn(FIELDS, name) ? FIELDS[name] : undefined,
  };
}

function sanitize(input: unknown, context: Context): ViewConfig {
  if (!isRecord(input)) {
    context.add(
      "invalidValue",
      "",
      `View settings are an object, got ${describeValue(input)}.`
    );
    return {};
  }
  const config: Row = {};
  for (const key of Object.keys(input)) {
    const found = fieldOf(key, input);
    if (!found) {
      continue;
    }
    if (!found.field) {
      context.add(
        "unknownKey",
        jsonPath("", key),
        `"${key}" is not a view setting and was removed.`
      );
      continue;
    }
    const value = found.field(
      input[key],
      jsonPath("", key),
      context,
      found.name
    );
    if (value !== undefined) {
      config[found.name] = value;
    }
  }
  if (config.grouping === undefined) {
    const grouping = legacyGrouping(input.kanban, context);
    if (grouping) {
      config.grouping = grouping;
    }
  }
  return config as ViewConfig;
}

/**
 * Saved-view settings, strictly sanitized: unknown keys (at every level) are
 * removed, lists and texts capped (`limits`, see `VIEW_CONFIG_LIMITS`), each
 * value type-checked before its display mode's normalizer reads it, and
 * historical Vue names (`search`, `filters`, `pinning`, Kanban `groupBy`)
 * read as the canonical ones. Never throws: unreadable input gives `{}`.
 * Issues carry JSON paths inside the settings; errors lost something the
 * settings asked for, warnings only removed unknown keys.
 */
export function sanitizeViewConfig(
  input: unknown,
  limits: Partial<ViewConfigLimits> = {}
): SanitizedViewConfig {
  const context = createContext(limits);
  try {
    return { config: sanitize(input, context), issues: context.issues };
  } catch {
    // Throwing getters and proxies are unreadable, not fatal.
    context.add("invalidValue", "", "The view settings could not be read.");
    return { config: {}, issues: context.issues };
  }
}

/** Columns every table adds itself (row selection, row actions): not part of a view. */
const SYSTEM_COLUMNS: ReadonlySet<string> = new Set(["select", "actions"]);

const withoutSystemColumns = (ids: readonly string[]): string[] =>
  ids.filter((id) => !SYSTEM_COLUMNS.has(id));

const withoutSystemEntries = <T>(
  map: Record<string, T>
): Record<string, T> | undefined => {
  const kept = Object.entries(map).filter(([id]) => !SYSTEM_COLUMNS.has(id));
  return kept.length ? Object.fromEntries(kept) : undefined;
};

/** The column layout of a view without the table's own columns. */
function dataColumnsOnly(config: ViewConfig): ViewConfig {
  const { columnOrder, columnPinning, columnSizing, columnVisibility } = config;
  const order = columnOrder ? withoutSystemColumns(columnOrder) : [];
  const left = withoutSystemColumns(columnPinning?.left ?? []);
  const right = withoutSystemColumns(columnPinning?.right ?? []);
  const visibility = columnVisibility && withoutSystemEntries(columnVisibility);
  const sizing = columnSizing && withoutSystemEntries(columnSizing);
  const {
    columnOrder: _order,
    columnPinning: _pinning,
    columnSizing: _sizing,
    columnVisibility: _visibility,
    ...rest
  } = config;
  return {
    ...rest,
    ...(order.length ? { columnOrder: order } : {}),
    ...(left.length || right.length ? { columnPinning: { left, right } } : {}),
    ...(sizing ? { columnSizing: sizing } : {}),
    ...(visibility ? { columnVisibility: visibility } : {}),
  };
}

/**
 * The settings a table reports for the view it shows (React
 * `onViewConfigChange`, Vue `view-config-change`, `getViewConfig()` in
 * toolbar actions): `sanitizeViewConfig`'s shape, without the table's own
 * columns (`select`, `actions`) and the display mode settings that hold
 * nothing, so both editions report the same object for the same view.
 */
export function canonicalViewConfig(input: unknown): ViewConfig {
  const config: Row = { ...dataColumnsOnly(sanitizeViewConfig(input).config) };
  const canonical: Row = {};
  // Keys in one order whatever the input's, so equal views give equal JSON.
  for (const key of Object.keys(FIELDS)) {
    const value = config[key];
    const empty = isRecord(value) && Object.keys(value).length === 0;
    if (value !== undefined && !empty) {
      canonical[key] = value;
    }
  }
  return canonical as ViewConfig;
}
