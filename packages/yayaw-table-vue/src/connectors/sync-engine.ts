/**
 * Two-way sync engine between a table and an external target (a Notion
 * database, a Google Sheets tab). It is pure: it compares records the host
 * read on both sides with the per-row state the host stored after the last
 * run, plans the writes, and applies them through adapters the host provides.
 * It never reads credentials, never persists anything and never logs.
 *
 * Values are keyed by table column id on both sides; provider reads translate
 * target fields back to column ids through the mapping. Rows are linked by
 * the key field ("Yayaw ID"), which holds the table row id in the target.
 *
 * A run is `read → planSync → applySyncPlan → save result.state`.
 */
import {
  ConnectorError,
  type ConnectorErrorCode,
  DEFAULT_CONNECTOR_KEY,
  isFatalConnectorError,
  MAX_REPORTED_ISSUES,
} from "./connector-model";

export type SyncDirection = "push" | "pull" | "two-way";
export type ConflictRule = "table-wins" | "target-wins" | "latest-wins";
export type DeletePolicy = "ignore" | "flag" | "propagate";
export type SyncSide = "table" | "target";

export const SYNC_DIRECTIONS: readonly SyncDirection[] = [
  "push",
  "pull",
  "two-way",
];
export const CONFLICT_RULES: readonly ConflictRule[] = [
  "table-wins",
  "target-wins",
  "latest-wins",
];
export const DELETE_POLICIES: readonly DeletePolicy[] = [
  "ignore",
  "flag",
  "propagate",
];
export const DEFAULT_CONFLICT_RULE: ConflictRule = "table-wins";
export const DEFAULT_DELETE_POLICY: DeletePolicy = "flag";
/** Records one adapter call receives at most. */
export const DEFAULT_SYNC_BATCH_SIZE = 50;
/** Prefix of the remote id of a sheet row that has no key yet. */
export const SHEET_ROW_ID_PREFIX = "row:";

const WHITESPACE = /\s+/g;
const DECIMAL_NUMBER = /^[-+]?(\d+(\.\d*)?|\.\d+)(e[-+]?\d+)?$/i;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i;
const TRUE_WORDS = new Set(["true", "yes", "y", "on", "1", "oui", "vrai"]);
const FALSE_WORDS = new Set(["false", "no", "n", "off", "0", "non", "faux"]);
const NUMBER_TYPES = new Set(["number", "currency", "percent", "rating"]);
const BOOLEAN_TYPES = new Set(["boolean", "checkbox", "switch"]);
const DATE_TYPES = new Set(["date", "datetime"]);
const OPTIONS_TYPES = new Set(["multiSelect", "multi_select", "tags"]);
const TRIMMED_TYPES = new Set([
  "select",
  "status",
  "url",
  "email",
  "phone",
  "phone_number",
]);
/** Errors after which every other write of the run would fail too. */
const STOP_ITEM_CODES = new Set<string>([
  "aborted",
  "api_disabled",
  "forbidden",
  "invalid_credentials",
  "not_shared",
  "unauthorized",
]);

// Model --------------------------------------------------------------------------

/** A canonical value: what two sides are compared on and what state stores. */
export type SyncValue = string | number | boolean | string[] | null;

/** One mapped column: the table column, the target field and its type. */
export interface SyncField {
  columnId: string;
  /** Notion property name or sheet header. */
  field: string;
  /** Table column type (`number`, `date`, `boolean`, `multiSelect`, …). */
  type?: string;
}

export interface SyncMapping {
  fields: readonly SyncField[];
  /** Target field holding the table row id, "Yayaw ID" by default. */
  keyField?: string;
}

/**
 * A record of either side. On the table side `id` is the row id; on the
 * target side it is the remote id (a Notion page id, a sheet key or
 * `row:<number>`) and `key` is the value of the key field, when set.
 * `values` are keyed by column id; a column missing from `values` is
 * unknown on that side and is neither compared nor written from it.
 */
export interface SyncRecord {
  id: string;
  key?: string;
  /** ISO time of the last change, used by `latest-wins`. */
  updatedAt?: string;
  values: Record<string, unknown>;
}

/** Per-row state the host stores between runs. */
export interface SyncLink {
  /** Values both sides agreed on at the last sync, for three-way merges. */
  baseValues?: Record<string, SyncValue>;
  remoteId: string;
  rowId: string;
  syncedAt: string;
  tableHash: string;
  targetHash: string;
}

/** What the host stores per destination and view. */
export interface SyncState {
  lastSyncAt?: string;
  links: SyncLink[];
}

export const EMPTY_SYNC_STATE: SyncState = { links: [] };

// Normalization --------------------------------------------------------------------

function isBlank(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  );
}

const compareText = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).sort(([left], [right]) =>
      compareText(left, right)
    );
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** The text a cell shows, the way the providers write it. */
function textOf(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => !isBlank(item))
      .map(textOf)
      .join(", ");
  }
  return typeof value === "object" ? stableJson(value) : String(value);
}

const withoutNegativeZero = (value: number): number =>
  value === 0 ? 0 : value;

function normalizeNumber(value: unknown): SyncValue {
  if (typeof value === "number") {
    return Number.isFinite(value) ? withoutNegativeZero(value) : null;
  }
  const compact = textOf(value).replace(WHITESPACE, "");
  if (compact === "") {
    return null;
  }
  // Text that is not a number stays text, so a change remains visible.
  return DECIMAL_NUMBER.test(compact)
    ? withoutNegativeZero(Number(compact))
    : compact;
}

const isoOrNull = (date: Date): string | null =>
  Number.isNaN(date.getTime()) ? null : date.toISOString();

function normalizeDate(value: unknown): SyncValue {
  if (value instanceof Date) {
    return isoOrNull(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? isoOrNull(new Date(value)) : null;
  }
  const text = textOf(value).trim();
  if (text === "" || DATE_ONLY.test(text)) {
    return text || null;
  }
  // Only times with an offset are unambiguous; other text is kept as is.
  return ISO_DATE_TIME.test(text) ? (isoOrNull(new Date(text)) ?? text) : text;
}

function normalizeBoolean(value: unknown): SyncValue {
  if (typeof value === "boolean") {
    return value;
  }
  // Notion checkboxes and empty cells have no "unset" state.
  if (isBlank(value)) {
    return false;
  }
  const word = textOf(value).trim().toLowerCase();
  if (TRUE_WORDS.has(word)) {
    return true;
  }
  return FALSE_WORDS.has(word) ? false : word;
}

function normalizeOptions(value: unknown): SyncValue {
  const items = Array.isArray(value)
    ? value.map(textOf)
    : textOf(value).split(",");
  const names = [
    ...new Set(items.map((item) => item.trim()).filter(Boolean)),
  ].sort(compareText);
  return names.length > 0 ? names : null;
}

function normalizeText(value: unknown, trim: boolean): SyncValue {
  if (isBlank(value)) {
    return null;
  }
  const text = textOf(value);
  return trim ? text.trim() : text;
}

/**
 * The canonical form of a value for a table column type, so a round trip
 * through Notion or Sheets never looks like a change:
 *
 * - empty (`null`, `undefined`, blank text, `[]`) is `null`, except booleans,
 *   where empty is `false`;
 * - numbers parse from text (`" 1.50 "` is `1.5`); other text stays text;
 * - dates keep date-only values (`2024-01-05`) and turn times with an offset
 *   into UTC ISO text; `Date` objects and epoch milliseconds too;
 * - booleans accept `true`/`false` and yes/no words;
 * - multi-selects become sorted, unique, trimmed names (from arrays or
 *   comma-separated text);
 * - select, status, url and email are trimmed text; other types are text.
 */
export function normalizeSyncValue(value: unknown, type?: string): SyncValue {
  const kind = type ?? "text";
  if (NUMBER_TYPES.has(kind)) {
    return normalizeNumber(value);
  }
  if (DATE_TYPES.has(kind)) {
    return normalizeDate(value);
  }
  if (BOOLEAN_TYPES.has(kind)) {
    return normalizeBoolean(value);
  }
  if (OPTIONS_TYPES.has(kind)) {
    return normalizeOptions(value);
  }
  return normalizeText(value, TRIMMED_TYPES.has(kind));
}

/** Whether two canonical values are equal. */
export function syncValuesEqual(left: SyncValue, right: SyncValue): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((item, index) => item === right[index])
    );
  }
  return left === right;
}

/** The canonical values of the mapped columns a record has. */
export function normalizeSyncValues(
  values: Record<string, unknown>,
  fields: readonly SyncField[]
): Record<string, SyncValue> {
  const normalized = new Map<string, SyncValue>();
  for (const field of fields) {
    if (Object.hasOwn(values, field.columnId)) {
      normalized.set(
        field.columnId,
        normalizeSyncValue(values[field.columnId], field.type)
      );
    }
  }
  return Object.fromEntries(normalized);
}

// Two independent polynomial hashes modulo primes below 2^32 keep every
// intermediate value exact in a double without bitwise operators.
const HASH_PRIMES = [4_294_967_291, 4_294_967_279] as const;
const HASH_MULTIPLIERS = [257, 65_599] as const;
const HASH_HEX_LENGTH = 8;
const HEX_RADIX = 16;

function polynomialHash(text: string, prime: number, multiplier: number) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * multiplier + text.charCodeAt(index) + 1) % prime;
  }
  return hash.toString(HEX_RADIX).padStart(HASH_HEX_LENGTH, "0");
}

/**
 * A stable fingerprint of a record's mapped values: independent of key order
 * and of representation (see `normalizeSyncValue`). Columns missing from
 * `values` hash as empty.
 */
export function hashSyncValues(
  values: Record<string, unknown>,
  fields: readonly SyncField[]
): string {
  const entries = [...fields]
    .sort((left, right) => compareText(left.columnId, right.columnId))
    .map((field) => [
      field.columnId,
      Object.hasOwn(values, field.columnId)
        ? normalizeSyncValue(values[field.columnId], field.type)
        : null,
    ]);
  const text = JSON.stringify(entries);
  return HASH_PRIMES.map((prime, index) =>
    polynomialHash(text, prime, HASH_MULTIPLIERS[index] ?? 1)
  ).join("");
}

/**
 * A sync mapping from the connector screen settings (`keyField`, `mapping`
 * entries with `field: null` for skipped columns) and the table columns,
 * whose types drive normalization.
 */
export function toSyncMapping(
  settings: {
    keyField?: string;
    mapping: readonly { columnId: string; field: string | null }[];
  },
  columns: readonly { id: string; type?: string }[] = []
): SyncMapping {
  const types = new Map(columns.map((column) => [column.id, column.type]));
  const fields: SyncField[] = [];
  for (const entry of settings.mapping) {
    if (entry.field) {
      const type = types.get(entry.columnId);
      fields.push({
        columnId: entry.columnId,
        field: entry.field,
        ...(type ? { type } : {}),
      });
    }
  }
  return { keyField: settings.keyField ?? DEFAULT_CONNECTOR_KEY, fields };
}

// Plan -------------------------------------------------------------------------

/** Identifies the pair of records an operation belongs to. */
type Ref = string;

export interface SyncCreateInTarget {
  key: string;
  ref: Ref;
  rowId: string;
  values: Record<string, unknown>;
}

export interface SyncCreateInTable {
  /**
   * The target record's key, when it has one. When the table creates the row
   * under another id, the new id is written back to the target's key field.
   */
  key?: string;
  ref: Ref;
  remoteId: string;
  values: Record<string, unknown>;
}

export interface SyncUpdate {
  /** Columns written, the ones in `values`. */
  columns: string[];
  /** The key the target record must hold (the table row id). */
  key: string;
  ref: Ref;
  remoteId: string;
  rowId: string;
  values: Record<string, unknown>;
}

export interface SyncSetKey {
  key: string;
  ref: Ref;
  remoteId: string;
  rowId: string;
}

export interface SyncDelete {
  ref: Ref;
  remoteId: string;
  rowId: string;
}

export interface SyncFlag extends SyncDelete {
  /** The side where the record disappeared. */
  deletedIn: SyncSide;
}

export interface SyncConflict {
  baseValue?: SyncValue;
  columnId: string;
  field: string;
  ref: Ref;
  remoteId: string;
  rowId: string;
  tableValue: SyncValue;
  targetValue: SyncValue;
  winner: SyncSide;
}

/** Records sharing a key: none of them is synced until it is fixed. */
export interface SyncDuplicate {
  /** Record ids on that side. */
  ids: string[];
  key: string;
  side: SyncSide;
}

/** What the next state holds for one pair of records. */
export interface SyncPlanEntry {
  action: "drop" | "keep" | "link";
  previous?: SyncLink;
  ref: Ref;
  remoteId?: string;
  rowId?: string;
  /** Canonical values both sides hold once the pair's operations succeed. */
  values?: Record<string, SyncValue>;
}

export interface SyncPlan {
  conflictRule: ConflictRule;
  conflicts: SyncConflict[];
  createInTable: SyncCreateInTable[];
  createInTarget: SyncCreateInTarget[];
  deleteInTable: SyncDelete[];
  deleteInTarget: SyncDelete[];
  deletePolicy: DeletePolicy;
  direction: SyncDirection;
  duplicates: SyncDuplicate[];
  entries: SyncPlanEntry[];
  fields: SyncField[];
  flagged: SyncFlag[];
  keyField: string;
  setKeyInTarget: SyncSetKey[];
  /** Records left alone because the direction cannot write their other side. */
  skipped: number;
  storeBaseValues: boolean;
  syncedAt: string;
  unchanged: number;
  updateInTable: SyncUpdate[];
  updateInTarget: SyncUpdate[];
}

export interface PlanSyncInput {
  conflictRule?: ConflictRule;
  deletePolicy?: DeletePolicy;
  direction: SyncDirection;
  mapping: SyncMapping;
  now?: Date | number | string;
  state?: SyncState | null;
  /** Keep `baseValues` in links for per-field merges (default true). */
  storeBaseValues?: boolean;
  tableRecords: readonly SyncRecord[];
  /**
   * True when `targetRecords` only holds records changed since a time (a
   * `since` read): a linked record that is missing is unchanged, not deleted.
   */
  targetPartial?: boolean;
  targetRecords: readonly SyncRecord[];
}

interface Pair {
  assumed: boolean;
  link?: SyncLink;
  ref: Ref;
  table?: SyncRecord;
  target?: SyncRecord;
}

interface PlanContext {
  fields: readonly SyncField[];
  input: PlanSyncInput;
  plan: SyncPlan;
  rule: ConflictRule;
}

const canWrite = (direction: SyncDirection, side: SyncSide): boolean =>
  direction === "two-way" || (side === "target") === (direction === "push");

const recordKey = (record: SyncRecord, side: SyncSide): string =>
  (side === "table" ? (record.key ?? record.id) : (record.key ?? "")).trim();

function isoTime(now: PlanSyncInput["now"]): string {
  const date = now === undefined ? new Date() : new Date(now);
  return Number.isNaN(date.getTime())
    ? new Date(0).toISOString()
    : date.toISOString();
}

function groupBy(
  records: readonly SyncRecord[],
  keyOf: (record: SyncRecord) => string
): Map<string, SyncRecord[]> {
  const groups = new Map<string, SyncRecord[]>();
  for (const record of records) {
    const key = keyOf(record);
    if (key) {
      groups.set(key, [...(groups.get(key) ?? []), record]);
    }
  }
  return groups;
}

interface SideIndex {
  /** Ids of records excluded because of a duplicate id or key. */
  blocked: Set<string>;
  blockedKeys: Set<string>;
  byId: Map<string, SyncRecord>;
  byKey: Map<string, SyncRecord>;
}

function blockRecord(index: SideIndex, id: string, key: string) {
  index.blocked.add(id);
  if (key) {
    index.blockedKeys.add(key);
  }
}

function addRecord(index: SideIndex, record: SyncRecord, key: string) {
  index.byId.set(record.id, record);
  if (key) {
    index.byKey.set(key, record);
  }
}

function indexSide(
  records: readonly SyncRecord[],
  side: SyncSide,
  duplicates: SyncDuplicate[]
): SideIndex {
  const index: SideIndex = {
    blocked: new Set(),
    blockedKeys: new Set(),
    byId: new Map(),
    byKey: new Map(),
  };
  const byKey = groupBy(records, (record) => recordKey(record, side));
  for (const [key, group] of byKey) {
    if (group.length > 1) {
      duplicates.push({ side, key, ids: group.map((record) => record.id) });
      index.blockedKeys.add(key);
    }
  }
  for (const [id, group] of groupBy(records, (record) => record.id)) {
    const [record] = group;
    const key = record ? recordKey(record, side) : "";
    const repeated = group.length > 1;
    // A repeated id that is also a repeated key was reported above.
    if (repeated && (byKey.get(id)?.length ?? 0) < 2) {
      duplicates.push({ side, key: id, ids: group.map(() => id) });
    }
    if (repeated || index.blockedKeys.has(key)) {
      blockRecord(index, id, key);
    } else if (record) {
      addRecord(index, record, key);
    }
  }
  return index;
}

function emptyPlan(input: PlanSyncInput): SyncPlan {
  return {
    direction: input.direction,
    conflictRule: input.conflictRule ?? DEFAULT_CONFLICT_RULE,
    deletePolicy: input.deletePolicy ?? DEFAULT_DELETE_POLICY,
    fields: [...input.mapping.fields],
    keyField: input.mapping.keyField ?? DEFAULT_CONNECTOR_KEY,
    storeBaseValues: input.storeBaseValues ?? true,
    syncedAt: isoTime(input.now),
    createInTarget: [],
    updateInTarget: [],
    setKeyInTarget: [],
    createInTable: [],
    updateInTable: [],
    deleteInTarget: [],
    deleteInTable: [],
    flagged: [],
    conflicts: [],
    duplicates: [],
    entries: [],
    skipped: 0,
    unchanged: 0,
  };
}

interface Claims {
  rows: Set<string>;
  targets: Set<string>;
}

function linkedTarget(
  link: SyncLink,
  target: SideIndex,
  claims: Claims
): SyncRecord | undefined {
  const byId = target.byId.get(link.remoteId);
  if (byId && !claims.targets.has(byId.id)) {
    return byId;
  }
  // A sheet row that got its key since the last run changed its remote id.
  const byKey = target.byKey.get(link.rowId);
  return byKey && !claims.targets.has(byKey.id) ? byKey : undefined;
}

function isBlockedLink(link: SyncLink, table: SideIndex, target: SideIndex) {
  return (
    table.blocked.has(link.rowId) ||
    target.blocked.has(link.remoteId) ||
    target.blockedKeys.has(link.rowId)
  );
}

function linkedPairs(
  links: readonly SyncLink[],
  table: SideIndex,
  target: SideIndex,
  claims: Claims,
  partial: boolean
): { kept: SyncLink[]; pairs: Pair[] } {
  const pairs: Pair[] = [];
  const kept: SyncLink[] = [];
  for (const link of links) {
    if (claims.rows.has(link.rowId)) {
      continue;
    }
    claims.rows.add(link.rowId);
    if (isBlockedLink(link, table, target)) {
      kept.push(link);
      continue;
    }
    const targetRecord = linkedTarget(link, target, claims);
    if (targetRecord) {
      claims.targets.add(targetRecord.id);
    }
    pairs.push({
      ref: `link:${link.rowId}`,
      link,
      table: table.byId.get(link.rowId),
      target: targetRecord,
      assumed: !targetRecord && partial,
    });
  }
  return { pairs, kept };
}

function unlinkedPairs(
  tableRecords: readonly SyncRecord[],
  targetRecords: readonly SyncRecord[],
  table: SideIndex,
  target: SideIndex,
  claims: Claims
): Pair[] {
  const pairs: Pair[] = [];
  for (const record of tableRecords) {
    if (claims.rows.has(record.id) || table.blocked.has(record.id)) {
      continue;
    }
    claims.rows.add(record.id);
    const key = recordKey(record, "table");
    if (target.blockedKeys.has(key)) {
      continue;
    }
    const match = target.byKey.get(key);
    const adopted = match && !claims.targets.has(match.id) ? match : undefined;
    if (adopted) {
      claims.targets.add(adopted.id);
    }
    pairs.push({
      ref: `row:${record.id}`,
      table: record,
      target: adopted,
      assumed: false,
    });
  }
  for (const record of targetRecords) {
    const excluded =
      claims.targets.has(record.id) ||
      target.blocked.has(record.id) ||
      table.blockedKeys.has(recordKey(record, "target"));
    if (!excluded) {
      claims.targets.add(record.id);
      pairs.push({
        ref: `remote:${record.id}`,
        target: record,
        assumed: false,
      });
    }
  }
  return pairs;
}

function resolveConflict(
  context: PlanContext,
  table: SyncRecord,
  target: SyncRecord
): SyncSide {
  if (context.rule === "table-wins") {
    return "table";
  }
  if (context.rule === "target-wins") {
    return "target";
  }
  const tableTime = Date.parse(table.updatedAt ?? "");
  const targetTime = Date.parse(target.updatedAt ?? "");
  // Without both times, or on a tie, the table wins.
  return Number.isFinite(tableTime) &&
    Number.isFinite(targetTime) &&
    targetTime > tableTime
    ? "target"
    : "table";
}

type FieldChange = SyncSide | "both";

interface PairChanges {
  table: boolean;
  target: boolean;
}

function changedSide(tableChanged: boolean, targetChanged: boolean) {
  if (tableChanged === targetChanged) {
    return "both";
  }
  return tableChanged ? "table" : "target";
}

function fieldChange(
  link: SyncLink | undefined,
  columnId: string,
  values: { table: SyncValue; target: SyncValue },
  changes: PairChanges | undefined
): FieldChange {
  if (link?.baseValues && Object.hasOwn(link.baseValues, columnId)) {
    const base = link.baseValues[columnId] ?? null;
    return changedSide(
      !syncValuesEqual(values.table, base),
      !syncValuesEqual(values.target, base)
    );
  }
  return changes ? changedSide(changes.table, changes.target) : "both";
}

interface MergeResult {
  merged: Record<string, SyncValue>;
  toTable: Record<string, unknown>;
  toTarget: Record<string, unknown>;
}

function pairChanges(
  context: PlanContext,
  pair: Pair,
  table: SyncRecord,
  target: SyncRecord
): PairChanges | undefined {
  if (!pair.link) {
    return;
  }
  return {
    table: hashSyncValues(table.values, context.fields) !== pair.link.tableHash,
    target:
      !pair.assumed &&
      hashSyncValues(target.values, context.fields) !== pair.link.targetHash,
  };
}

function fieldWinner(
  context: PlanContext,
  pair: Pair,
  field: SyncField,
  values: { table: SyncValue; target: SyncValue },
  records: { changes?: PairChanges; table: SyncRecord; target: SyncRecord }
): SyncSide {
  const { direction } = context.input;
  if (direction !== "two-way") {
    return direction === "push" ? "table" : "target";
  }
  const change = fieldChange(
    pair.link,
    field.columnId,
    values,
    records.changes
  );
  if (change !== "both") {
    return change;
  }
  const winner = resolveConflict(context, records.table, records.target);
  const baseValue = pair.link?.baseValues?.[field.columnId];
  context.plan.conflicts.push({
    ref: pair.ref,
    rowId: records.table.id,
    remoteId: records.target.id,
    columnId: field.columnId,
    field: field.field,
    tableValue: values.table,
    targetValue: values.target,
    ...(baseValue === undefined ? {} : { baseValue }),
    winner,
  });
  return winner;
}

function mergeRecords(
  context: PlanContext,
  pair: Pair,
  table: SyncRecord,
  target: SyncRecord
): MergeResult {
  const result: MergeResult = { merged: {}, toTable: {}, toTarget: {} };
  const records = {
    table,
    target,
    changes: pairChanges(context, pair, table, target),
  };
  for (const field of context.fields) {
    const id = field.columnId;
    const inTable = Object.hasOwn(table.values, id);
    const inTarget = Object.hasOwn(target.values, id);
    const values = {
      table: normalizeSyncValue(table.values[id], field.type),
      target: normalizeSyncValue(target.values[id], field.type),
    };
    if (!(inTable && inTarget)) {
      if (inTable || inTarget) {
        result.merged[id] = inTable ? values.table : values.target;
      }
    } else if (syncValuesEqual(values.table, values.target)) {
      result.merged[id] = values.table;
    } else if (fieldWinner(context, pair, field, values, records) === "table") {
      result.merged[id] = values.table;
      result.toTarget[id] = table.values[id];
    } else {
      result.merged[id] = values.target;
      result.toTable[id] = target.values[id];
    }
  }
  return result;
}

/** The target side of a pair missing from a partial read: its last state. */
function assumedTarget(pair: Pair): SyncRecord {
  const link = pair.link;
  if (link?.baseValues) {
    return { id: link.remoteId, key: link.rowId, values: link.baseValues };
  }
  // Without base values, an unchanged table row means an unchanged pair, and
  // a changed one overwrites every column of the (unchanged) target.
  return { id: link?.remoteId ?? "", key: link?.rowId, values: {} };
}

function assumedMerge(
  context: PlanContext,
  pair: Pair,
  table: SyncRecord
): MergeResult {
  const merged = normalizeSyncValues(table.values, context.fields);
  const changed =
    hashSyncValues(table.values, context.fields) !== pair.link?.tableHash;
  const toTarget: Record<string, unknown> = {};
  if (changed && context.input.direction !== "pull") {
    for (const field of context.fields) {
      if (Object.hasOwn(table.values, field.columnId)) {
        toTarget[field.columnId] = table.values[field.columnId];
      }
    }
  }
  return { merged, toTable: {}, toTarget };
}

const hasKeys = (values: Record<string, unknown>) =>
  Object.keys(values).length > 0;

function planPairWrites(
  context: PlanContext,
  pair: Pair,
  table: SyncRecord,
  target: SyncRecord,
  result: MergeResult
): boolean {
  const { plan } = context;
  const key = recordKey(table, "table");
  const base = { ref: pair.ref, rowId: table.id, remoteId: target.id };
  let writes = false;
  if (hasKeys(result.toTarget)) {
    const columns = Object.keys(result.toTarget);
    plan.updateInTarget.push({
      ...base,
      key,
      columns,
      values: result.toTarget,
    });
    writes = true;
  } else if (!pair.assumed && recordKey(target, "target") !== key) {
    plan.setKeyInTarget.push({ ...base, key });
    writes = true;
  }
  if (hasKeys(result.toTable)) {
    const columns = Object.keys(result.toTable);
    plan.updateInTable.push({ ...base, key, columns, values: result.toTable });
    writes = true;
  }
  return writes;
}

function sameLink(
  context: PlanContext,
  link: SyncLink,
  remoteId: string,
  hash: string
): boolean {
  return (
    link.remoteId === remoteId &&
    link.tableHash === hash &&
    link.targetHash === hash &&
    Boolean(link.baseValues) === context.plan.storeBaseValues
  );
}

function planMatchedPair(
  context: PlanContext,
  pair: Pair,
  table: SyncRecord,
  targetRecord: SyncRecord | undefined
) {
  const target = targetRecord ?? assumedTarget(pair);
  const useAssumed = pair.assumed && !pair.link?.baseValues;
  const result = useAssumed
    ? assumedMerge(context, pair, table)
    : mergeRecords(context, pair, table, target);
  const writes = planPairWrites(context, pair, table, target, result);
  const hash = hashSyncValues(result.merged, context.fields);
  const unchangedLink =
    !writes && pair.link && sameLink(context, pair.link, target.id, hash);
  if (!writes) {
    context.plan.unchanged += 1;
  }
  context.plan.entries.push({
    ref: pair.ref,
    previous: pair.link,
    action: unchangedLink ? "keep" : "link",
    rowId: table.id,
    remoteId: target.id,
    values: result.merged,
  });
}

function planDeletion(context: PlanContext, pair: Pair, link: SyncLink) {
  const { plan } = context;
  const deletedIn: SyncSide = pair.table ? "target" : "table";
  const survivor: SyncSide = deletedIn === "table" ? "target" : "table";
  const remoteId = pair.target?.id ?? link.remoteId;
  const item = { ref: pair.ref, rowId: link.rowId, remoteId };
  const propagate =
    plan.deletePolicy === "propagate" && canWrite(plan.direction, survivor);
  if (propagate) {
    plan[survivor === "table" ? "deleteInTable" : "deleteInTarget"].push(item);
    plan.entries.push({ ref: pair.ref, previous: link, action: "drop" });
    return;
  }
  if (plan.deletePolicy !== "ignore") {
    plan.flagged.push({ ...item, deletedIn });
  }
  plan.entries.push({ ref: pair.ref, previous: link, action: "keep" });
}

function planCreation(context: PlanContext, pair: Pair) {
  const { plan, fields } = context;
  const record = pair.table ?? pair.target;
  if (!record) {
    return;
  }
  const side: SyncSide = pair.table ? "target" : "table";
  if (!canWrite(plan.direction, side)) {
    plan.skipped += 1;
    return;
  }
  const values = normalizeSyncValues(record.values, fields);
  const raw = Object.fromEntries(
    fields
      .filter((field) => Object.hasOwn(record.values, field.columnId))
      .map((field) => [field.columnId, record.values[field.columnId]])
  );
  if (side === "target") {
    const key = recordKey(record, "table");
    plan.createInTarget.push({
      ref: pair.ref,
      rowId: record.id,
      key,
      values: raw,
    });
    plan.entries.push({
      ref: pair.ref,
      action: "link",
      rowId: record.id,
      values,
    });
    return;
  }
  const key = recordKey(record, "target");
  plan.createInTable.push({
    ref: pair.ref,
    remoteId: record.id,
    ...(key ? { key } : {}),
    values: raw,
  });
  plan.entries.push({
    ref: pair.ref,
    action: "link",
    remoteId: record.id,
    values,
  });
}

function planPair(context: PlanContext, pair: Pair) {
  const { link, table, target } = pair;
  const hasTarget = Boolean(target) || pair.assumed;
  if (table && hasTarget) {
    planMatchedPair(context, pair, table, target);
  } else if (link && (table || hasTarget)) {
    planDeletion(context, pair, link);
  } else if (link) {
    // Gone on both sides: forget the link.
    context.plan.entries.push({
      ref: pair.ref,
      previous: link,
      action: "drop",
    });
  } else {
    planCreation(context, pair);
  }
}

/**
 * Plans one sync run. Linked records are merged per column against the
 * values both sides held at the last run (`baseValues`), or per record with
 * the stored hashes when there are none: a column changed on one side goes
 * to the other; a column changed on both is a conflict resolved by
 * `conflictRule`. `push` makes the target mirror the table and `pull` the
 * reverse, for linked records and new ones; neither reports conflicts.
 * Unlinked records are matched by key before anything is created, records
 * sharing a key are reported and left alone, and a record deleted on one side
 * is handled by `deletePolicy`.
 */
export function planSync(input: PlanSyncInput): SyncPlan {
  const plan = emptyPlan(input);
  const context: PlanContext = {
    input,
    plan,
    fields: plan.fields,
    rule: plan.conflictRule,
  };
  const table = indexSide(input.tableRecords, "table", plan.duplicates);
  const target = indexSide(input.targetRecords, "target", plan.duplicates);
  const claims: Claims = { rows: new Set(), targets: new Set() };
  const linked = linkedPairs(
    input.state?.links ?? [],
    table,
    target,
    claims,
    input.targetPartial ?? false
  );
  for (const link of linked.kept) {
    plan.entries.push({
      ref: `link:${link.rowId}`,
      previous: link,
      action: "keep",
    });
  }
  const pairs = [
    ...linked.pairs,
    ...unlinkedPairs(
      input.tableRecords,
      input.targetRecords,
      table,
      target,
      claims
    ),
  ];
  for (const pair of pairs) {
    planPair(context, pair);
  }
  return plan;
}

export interface SyncPlanSummary {
  /** Writes the plan makes, all operations together. */
  changes: number;
  conflicts: number;
  createInTable: number;
  createInTarget: number;
  deleteInTable: number;
  deleteInTarget: number;
  duplicates: number;
  flagged: number;
  setKeyInTarget: number;
  skipped: number;
  unchanged: number;
  updateInTable: number;
  updateInTarget: number;
}

/** Counts for a preview ("3 to create, 1 conflict…"). */
export function summarizeSyncPlan(plan: SyncPlan): SyncPlanSummary {
  const counts = {
    createInTarget: plan.createInTarget.length,
    updateInTarget: plan.updateInTarget.length,
    setKeyInTarget: plan.setKeyInTarget.length,
    createInTable: plan.createInTable.length,
    updateInTable: plan.updateInTable.length,
    deleteInTarget: plan.deleteInTarget.length,
    deleteInTable: plan.deleteInTable.length,
  };
  return {
    ...counts,
    changes: Object.values(counts).reduce((total, count) => total + count, 0),
    conflicts: plan.conflicts.length,
    duplicates: plan.duplicates.length,
    flagged: plan.flagged.length,
    skipped: plan.skipped,
    unchanged: plan.unchanged,
  };
}

// Next state -------------------------------------------------------------------

/** What `applySyncPlan` achieved, for `nextSyncState`. */
export interface SyncApplied {
  /** Pairs with an operation that did not succeed. */
  failed: ReadonlySet<string>;
  /** Remote ids returned by the target, by pair (creates, key write-backs). */
  remoteIds: ReadonlyMap<string, string>;
  /** Row ids returned by the table for records created in it, by pair. */
  rowIds: ReadonlyMap<string, string>;
}

const NOTHING_APPLIED: SyncApplied = {
  failed: new Set(),
  remoteIds: new Map(),
  rowIds: new Map(),
};

function nextLink(
  plan: SyncPlan,
  entry: SyncPlanEntry,
  applied: SyncApplied
): SyncLink | undefined {
  const rowId = entry.rowId ?? applied.rowIds.get(entry.ref);
  const remoteId = applied.remoteIds.get(entry.ref) ?? entry.remoteId;
  if (!(rowId && remoteId && entry.values)) {
    return entry.previous;
  }
  const hash = hashSyncValues(entry.values, plan.fields);
  return {
    rowId,
    remoteId,
    tableHash: hash,
    targetHash: hash,
    ...(plan.storeBaseValues ? { baseValues: entry.values } : {}),
    syncedAt: plan.syncedAt,
  };
}

function entryLink(
  plan: SyncPlan,
  entry: SyncPlanEntry,
  applied: SyncApplied
): SyncLink | undefined {
  if (entry.action === "keep" || applied.failed.has(entry.ref)) {
    return entry.previous;
  }
  return entry.action === "drop" ? undefined : nextLink(plan, entry, applied);
}

/**
 * The state after a run: links of pairs whose operations all succeeded are
 * updated, failed pairs keep their previous link (or none) so the next run
 * plans them again. Without `applied`, every operation is assumed applied.
 */
export function nextSyncState(
  plan: SyncPlan,
  applied: SyncApplied = NOTHING_APPLIED
): SyncState {
  const links: SyncLink[] = [];
  for (const entry of plan.entries) {
    const link = entryLink(plan, entry, applied);
    if (link) {
      links.push(link);
    }
  }
  return { links, lastSyncAt: plan.syncedAt };
}

// Apply ------------------------------------------------------------------------

export type SyncFailureCode = ConnectorErrorCode | "failed" | "unsupported";

/** One write sent to an adapter. */
export interface SyncWrite {
  /** Record id on the written side; absent for creates. */
  id?: string;
  /** Key field value (the table row id), for the target side. */
  key?: string;
  /** Values keyed by column id; only these columns are written. */
  values: Record<string, unknown>;
}

/** Outcome of one write, in the order of the items sent. */
export type SyncItemResult =
  | { id?: string; ok: true }
  | { code?: SyncFailureCode; ok: false };

/**
 * Writes one side. Each method receives a batch and returns one result per
 * item, in order: `create` returns the new id, `update` may return the
 * record's new id (a sheet row that got its key). Throwing fails the whole
 * batch; a `ConnectorError` with an authorization code stops the run.
 */
export interface SyncSideAdapter {
  create?(items: SyncWrite[]): Promise<readonly SyncItemResult[]>;
  delete?(ids: string[]): Promise<readonly SyncItemResult[]>;
  update?(items: SyncWrite[]): Promise<readonly SyncItemResult[]>;
}

export interface SyncAdapters {
  table?: SyncSideAdapter;
  target?: SyncSideAdapter;
}

export interface ApplySyncOptions {
  batchSize?: number;
  signal?: AbortSignal;
}

export type SyncOperation =
  | "createInTable"
  | "createInTarget"
  | "deleteInTable"
  | "deleteInTarget"
  | "setKeyInTarget"
  | "updateInTable"
  | "updateInTarget";

export interface SyncFailure {
  code: SyncFailureCode;
  operation: SyncOperation;
  ref: string;
  remoteId?: string;
  rowId?: string;
}

export interface SyncResult {
  applied: Record<SyncOperation, number>;
  /** Operations that did not succeed; they are planned again next run. */
  failed: number;
  /** The first 200 failures. */
  failures: SyncFailure[];
  /** The state to save: only successful changes are recorded. */
  state: SyncState;
  /** Set when an authorization error or the signal stopped the run. */
  stopped?: SyncFailureCode;
}

interface ApplyContext {
  batchSize: number;
  outcome: {
    failed: Set<string>;
    remoteIds: Map<string, string>;
    rowIds: Map<string, string>;
  };
  result: SyncResult;
  signal?: AbortSignal;
}

interface Operation {
  ref: string;
  remoteId?: string;
  rowId?: string;
  write: SyncWrite | string;
}

type BatchMethod = (items: never[]) => Promise<readonly SyncItemResult[]>;

const failure = (code: SyncFailureCode): SyncItemResult => ({
  ok: false,
  code,
});

const codeOf = (error: unknown): SyncFailureCode =>
  error instanceof ConnectorError ? error.code : "failed";

async function callBatch(
  method: BatchMethod,
  items: readonly (SyncWrite | string)[],
  context: ApplyContext
): Promise<SyncItemResult[]> {
  try {
    const results = await method(items as never[]);
    return items.map((_, index) => results[index] ?? failure("failed"));
  } catch (error) {
    const code = codeOf(error);
    if (isFatalConnectorError(code as ConnectorErrorCode)) {
      context.result.stopped = code;
    }
    return items.map(() => failure(code));
  }
}

function recordFailure(
  context: ApplyContext,
  operation: SyncOperation,
  item: Operation,
  code: SyncFailureCode
) {
  context.result.failed += 1;
  context.outcome.failed.add(item.ref);
  if (STOP_ITEM_CODES.has(code)) {
    context.result.stopped ??= code;
  }
  if (context.result.failures.length < MAX_REPORTED_ISSUES) {
    context.result.failures.push({
      operation,
      ref: item.ref,
      code,
      ...(item.rowId ? { rowId: item.rowId } : {}),
      ...(item.remoteId ? { remoteId: item.remoteId } : {}),
    });
  }
}

function isStopped(context: ApplyContext): boolean {
  if (context.signal?.aborted) {
    context.result.stopped ??= "aborted";
  }
  return context.result.stopped !== undefined;
}

/** Returns false when a successful write is still unusable (no id). */
type SuccessHandler = (item: Operation, id: string | undefined) => boolean;

async function batchResults(
  context: ApplyContext,
  batch: readonly Operation[],
  method: BatchMethod | undefined
): Promise<SyncItemResult[]> {
  if (!method) {
    return batch.map(() => failure("unsupported"));
  }
  if (isStopped(context)) {
    return batch.map(() => failure(context.result.stopped ?? "aborted"));
  }
  return await callBatch(
    method,
    batch.map((item) => item.write),
    context
  );
}

async function runOperation(
  context: ApplyContext,
  operation: SyncOperation,
  items: readonly Operation[],
  method: BatchMethod | undefined,
  onSuccess: SuccessHandler = () => true
) {
  for (let start = 0; start < items.length; start += context.batchSize) {
    const batch = items.slice(start, start + context.batchSize);
    // Batches run one after another: providers rate-limit writes.
    const results = await batchResults(context, batch, method);
    for (const [index, item] of batch.entries()) {
      const outcome = results[index] ?? failure("failed");
      if (outcome.ok && onSuccess(item, outcome.id)) {
        context.result.applied[operation] += 1;
      } else {
        const code = outcome.ok ? "failed" : (outcome.code ?? "failed");
        recordFailure(context, operation, item, code);
      }
    }
  }
}

const bound = (
  adapter: SyncSideAdapter | undefined,
  name: "create" | "delete" | "update"
): BatchMethod | undefined => {
  const method = adapter?.[name];
  return method?.bind(adapter);
};

function keyWriteBacks(plan: SyncPlan, context: ApplyContext): Operation[] {
  const writes: Operation[] = plan.setKeyInTarget.map((item) => ({
    ref: item.ref,
    rowId: item.rowId,
    remoteId: item.remoteId,
    write: { id: item.remoteId, key: item.key, values: {} },
  }));
  for (const item of plan.createInTable) {
    const rowId = context.outcome.rowIds.get(item.ref);
    if (rowId && rowId !== item.key) {
      writes.push({
        ref: item.ref,
        rowId,
        remoteId: item.remoteId,
        write: { id: item.remoteId, key: rowId, values: {} },
      });
    }
  }
  return writes;
}

async function writeKeys(
  plan: SyncPlan,
  adapters: SyncAdapters,
  context: ApplyContext
) {
  const method = bound(adapters.target, "update");
  const writes = keyWriteBacks(plan, context);
  // A target that cannot be updated keeps its records without a key; the
  // links still hold their remote ids.
  if (!method || writes.length === 0) {
    return;
  }
  const failed = new Set(context.outcome.failed);
  await runOperation(context, "setKeyInTarget", writes, method, (item, id) => {
    context.outcome.remoteIds.set(item.ref, id ?? item.remoteId ?? "");
    return true;
  });
  // A key that was not written is retried next run; the link stays valid.
  context.outcome.failed = failed;
}

const updateOperation = (item: SyncUpdate, side: SyncSide): Operation => ({
  ref: item.ref,
  rowId: item.rowId,
  remoteId: item.remoteId,
  write:
    side === "target"
      ? { id: item.remoteId, key: item.key, values: item.values }
      : { id: item.rowId, values: item.values },
});

const deleteOperation = (item: SyncDelete, side: SyncSide): Operation => ({
  ref: item.ref,
  rowId: item.rowId,
  remoteId: item.remoteId,
  write: side === "target" ? item.remoteId : item.rowId,
});

function emptyResult(): SyncResult {
  return {
    applied: {
      createInTarget: 0,
      updateInTarget: 0,
      setKeyInTarget: 0,
      createInTable: 0,
      updateInTable: 0,
      deleteInTarget: 0,
      deleteInTable: 0,
    },
    failed: 0,
    failures: [],
    state: EMPTY_SYNC_STATE,
  };
}

/**
 * Applies a plan through the adapters, in batches: creates and updates in the
 * target, creates in the table (writing the new row id back to target records
 * without a key), updates in the table, then deletions (last, so sheet row
 * numbers stay valid while rows are written). A failing record is recorded
 * and the run goes on; an authorization error or the signal stops it. The
 * returned state only records what succeeded, so a failure is retried next
 * run.
 */
export async function applySyncPlan(
  plan: SyncPlan,
  adapters: SyncAdapters,
  options: ApplySyncOptions = {}
): Promise<SyncResult> {
  const context: ApplyContext = {
    batchSize: Math.max(1, options.batchSize ?? DEFAULT_SYNC_BATCH_SIZE),
    signal: options.signal,
    result: emptyResult(),
    outcome: { failed: new Set(), remoteIds: new Map(), rowIds: new Map() },
  };
  const { outcome } = context;
  await runOperation(
    context,
    "createInTarget",
    plan.createInTarget.map((item) => ({
      ref: item.ref,
      rowId: item.rowId,
      write: { key: item.key, values: item.values },
    })),
    bound(adapters.target, "create"),
    (item, id) => {
      outcome.remoteIds.set(item.ref, id ?? item.rowId ?? "");
      return true;
    }
  );
  await runOperation(
    context,
    "updateInTarget",
    plan.updateInTarget.map((item) => updateOperation(item, "target")),
    bound(adapters.target, "update"),
    (item, id) => {
      if (id) {
        outcome.remoteIds.set(item.ref, id);
      }
      return true;
    }
  );
  await runOperation(
    context,
    "createInTable",
    plan.createInTable.map((item) => ({
      ref: item.ref,
      remoteId: item.remoteId,
      write: { ...(item.key ? { key: item.key } : {}), values: item.values },
    })),
    bound(adapters.table, "create"),
    (item, id) => {
      if (!id) {
        return false;
      }
      outcome.rowIds.set(item.ref, id);
      return true;
    }
  );
  await writeKeys(plan, adapters, context);
  await runOperation(
    context,
    "updateInTable",
    plan.updateInTable.map((item) => updateOperation(item, "table")),
    bound(adapters.table, "update")
  );
  await runOperation(
    context,
    "deleteInTarget",
    plan.deleteInTarget.map((item) => deleteOperation(item, "target")),
    bound(adapters.target, "delete")
  );
  await runOperation(
    context,
    "deleteInTable",
    plan.deleteInTable.map((item) => deleteOperation(item, "table")),
    bound(adapters.table, "delete")
  );
  context.result.state = nextSyncState(plan, outcome);
  return context.result;
}
