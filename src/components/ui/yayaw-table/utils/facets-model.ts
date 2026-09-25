/**
 * Facet navigation, shared by the React and Vue editions (synced to Vue).
 *
 * The facet panel lists, for a few columns (`table.facets`), each value with
 * its number of records, and filters on click. Everything here is pure: the
 * columns a panel shows, the rule a click writes (the one the filter menus
 * write: `isAnyOf` for select, boolean and folder columns, `contains` for
 * lists, `isEmpty` for "No value"), the counts' request (the view's query
 * without the facet's own rule) and how answers read, the values a facet
 * lists, and the panel's labels.
 */
import {
  aggregateChartRows,
  type ChartAggregateRequest,
  chartAggregateParams,
  normalizeChartAggregateResult,
} from "./chart-model";
import {
  DEFAULT_SCOPED_MAX_ROWS,
  loadScopedRows,
  type ScopedRowsRequest,
} from "./scoped-rows";
import {
  type ContractRecord,
  dataTypeFilter,
  emptyGroupLabel,
  normalizeFilterEnvelope,
  recordValue,
} from "./table-contracts";

/** What a facet lists: a select (tags, status), a list, yes/no, or folders. */
export type FacetKind = "boolean" | "folder" | "multiSelect" | "select";

/** How a facet orders its values. */
export type FacetSort = "count" | "label" | "options";

/** A facet of `table.facets.columns` with its own settings. */
export interface FacetColumnSettings {
  /** The column's id. */
  id: string;
  /** Heading of the facet; the column's header by default. */
  label?: string;
  /** Values shown before "Show more"; the panel's `limit` by default. */
  limit?: number;
  /**
   * Order of the values: the column's options (the default when it has
   * some), the number of records (the default otherwise), or the label.
   * Folders keep the tree's order.
   */
  sort?: FacetSort;
  /** Offer "No value" (folders: "Root") for records without one (default true). */
  showEmpty?: boolean;
}

/** `table.facets`: the facet panel beside the records. */
export interface TableFacetsConfig {
  /** Columns listed, in order: ids, or ids with their own settings. */
  columns: (FacetColumnSettings | string)[];
  /** Side of the records the panel takes on wide screens (default "left"). */
  position?: "left" | "right";
  /** Whether the panel starts open on wide screens (default true); phones open it as a sheet. */
  defaultOpen?: boolean;
  /** Values each facet shows before "Show more" (default 8). */
  limit?: number;
  /** Show each value's number of records (default true). */
  showCounts?: boolean;
  /** List values no record has, such as every option (default false). */
  showZero?: boolean;
  /** Width of the panel in pixels on wide screens (default 256, 180 to 480). */
  width?: number;
}

/** A column as the facets read it. */
export interface FacetColumnInput {
  id: string;
  header?: string;
  type?: string;
  options?: unknown;
  enableFiltering?: boolean;
}

export interface FacetOption {
  value: unknown;
  label: string;
}

/** A facet the panel shows, resolved from the table's columns. */
export interface FacetColumn {
  id: string;
  label: string;
  kind: FacetKind;
  /** The rule type the filter menus write for this column. */
  type: "multiSelect" | "select";
  /** The operator a selection of values writes. */
  operator: "contains" | "isAnyOf";
  /** Static choices: the column's options, yes and no for booleans. */
  options: FacetOption[];
  limit: number;
  sort: FacetSort;
  showEmpty: boolean;
}

export interface ResolvedFacets {
  columns: FacetColumn[];
  position: "left" | "right";
  defaultOpen: boolean;
  limit: number;
  showCounts: boolean;
  showZero: boolean;
  width: number;
}

/** Values shown before "Show more". */
export const FACETS_DEFAULT_LIMIT = 8;
/** Width of the panel on wide screens, in pixels. */
export const FACETS_DEFAULT_WIDTH = 256;
const FACETS_MIN_WIDTH = 180;
const FACETS_MAX_WIDTH = 480;
const FACETS_MAX_LIMIT = 100;
/** Rows loaded at most to count values when the host has no `aggregate`. */
export const FACETS_MAX_ROWS = DEFAULT_SCOPED_MAX_ROWS;
/** Key of "No value" (records without a value) in counts and entries. */
export const FACET_EMPTY_KEY = "__facet_empty";
const FACET_SORTS: readonly FacetSort[] = ["count", "label", "options"];
/** Modes that list records; the Form mode creates them and shows no facets. */
const MODES_WITHOUT_FACETS = new Set(["form"]);

const SELECT_OPERATORS = new Set(["isAnyOf", "in", "is", "equals"]);
const LIST_OPERATORS = new Set(["contains", "isAnyOf", "in"]);

const cleanText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const cleanCount = (value: unknown, min: number, max: number) => {
  const number = Number(value);
  return typeof value === "number" && Number.isFinite(number)
    ? Math.min(max, Math.max(min, Math.round(number)))
    : undefined;
};

function cleanColumn(value: unknown): FacetColumnSettings | undefined {
  if (typeof value === "string") {
    const id = cleanText(value);
    return id ? { id } : undefined;
  }
  const entry = recordValue(value);
  const id = cleanText(entry.id);
  if (!id) {
    return;
  }
  const label = cleanText(entry.label);
  const limit = cleanCount(entry.limit, 1, FACETS_MAX_LIMIT);
  const sort = FACET_SORTS.find((item) => item === entry.sort);
  return {
    id,
    ...(label ? { label } : {}),
    ...(limit ? { limit } : {}),
    ...(sort ? { sort } : {}),
    ...(typeof entry.showEmpty === "boolean"
      ? { showEmpty: entry.showEmpty }
      : {}),
  };
}

/** `table.facets` with valid settings only; undefined without columns. */
export function normalizeFacetsConfig(
  value: unknown
): TableFacetsConfig | undefined {
  const source = recordValue(value);
  if (!Array.isArray(source.columns)) {
    return;
  }
  const seen = new Set<string>();
  const columns = source.columns.flatMap((item) => {
    const column = cleanColumn(item);
    if (!column || seen.has(column.id)) {
      return [];
    }
    seen.add(column.id);
    return [column];
  });
  if (!columns.length) {
    return;
  }
  const limit = cleanCount(source.limit, 1, FACETS_MAX_LIMIT);
  const width = cleanCount(source.width, FACETS_MIN_WIDTH, FACETS_MAX_WIDTH);
  return {
    columns,
    ...(source.position === "left" || source.position === "right"
      ? { position: source.position }
      : {}),
    ...(typeof source.defaultOpen === "boolean"
      ? { defaultOpen: source.defaultOpen }
      : {}),
    ...(limit ? { limit } : {}),
    ...(typeof source.showCounts === "boolean"
      ? { showCounts: source.showCounts }
      : {}),
    ...(typeof source.showZero === "boolean"
      ? { showZero: source.showZero }
      : {}),
    ...(width ? { width } : {}),
  };
}

function optionsOf(column: FacetColumnInput): FacetOption[] {
  return Array.isArray(column.options)
    ? column.options.flatMap((item) => {
        const option = recordValue(item);
        return "value" in option
          ? [
              {
                value: option.value,
                label: String(option.label ?? option.value ?? ""),
              },
            ]
          : [];
      })
    : [];
}

/** What a column's facet lists; undefined for columns a facet cannot list. */
export function facetKind(
  column: FacetColumnInput,
  folderColumn?: string
): FacetKind | undefined {
  if (folderColumn && column.id === folderColumn) {
    return "folder";
  }
  if (column.type === "boolean") {
    return "boolean";
  }
  const options = optionsOf(column);
  const family = dataTypeFilter(column.type, options.length > 0);
  if (family === "multiSelect") {
    return "multiSelect";
  }
  return family === "select" || options.length > 0 ? "select" : undefined;
}

function resolveFacetColumn(
  setting: FacetColumnSettings,
  columns: readonly FacetColumnInput[],
  options: { folderColumn?: string; limit: number; locale: string }
): FacetColumn | undefined {
  const column = columns.find((item) => item.id === setting.id);
  if (!column || column.enableFiltering === false) {
    return;
  }
  const kind = facetKind(column, options.folderColumn);
  if (!kind) {
    return;
  }
  const choices =
    kind === "boolean"
      ? [
          { value: true, label: facetLabel("yes", options.locale) },
          { value: false, label: facetLabel("no", options.locale) },
        ]
      : optionsOf(column);
  return {
    id: column.id,
    label: setting.label ?? column.header ?? column.id,
    kind,
    type: kind === "multiSelect" ? "multiSelect" : "select",
    operator: kind === "multiSelect" ? "contains" : "isAnyOf",
    options: kind === "folder" ? [] : choices,
    limit: setting.limit ?? options.limit,
    sort: setting.sort ?? (choices.length ? "options" : "count"),
    showEmpty: setting.showEmpty !== false,
  };
}

/**
 * The facets a table shows: its `table.facets` columns that exist, can be
 * filtered and list values (select, multi-select, yes/no, and the file tree's
 * parent column as folders). Undefined without any.
 */
export function resolveFacets(
  config: unknown,
  columns: readonly FacetColumnInput[],
  options: { folderColumn?: string; locale?: string } = {}
): ResolvedFacets | undefined {
  const settings = normalizeFacetsConfig(config);
  if (!settings) {
    return;
  }
  const limit = settings.limit ?? FACETS_DEFAULT_LIMIT;
  const resolved = settings.columns.flatMap((entry) => {
    const facet = resolveFacetColumn(
      typeof entry === "string" ? { id: entry } : entry,
      columns,
      {
        folderColumn: options.folderColumn,
        limit,
        locale: options.locale ?? "en",
      }
    );
    return facet ? [facet] : [];
  });
  if (!resolved.length) {
    return;
  }
  return {
    columns: resolved,
    position: settings.position ?? "left",
    defaultOpen: settings.defaultOpen ?? true,
    limit,
    showCounts: settings.showCounts !== false,
    showZero: settings.showZero === true,
    width: settings.width ?? FACETS_DEFAULT_WIDTH,
  };
}

/** Whether a display mode shows the facet panel: every mode listing records. */
export const facetsShownIn = (mode: string): boolean =>
  !MODES_WITHOUT_FACETS.has(mode);

// Selection -----------------------------------------------------------------------

/** The key of a value in counts and entries; "No value" has its own. */
export const facetValueKey = (value: unknown): string =>
  value === null || value === undefined || value === ""
    ? FACET_EMPTY_KEY
    : String(value);

const operatorsOf = (facet: Pick<FacetColumn, "kind">) =>
  facet.kind === "multiSelect" ? LIST_OPERATORS : SELECT_OPERATORS;

const listOf = (value: unknown): unknown[] => {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
};

/** Where the facet's own rule sits among normalized rules; -1 without one. */
function ownRuleIndex(
  filters: readonly ContractRecord[],
  facet: Pick<FacetColumn, "id" | "kind">
): number {
  const operators = operatorsOf(facet);
  return filters.findIndex(
    (filter) =>
      filter.isActive !== false &&
      filter.columnId === facet.id &&
      (filter.operator === "isEmpty" || operators.has(String(filter.operator)))
  );
}

/**
 * The facet's own rule: the first active rule on its column that the facet
 * reads, its values (`isAnyOf`, `is`, `equals`, `in`; `contains` for lists)
 * or "No value" (`isEmpty`).
 */
export function facetRule(
  advancedFilters: unknown,
  facet: Pick<FacetColumn, "id" | "kind">
): ContractRecord | undefined {
  const { filters } = normalizeFilterEnvelope(advancedFilters);
  return filters[ownRuleIndex(filters, facet)];
}

export interface FacetSelection {
  /** The values selected, as the rule stores them. */
  values: unknown[];
  /** "No value" is selected. */
  empty: boolean;
}

/** What a facet has selected, read from the view's filters. */
export function facetSelection(
  advancedFilters: unknown,
  facet: Pick<FacetColumn, "id" | "kind">
): FacetSelection {
  const rule = facetRule(advancedFilters, facet);
  if (!rule) {
    return { values: [], empty: false };
  }
  if (rule.operator === "isEmpty") {
    return { values: [], empty: true };
  }
  const seen = new Set<string>();
  const values = listOf(rule.values).filter((value) => {
    const key = facetValueKey(value);
    if (key === FACET_EMPTY_KEY || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  return { values, empty: false };
}

/** A facet has something selected. */
export const hasFacetSelection = (selection: FacetSelection): boolean =>
  selection.empty || selection.values.length > 0;

/** The view's advanced filters as facets write them back. */
export interface FacetFilters {
  filters: ContractRecord[];
  joinOperator: "and" | "or";
}

const withoutJoin = (filter: ContractRecord): ContractRecord => {
  const copy = { ...filter };
  Reflect.deleteProperty(copy, "joinOperator");
  return copy;
};

const envelopeOf = (
  filters: ContractRecord[],
  joinOperator: "and" | "or"
): FacetFilters => ({
  filters:
    joinOperator === "or"
      ? filters.map((filter) => ({ ...filter, joinOperator }))
      : filters.map(withoutJoin),
  joinOperator,
});

/**
 * Whether clicks can change a facet: its rule must be required with the
 * others, so not while the view matches any of several rules (OR).
 */
export function canToggleFacet(
  advancedFilters: unknown,
  facet: Pick<FacetColumn, "id" | "kind">
): boolean {
  const envelope = normalizeFilterEnvelope(advancedFilters);
  if (envelope.joinOperator !== "or") {
    return true;
  }
  const own = ownRuleIndex(envelope.filters, facet);
  return !envelope.filters.some(
    (filter, index) => filter.isActive !== false && index !== own
  );
}

/**
 * The view's filters with a value toggled: the facet's rule gains or loses
 * the value and goes when none is left. `null` stands for "No value": it
 * replaces the values with `isEmpty`, and a value replaces "No value". The
 * other rules stay as they are and every rule is required (AND).
 */
export function toggleFacetValue(
  advancedFilters: unknown,
  facet: Pick<FacetColumn, "id" | "kind" | "operator" | "type">,
  value: unknown,
  stamp: string = String(Date.now())
): FacetFilters {
  const envelope = normalizeFilterEnvelope(advancedFilters);
  const own = ownRuleIndex(envelope.filters, facet);
  const rule = envelope.filters[own];
  const selection = facetSelection(envelope, facet);
  const key = facetValueKey(value);
  let empty = false;
  let values = selection.values;
  if (key === FACET_EMPTY_KEY) {
    empty = !selection.empty;
    values = [];
  } else if (values.some((item) => facetValueKey(item) === key)) {
    values = values.filter((item) => facetValueKey(item) !== key);
  } else {
    values = [...values, value];
  }
  const base = {
    ...(rule ?? {}),
    id: rule?.id ?? `facet-${facet.id}-${stamp}`,
    columnId: facet.id,
    type: facet.type,
    isActive: true,
  };
  let next: ContractRecord | undefined;
  if (empty) {
    next = { ...base, operator: "isEmpty", values: [] };
  } else if (values.length) {
    next = { ...base, operator: facet.operator, values };
  }
  const filters = envelope.filters.flatMap((filter, index) => {
    if (index !== own) {
      return [filter];
    }
    return next ? [next] : [];
  });
  if (next && own < 0) {
    filters.push(next);
  }
  return envelopeOf(filters, "and");
}

/** The view's filters without these facets' own rules (a facet's "Clear", "Clear all"). */
export function clearFacets(
  advancedFilters: unknown,
  facets: readonly Pick<FacetColumn, "id" | "kind">[]
): FacetFilters {
  const envelope = normalizeFilterEnvelope(advancedFilters);
  const owned = new Set(
    facets.map((facet) => ownRuleIndex(envelope.filters, facet))
  );
  return envelopeOf(
    envelope.filters.filter((_filter, index) => !owned.has(index)),
    envelope.joinOperator
  );
}

// Counts --------------------------------------------------------------------------

/**
 * The query a facet's counts answer: the view's query without the facet's
 * own rule, so every value shows how many records choosing it would add.
 */
export function facetCountParams(
  params: ContractRecord,
  facet: Pick<FacetColumn, "id" | "kind">
): ContractRecord {
  const envelope = normalizeFilterEnvelope(params.advancedFilters);
  const own = ownRuleIndex(envelope.filters, facet);
  const rest = { ...params };
  Reflect.deleteProperty(rest, "advancedFilterJoin");
  return {
    ...rest,
    advancedFilters: {
      filters: envelope.filters
        .filter((filter, index) => index !== own && filter.isActive !== false)
        .map(withoutJoin),
      joinOperator: envelope.joinOperator,
    },
  };
}

/** What a facet asks `actions.aggregate` for: its column's groups, counted. */
export const facetAggregateRequest = (
  facet: Pick<FacetColumn, "id">
): ChartAggregateRequest => ({
  groupBy: [{ columnId: facet.id }],
  metrics: [{ fn: "count" }],
  weekStartsOn: 1,
});

/**
 * Parameters of `actions.aggregate` for a facet's counts: the view's query
 * without the facet's own rule, grouped by the facet's column and counted,
 * as charts ask (`groupBy`, `metrics`, empty `calculations`).
 */
export const facetAggregateParams = (
  params: ContractRecord,
  facet: Pick<FacetColumn, "id" | "kind">,
  locale: string
): ContractRecord =>
  chartAggregateParams(
    facetCountParams(params, facet),
    facetAggregateRequest(facet),
    locale
  );

/** A facet's numbers of records. */
export interface FacetCounts {
  /** Records by value key (`facetValueKey`), "No value" under `FACET_EMPTY_KEY`. */
  counts: Record<string, number>;
  /** Each counted value as the records hold it, by key. */
  values: Record<string, unknown>;
  /** Counted over part of the records only (the first rows loaded). */
  truncated: boolean;
  /** `server` when `actions.aggregate` answered. */
  source: "client" | "server";
}

const folderValue = (value: unknown): unknown => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as ContractRecord;
    return record.id ?? record._id ?? null;
  }
  return value;
};

/** The values a record holds for a facet (a list's items, a folder's id). */
export function facetRowValues(
  row: unknown,
  facet: Pick<FacetColumn, "id" | "kind">
): unknown[] {
  const value = recordValue(row)[facet.id];
  if (facet.kind === "folder") {
    return [folderValue(value)];
  }
  const items = Array.isArray(value) ? value : [value];
  return items.length ? items : [null];
}

/** Counts of a facet's values over rows: a list counts in each of its values. */
export function countFacetValues(
  rows: readonly unknown[],
  facet: Pick<FacetColumn, "id" | "kind">
): Pick<FacetCounts, "counts" | "values"> {
  const counts: Record<string, number> = {};
  const values: Record<string, unknown> = {};
  for (const row of rows) {
    const keys = new Set<string>();
    for (const value of facetRowValues(row, facet)) {
      const key = facetValueKey(value);
      if (!keys.has(key)) {
        keys.add(key);
        counts[key] = (counts[key] ?? 0) + 1;
        values[key] ??= key === FACET_EMPTY_KEY ? null : value;
      }
    }
  }
  return { counts, values };
}

/** Counts from an aggregate answer holding groups; undefined otherwise. */
export function facetCountsFromAggregate(
  answer: unknown
): Pick<FacetCounts, "counts" | "truncated" | "values"> | undefined {
  const result = normalizeChartAggregateResult(answer);
  if (!result?.groups.every((group) => group.values.length >= 1)) {
    return;
  }
  const counts: Record<string, number> = {};
  const values: Record<string, unknown> = {};
  for (const group of result.groups) {
    const value = folderValue(group.keys[0] ?? null);
    const key = facetValueKey(value);
    counts[key] = (counts[key] ?? 0) + (group.values[0] ?? 0);
    values[key] ??= key === FACET_EMPTY_KEY ? null : value;
  }
  return { counts, values, truncated: result.truncated === true };
}

export interface FacetCountsRequest {
  facets: readonly FacetColumn[];
  /** The view's query as list parameters (search, filters, advancedFilters). */
  params: ContractRecord;
  /** `actions.aggregate`; asked first, one request per facet. */
  aggregate?: (params: ContractRecord) => unknown;
  /** `actions.list`, to count loaded rows when there is no aggregate answer. */
  list?: ScopedRowsRequest["list"];
  /** Every row, for tables without a list action. */
  rows?: readonly unknown[];
  /** Applies a query to `rows` (tables without a list action). */
  filterRows?: (
    rows: readonly unknown[],
    params: ContractRecord
  ) => readonly unknown[];
  locale: string;
  /** Rows loaded at most per query without an aggregate answer (2,000). */
  maxRows?: number;
  signal?: AbortSignal;
}

async function serverCounts(
  request: FacetCountsRequest,
  facet: FacetColumn
): Promise<FacetCounts | undefined> {
  if (!request.aggregate) {
    return;
  }
  try {
    const answer = facetCountsFromAggregate(
      await request.aggregate(
        facetAggregateParams(request.params, facet, request.locale)
      )
    );
    return answer ? { ...answer, source: "server" } : undefined;
  } catch {
    // Hosts that reject grouped requests fall back to loaded rows.
    return;
  }
}

/**
 * Each facet's counts: `actions.aggregate` first (grouped by the column,
 * counted, as charts ask), otherwise the rows `list` returns for the query
 * without the facet's own rule (at most `maxRows`, `truncated` beyond), or the
 * table's own rows. Facets sharing a query share one load.
 */
export async function loadFacetCounts(
  request: FacetCountsRequest
): Promise<Record<string, FacetCounts>> {
  const results: Record<string, FacetCounts> = {};
  const answers = await Promise.all(
    request.facets.map((facet) => serverCounts(request, facet))
  );
  request.signal?.throwIfAborted();
  const pending = new Map<string, FacetColumn[]>();
  for (const [index, facet] of request.facets.entries()) {
    const answer = answers[index];
    if (answer) {
      results[facet.id] = answer;
      continue;
    }
    const key = JSON.stringify(facetCountParams(request.params, facet));
    pending.set(key, [...(pending.get(key) ?? []), facet]);
  }
  for (const facets of pending.values()) {
    const first = facets[0];
    if (!first) {
      continue;
    }
    const params = facetCountParams(request.params, first);
    const local = request.list
      ? undefined
      : (request.filterRows?.(request.rows ?? [], params) ??
        request.rows ??
        []);
    const loaded = await loadScopedRows({
      list: request.list,
      rows: local,
      params,
      maxRows: request.maxRows ?? FACETS_MAX_ROWS,
      signal: request.signal,
    });
    for (const facet of facets) {
      results[facet.id] = {
        ...countFacetValues(loaded.rows, facet),
        truncated: loaded.truncated,
        source: "client",
      };
    }
  }
  return results;
}

/**
 * The groups of a facet over rows, as `actions.aggregate` answers them: an
 * in-memory host can answer facet requests with it (or with
 * `aggregateChartRows`, which it wraps).
 */
export const aggregateFacetRows = (
  rows: readonly unknown[],
  facet: Pick<FacetColumn, "id">
) => aggregateChartRows(rows, facetAggregateRequest(facet));

// Entries -------------------------------------------------------------------------

/** A value a facet lists. */
export interface FacetEntry {
  /** `facetValueKey(value)`; `FACET_EMPTY_KEY` for "No value". */
  key: string;
  /** The value a click writes; `null` for "No value". */
  value: unknown;
  label: string;
  /** Secondary text, such as a folder's location. */
  detail?: string;
  /** Records with this value; undefined while counts load. */
  count?: number;
  selected: boolean;
  /** The "No value" entry. */
  empty: boolean;
}

/** A folder's name and location, for folder facets. */
export interface FacetFolderLabel {
  label: string;
  detail?: string;
  /** Its place in the tree, to list folders in the tree's order. */
  order?: number;
}

export interface FacetEntriesInput {
  counts?: Pick<FacetCounts, "counts" | "values">;
  selection: FacetSelection;
  locale: string;
  /** List values without records (default false). */
  showZero?: boolean;
  /** Names and locations of folders (folder facets). */
  folderLabel?: (id: string) => FacetFolderLabel | undefined;
  translate?: FacetTranslate;
}

const collator = (locale: string) =>
  new Intl.Collator(locale, { numeric: true, sensitivity: "base" });

function sortEntries(
  entries: FacetEntry[],
  facet: Pick<FacetColumn, "kind" | "options" | "sort">,
  locale: string,
  order: (entry: FacetEntry) => number
): FacetEntry[] {
  const compare = collator(locale).compare;
  const byLabel = (left: FacetEntry, right: FacetEntry) =>
    compare(left.label, right.label);
  const byCount = (left: FacetEntry, right: FacetEntry) =>
    (right.count ?? 0) - (left.count ?? 0) || byLabel(left, right);
  const optionIndex = new Map(
    facet.options.map((option, index) => [facetValueKey(option.value), index])
  );
  const byOption = (left: FacetEntry, right: FacetEntry) => {
    const a = optionIndex.get(left.key) ?? Number.POSITIVE_INFINITY;
    const b = optionIndex.get(right.key) ?? Number.POSITIVE_INFINITY;
    return a === b ? byCount(left, right) : a - b;
  };
  const byOrder = (left: FacetEntry, right: FacetEntry) =>
    order(left) - order(right) || byLabel(left, right);
  let compareEntries = byCount;
  if (facet.kind === "folder") {
    compareEntries = byOrder;
  } else if (facet.sort === "label") {
    compareEntries = byLabel;
  } else if (facet.sort === "options") {
    compareEntries = byOption;
  }
  return [...entries].sort(compareEntries);
}

/** The values a facet may list: options, counted values, selected values. */
function facetCandidates(
  facet: Pick<FacetColumn, "options">,
  counts: FacetEntriesInput["counts"],
  selection: FacetSelection
): Map<string, unknown> {
  const candidates = new Map<string, unknown>();
  for (const option of facet.options) {
    candidates.set(facetValueKey(option.value), option.value);
  }
  for (const [key, value] of Object.entries(counts?.values ?? {})) {
    if (key !== FACET_EMPTY_KEY && !candidates.has(key)) {
      candidates.set(key, value);
    }
  }
  for (const value of selection.values) {
    const key = facetValueKey(value);
    if (!candidates.has(key)) {
      candidates.set(key, value);
    }
  }
  return candidates;
}

/** "No value" (folders: "Root"), when records lack a value or it is selected. */
function emptyFacetEntry(
  facet: Pick<FacetColumn, "kind" | "showEmpty">,
  input: FacetEntriesInput
): FacetEntry | undefined {
  const count = input.counts
    ? (input.counts.counts[FACET_EMPTY_KEY] ?? 0)
    : undefined;
  const shown =
    input.selection.empty ||
    (count !== undefined && (count > 0 || input.showZero === true));
  if (!(facet.showEmpty && shown)) {
    return;
  }
  return {
    key: FACET_EMPTY_KEY,
    value: null,
    label: facetLabel(
      facet.kind === "folder" ? "root" : "noValue",
      input.locale,
      input.translate
    ),
    ...(count === undefined ? {} : { count }),
    selected: input.selection.empty,
    empty: true,
  };
}

/**
 * The values a facet lists: its options and the values records hold, with
 * their counts, those without records left out (unless selected or
 * `showZero`), in the facet's order, "No value" last.
 */
export function facetEntries(
  facet: FacetColumn,
  input: FacetEntriesInput
): FacetEntry[] {
  const { counts, selection } = input;
  const selected = new Set(selection.values.map(facetValueKey));
  const orders = new Map<string, number>();
  const entries: FacetEntry[] = [];
  for (const [key, value] of facetCandidates(facet, counts, selection)) {
    const count = counts ? (counts.counts[key] ?? 0) : undefined;
    const isSelected = selected.has(key);
    const listed =
      isSelected || count === undefined || count > 0 || input.showZero;
    if (!listed) {
      continue;
    }
    const option = facet.options.find(
      (item) => facetValueKey(item.value) === key
    );
    const folder =
      facet.kind === "folder" ? input.folderLabel?.(key) : undefined;
    orders.set(key, folder?.order ?? Number.POSITIVE_INFINITY);
    entries.push({
      key,
      value: option?.value ?? value,
      label: option?.label ?? folder?.label ?? String(value),
      ...(folder?.detail ? { detail: folder.detail } : {}),
      ...(count === undefined ? {} : { count }),
      selected: isSelected,
      empty: false,
    });
  }
  const sorted = sortEntries(
    entries,
    facet,
    input.locale,
    (entry) => orders.get(entry.key) ?? Number.POSITIVE_INFINITY
  );
  const empty = emptyFacetEntry(facet, input);
  return empty ? [...sorted, empty] : sorted;
}

const DIACRITICS = /\p{M}/gu;
/** Case and accents aside, for searching values. */
export const foldFacetText = (text: string): string =>
  text.normalize("NFD").replace(DIACRITICS, "").toLocaleLowerCase();

/**
 * The entries shown: those matching a search (label or location), else the
 * first `limit` ones and every selected one until "Show more".
 */
export function visibleFacetEntries(
  entries: readonly FacetEntry[],
  options: { limit: number; expanded?: boolean; query?: string }
): { entries: FacetEntry[]; hidden: number } {
  const query = foldFacetText(options.query?.trim() ?? "");
  if (query) {
    const found = entries.filter((entry) =>
      foldFacetText(`${entry.label} ${entry.detail ?? ""}`).includes(query)
    );
    return { entries: found, hidden: 0 };
  }
  if (options.expanded || entries.length <= options.limit) {
    return { entries: [...entries], hidden: 0 };
  }
  const shown = entries.filter(
    (entry, index) => index < options.limit || entry.selected
  );
  return { entries: shown, hidden: entries.length - shown.length };
}

/** Whether a facet offers a search field: when its values do not all show at once. */
export const facetSearchable = (
  entries: readonly FacetEntry[],
  limit: number
): boolean => entries.length > limit;

/**
 * The value focused after a key in a facet's list (arrows, Home, End), or
 * undefined for keys the list leaves alone.
 */
export function facetKeyTarget(
  key: string,
  index: number,
  count: number
): number | undefined {
  if (count <= 0) {
    return;
  }
  switch (key) {
    case "ArrowDown":
      return Math.min(count - 1, index + 1);
    case "ArrowUp":
      return Math.max(0, index - 1);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return;
  }
}

/** Facets with something selected. */
export const selectedFacetCount = (
  advancedFilters: unknown,
  facets: readonly Pick<FacetColumn, "id" | "kind">[]
): number =>
  facets.filter((facet) =>
    hasFacetSelection(facetSelection(advancedFilters, facet))
  ).length;

// Labels --------------------------------------------------------------------------

const EN_LABELS = {
  title: "Filters",
  show: "Show the filters panel",
  hide: "Hide the filters panel",
  toggle: "Filters panel",
  clear: "Clear",
  clearFacet: "Clear {facet}",
  clearAll: "Clear all",
  noValue: "No value",
  root: "Root",
  yes: "Yes",
  no: "No",
  loading: "Counting…",
  error: "The counts could not load.",
  retry: "Retry",
  truncated: "Counts cover the first {count} records.",
  showMore: "Show {count} more",
  showLess: "Show less",
  search: "Search {facet}",
  noMatches: "No values",
  anyJoin:
    "The filters match any condition. Match all conditions to use the facets.",
  close: "Close",
  records: "{count} records",
  oneRecord: "1 record",
} as const;

export type FacetLabelKey = keyof typeof EN_LABELS;

const FR_LABELS: Record<FacetLabelKey, string> = {
  title: "Filtres",
  show: "Afficher le panneau des filtres",
  hide: "Masquer le panneau des filtres",
  toggle: "Panneau des filtres",
  clear: "Effacer",
  clearFacet: "Effacer {facet}",
  clearAll: "Tout effacer",
  noValue: "Aucune valeur",
  root: "Racine",
  yes: "Oui",
  no: "Non",
  loading: "Calcul…",
  error: "Les nombres n’ont pas pu être chargés.",
  retry: "Réessayer",
  truncated: "Nombres calculés sur les {count} premiers enregistrements.",
  showMore: "Afficher {count} de plus",
  showLess: "Afficher moins",
  search: "Rechercher dans {facet}",
  noMatches: "Aucune valeur",
  anyJoin:
    "Les filtres correspondent à l’une des conditions. Choisissez toutes les conditions pour utiliser les facettes.",
  close: "Fermer",
  records: "{count} enregistrements",
  oneRecord: "1 enregistrement",
};

export type FacetTranslate = (key: string, fallback: string) => string;

const PLACEHOLDER = /\{(\w+)\}/g;

/** A facet label in the table's language; hosts override it with `facets.<key>`. */
export function facetLabel(
  key: FacetLabelKey,
  locale: string,
  translate?: FacetTranslate,
  params: Record<string, number | string> = {}
): string {
  const french = locale.toLowerCase().startsWith("fr");
  let fallback: string = french ? FR_LABELS[key] : EN_LABELS[key];
  if (key === "noValue") {
    fallback = emptyGroupLabel(locale);
  }
  const text = translate ? translate(key, fallback) : fallback;
  return text.replace(PLACEHOLDER, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}

/** "12 records", in the table's language, for a value's accessible name. */
export const facetCountText = (
  count: number,
  locale: string,
  translate?: FacetTranslate
): string =>
  count === 1
    ? facetLabel("oneRecord", locale, translate)
    : facetLabel("records", locale, translate, {
        count: count.toLocaleString(locale),
      });
