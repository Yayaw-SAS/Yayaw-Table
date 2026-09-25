/** Framework-independent adapters. Also copied into the standalone Vue registry. */
import { calendarDay } from "./date-filter-days";
import {
  formatLocation,
  locationValueError,
  matchesLocationFilter,
} from "./location-model";
import {
  type ColumnValueFormat,
  formatColumnValue,
  formatDateValue,
  parseDateValue,
} from "./value-format";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export type ContractRecord = Record<string, unknown>;
export type ContractColumnSizing = Record<string, number>;

/** One semantic declaration drives the built-in editors in both registries. */
export const TABLE_DATA_TYPES = {
  actions: { form: null, inline: null, filter: "text" },
  boolean: { form: "switch", inline: "boolean", filter: "select" },
  code: { form: "textarea", inline: "textarea", filter: "text" },
  custom: { form: null, inline: null, filter: "text" },
  date: { form: "date", inline: "date", filter: "date" },
  dynamicType: { form: null, inline: null, filter: "text" },
  image: { form: "url", inline: "url", filter: "text" },
  json: { form: "json", inline: "json", filter: "text" },
  location: { form: "location", inline: "location", filter: "location" },
  multiSelect: {
    form: "multiSelect",
    inline: "multiSelect",
    filter: "multiSelect",
  },
  number: { form: "number", inline: "number", filter: "number" },
  select: { form: "select", inline: "select", filter: "select" },
  string: { form: "text", inline: "text", filter: "text" },
  tag: { form: "select", inline: "select", filter: "select" },
  text: { form: "text", inline: "text", filter: "text" },
  url: { form: "url", inline: "url", filter: "text" },
} as const;

export type TableDataType = keyof typeof TABLE_DATA_TYPES;
export type DataTypeInlineEditor = NonNullable<
  (typeof TABLE_DATA_TYPES)[TableDataType]["inline"]
>;

export function resolveDataType(
  type?: string,
  row?: ContractRecord,
  typeKey = "type"
): TableDataType {
  const candidate =
    type === "dynamicType"
      ? String(row?.[typeKey] ?? "string")
      : (type ?? "string");
  return Object.hasOwn(TABLE_DATA_TYPES, candidate) &&
    candidate !== "dynamicType"
    ? (candidate as TableDataType)
    : "string";
}

/** Explicit editor overrides win; semantic JSON and array values must retain their shape. */
export function resolveDataTypeEditor({
  explicitEditor,
  columnType,
  formFieldType,
  hasOptions = false,
}: {
  explicitEditor?: string;
  columnType?: string;
  formFieldType?: string;
  hasOptions?: boolean;
}): DataTypeInlineEditor {
  if (explicitEditor && explicitEditor !== "auto") {
    return explicitEditor as DataTypeInlineEditor;
  }
  if (columnType === "multiSelect" || columnType === "json") {
    return columnType;
  }
  const fields: Record<string, DataTypeInlineEditor> = {
    checkbox: "boolean",
    switch: "boolean",
    date: "date",
    json: "json",
    location: "location",
    number: "number",
    select: "select",
    radio: "select",
    "select-with-add-new": "select",
    multiSelect: "multiSelect",
    textarea: "textarea",
    text: "text",
    url: "url",
  };
  return (
    fields[formFieldType ?? ""] ??
    (columnType && columnType !== "dynamicType"
      ? TABLE_DATA_TYPES[resolveDataType(columnType)].inline
      : undefined) ??
    (hasOptions ? "select" : "text")
  );
}

export interface DataTypeColumn {
  id: string;
  header: string;
  type?: string;
  typeKey?: string;
  accessorKey?: unknown;
  accessorFn?: unknown;
  options?: unknown;
}

/** Custom and computed values require a catalogue field describing how to edit them. */
export function generateDataTypeFields(
  columns: DataTypeColumn[],
  row?: ContractRecord,
  rows: ContractRecord[] = []
) {
  return columns.flatMap((column) => {
    if (
      column.type === "dynamicType" &&
      new Set(
        rows.map((item) => resolveDataType(column.type, item, column.typeKey))
      ).size > 1
    ) {
      return [];
    }
    const type =
      TABLE_DATA_TYPES[
        resolveDataType(column.type, { ...rows[0], ...row }, column.typeKey)
      ].form;
    if (
      !type ||
      ["select", "actions"].includes(column.id) ||
      column.accessorFn
    ) {
      return [];
    }
    return [
      {
        name:
          typeof column.accessorKey === "string"
            ? column.accessorKey
            : column.id,
        label: column.header,
        type,
        ...(type === "select" || type === "multiSelect"
          ? { options: column.options ?? [] }
          : {}),
      },
    ];
  });
}

/** Preserve incomplete JSON until validation, without confusing a JSON string with source text. */
const JSON_FORM_DRAFT = Symbol.for("yayaw-table.json-form-draft");
export const jsonFormDraft = (text: string) => ({
  [JSON_FORM_DRAFT]: true as const,
  text,
});
export const isJsonFormDraft = (
  value: unknown
): value is ReturnType<typeof jsonFormDraft> => {
  const record = recordValue(value);
  return (
    (record as Record<symbol, unknown>)[JSON_FORM_DRAFT] === true &&
    typeof record.text === "string"
  );
};
export function jsonFormText(value: unknown): string {
  if (isJsonFormDraft(value)) {
    return value.text;
  }
  return value === undefined ? "" : JSON.stringify(value, null, 2);
}
export const parseJsonFormValue = (value: unknown): unknown =>
  isJsonFormDraft(value) ? JSON.parse(value.text) : value;

/** Density labels preserve the existing configuration values in both editions. */
export const TABLE_DENSITY_OPTIONS = [
  { label: "XS", value: "extra-small" },
  { label: "S", value: "small" },
  { label: "M", value: "medium" },
  { label: "L", value: "large" },
  { label: "XL", value: "extra-large" },
  { label: "2XL", value: "extra-extra-large" },
] as const;

export type TableDensity = (typeof TABLE_DENSITY_OPTIONS)[number]["value"];

/** Dimensions are multiples of Tailwind's default spacing unit (0.25rem). */
export const TABLE_DENSITY_METRICS = {
  "extra-small": {
    rowHeight: 7,
    controlHeight: 6,
    paddingX: 1.5,
    paddingY: 0.5,
  },
  small: { rowHeight: 8, controlHeight: 6, paddingX: 2, paddingY: 1 },
  medium: { rowHeight: 10, controlHeight: 7, paddingX: 2, paddingY: 1.5 },
  large: { rowHeight: 12, controlHeight: 8, paddingX: 2.5, paddingY: 2 },
  "extra-large": {
    rowHeight: 14,
    controlHeight: 9,
    paddingX: 3,
    paddingY: 2.5,
  },
  "extra-extra-large": {
    rowHeight: 16,
    controlHeight: 10,
    paddingX: 4,
    paddingY: 3,
  },
} as const satisfies Record<
  TableDensity,
  {
    rowHeight: number;
    controlHeight: number;
    paddingX: number;
    paddingY: number;
  }
>;

export function isTableDensity(value: unknown): value is TableDensity {
  return TABLE_DENSITY_OPTIONS.some((option) => option.value === value);
}

const DEFAULT_COLUMN_RESIZE_STEP = 10;

/** Keep persisted column widths finite, positive, and scoped to known columns. */
export function normalizeColumnSizing(
  value: unknown,
  allowedColumnIds?: readonly string[]
): ContractColumnSizing {
  const allowed = allowedColumnIds ? new Set(allowedColumnIds) : undefined;
  const normalized: ContractColumnSizing = {};
  for (const [columnId, width] of Object.entries(recordValue(value))) {
    const numericWidth = Number(width);
    if (
      (!allowed || allowed.has(columnId)) &&
      Number.isFinite(numericWidth) &&
      numericWidth > 0
    ) {
      normalized[columnId] = Math.round(numericWidth);
    }
  }
  return normalized;
}

/** Resolve the keyboard resize commands shared by the React and Vue headers. */
export function resizedColumnSizeFromKey({
  key,
  maxSize,
  minSize,
  size,
  step = DEFAULT_COLUMN_RESIZE_STEP,
}: {
  key: string;
  maxSize: number;
  minSize: number;
  size: number;
  step?: number;
}): number | undefined {
  let nextSize: number;
  switch (key) {
    case "ArrowLeft":
      nextSize = size - step;
      break;
    case "ArrowRight":
      nextSize = size + step;
      break;
    case "Home":
      nextSize = minSize;
      break;
    case "End":
      nextSize = maxSize;
      break;
    default:
      return undefined;
  }
  return Math.min(maxSize, Math.max(minSize, nextSize));
}

export function recordValue(value: unknown): ContractRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ContractRecord)
    : {};
}

/** Read both historical arrays and the Vue filter envelope without losing OR semantics. */
export function normalizeFilterEnvelope(value: unknown): {
  filters: ContractRecord[];
  joinOperator: "and" | "or";
} {
  const envelope = recordValue(value);
  const candidates = Array.isArray(value) ? value : envelope.filters;
  const filters = Array.isArray(candidates)
    ? candidates
        .map(recordValue)
        .filter(
          (filter) =>
            typeof filter.columnId === "string" &&
            typeof filter.operator === "string"
        )
    : [];
  const joinOperator =
    envelope.joinOperator === "or" || filters[0]?.joinOperator === "or"
      ? "or"
      : "and";
  return {
    filters: filters.map((filter) => ({
      ...filter,
      isActive: filter.isActive !== false,
      ...(joinOperator === "or" ? { joinOperator } : {}),
    })),
    joinOperator,
  };
}

/** Supply both editions' existing list parameter names to unchanged application handlers. */
export function compatibleListParams(input: ContractRecord): ContractRecord {
  const pageSize = positiveInteger(input.pageSize ?? input.limit, 10);
  const sorting = Array.isArray(input.sorting)
    ? input.sorting
    : Object.entries(recordValue(input.orderBy)).map(([id, direction]) => ({
        id,
        desc: direction === "desc",
      }));
  const orderBy = Object.fromEntries(
    sorting.map((item) => {
      const sort = recordValue(item);
      return [String(sort.id), sort.desc ? "desc" : "asc"];
    })
  );
  const search = String(input.search ?? input.q ?? input.globalSearch ?? "");
  const advanced = normalizeFilterEnvelope(input.advancedFilters);
  return {
    ...input,
    page: positiveInteger(input.page, 1),
    limit: pageSize,
    pageSize,
    orderBy,
    sorting,
    search,
    q: search,
    globalSearch: search,
    filters: recordValue(input.filters),
    advancedFilters: advanced.filters.filter(
      (filter) => filter.isActive !== false
    ),
    advancedFilterJoin: input.advancedFilterJoin ?? advanced.joinOperator,
    grouping: Array.isArray(input.grouping) ? input.grouping : [],
  };
}

export function positiveInteger(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? Math.max(1, Math.trunc(number))
    : fallback;
}

/** Object keys in order, so `{ id, desc }` and `{ desc, id }` compare equal. */
const orderedKeys = (_key: string, value: unknown): unknown =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value).sort(([left], [right]) => (left < right ? -1 : 1))
      )
    : value;

/**
 * A search, filters or a sort in a form that compares. Equal keys are the
 * same query, so the table keeps its page: absent and empty match, a search
 * matches without its surrounding spaces, objects whatever their key order.
 */
export function tableQueryKey(value: unknown): string {
  const comparable = typeof value === "string" ? value.trim() : value;
  const isEmpty =
    comparable === undefined ||
    comparable === null ||
    comparable === "" ||
    (Array.isArray(comparable) && comparable.length === 0);
  return isEmpty ? "" : JSON.stringify(comparable, orderedKeys);
}

/** Collect every result using the server's pagination metadata, including capped page sizes. */
export async function fetchAllContractRows<T>({
  list,
  params,
  maxPages = 1000,
}: {
  list: (params: ContractRecord) => Promise<{
    data: T[];
    meta?: { pageCount?: number; totalCount?: number };
  }>;
  params: ContractRecord;
  maxPages?: number;
}): Promise<T[]> {
  const request = compatibleListParams(params);
  const rows: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const result = await list({ ...request, page });
    rows.push(...result.data);
    const pageCount = result.meta?.pageCount;
    const totalCount = result.meta?.totalCount;
    const hasPageCount = Number.isFinite(pageCount) && (pageCount ?? 0) > 0;
    const hasTotalCount =
      Number.isFinite(totalCount) && (totalCount ?? -1) >= 0;
    if (
      (hasPageCount && page >= (pageCount ?? 0)) ||
      (hasTotalCount && rows.length >= (totalCount ?? 0)) ||
      (!(hasPageCount || hasTotalCount) &&
        result.data.length < Number(request.pageSize))
    ) {
      return rows;
    }
    if (!result.data.length) {
      throw new Error(
        "The list action returned an empty page before all matching rows were loaded."
      );
    }
  }
  throw new Error(
    "Too many pages to load all matching rows. Narrow the filters and try again."
  );
}

/** Canonical saved-view names are React's; legacy Vue names remain readable. */
export function normalizeViewAliases(value: unknown): ContractRecord {
  const view = recordValue(value);
  return {
    ...view,
    columnFilters: view.columnFilters ?? view.filters ?? [],
    globalSearch: view.globalSearch ?? view.search ?? "",
    columnPinning: view.columnPinning ??
      view.pinning ?? { left: [], right: [] },
    grouping:
      view.grouping ??
      (recordValue(view.kanban).groupBy
        ? [recordValue(view.kanban).groupBy]
        : []),
  };
}

/** Match the shared operators before either framework renders the filtered rows. */
export function matchesContractFilter(
  actual: unknown,
  filter: ContractRecord
): boolean {
  const values = Array.isArray(filter.values) ? filter.values : [filter.values];
  const items = Array.isArray(actual) ? actual : [actual];
  const empty =
    actual == null ||
    actual === "" ||
    (Array.isArray(actual) && !actual.length);
  const typed = matchesTypedFilter(actual, filter, values);
  if (typed !== undefined) {
    return typed;
  }
  if (filter.operator === "isEmpty") {
    return empty;
  }
  if (filter.operator === "isNotEmpty") {
    return !empty;
  }
  if (
    [
      "greaterThan",
      "greaterThanOrEqual",
      "lessThan",
      "lessThanOrEqual",
      "between",
    ].includes(String(filter.operator))
  ) {
    return (
      !empty &&
      matchesNumberFilter(
        Number(actual),
        String(filter.operator),
        values.map(Number)
      )
    );
  }
  const textual = ["text", "string"].includes(String(filter.type));
  const text = String(actual ?? "").toLocaleLowerCase();
  const expected = String(values[0] ?? "").toLocaleLowerCase();
  const contains = (item: unknown) =>
    items.some((value) => String(value) === String(item));
  switch (filter.operator) {
    case "isTrue":
      return actual === true;
    case "isFalse":
      return actual === false;
    case "is":
    case "equals":
      return textual ? text === expected : values.some(contains);
    case "isNot":
    case "notEquals":
      return textual ? text !== expected : !values.some(contains);
    case "isAnyOf":
    case "in":
      return values.some(contains);
    case "isNoneOf":
    case "notIn":
    case "containsNone":
      return !values.some(contains);
    case "containsAll":
      return values.every(contains);
    case "contains":
      return Array.isArray(actual)
        ? values.some(contains)
        : text.includes(expected);
    case "notContains":
      return Array.isArray(actual)
        ? !values.some(contains)
        : !text.includes(expected);
    case "startsWith":
      return text.startsWith(expected);
    case "endsWith":
      return text.endsWith(expected);
    default:
      return true;
  }
}

/** Dates and places have their own operators; undefined for the other types. */
function matchesTypedFilter(
  actual: unknown,
  filter: ContractRecord,
  values: unknown[]
): boolean | undefined {
  if (filter.type === "date") {
    return matchesDateFilter(actual, filter.operator, values);
  }
  if (filter.type === "location") {
    return matchesLocationFilter(actual, filter.operator, filter.values);
  }
  return;
}

/**
 * Date rules compare calendar days: the record's day in the viewer's time
 * zone (a `YYYY-MM-DD` value is that day) against the rule's days (older
 * instants read as the viewer's days). `between` includes both days, in
 * either order.
 */
function matchesDateFilter(
  actual: unknown,
  operator: unknown,
  values: unknown[]
): boolean {
  const day = calendarDay(actual);
  if (operator === "isEmpty" || operator === "isNotEmpty") {
    return operator === "isEmpty" ? day === undefined : day !== undefined;
  }
  const first = calendarDay(values[0]);
  if (!(day && first)) {
    return false;
  }
  switch (operator) {
    case "equals":
      return day === first;
    case "notEquals":
      return day !== first;
    case "before":
    case "lessThan":
      return day < first;
    case "after":
    case "greaterThan":
      return day > first;
    case "greaterThanOrEqual":
      return day >= first;
    case "lessThanOrEqual":
      return day <= first;
    case "between": {
      const last = calendarDay(values[1] ?? values[0]);
      if (!last) {
        return false;
      }
      return last < first
        ? day >= last && day <= first
        : day >= first && day <= last;
    }
    default:
      return true;
  }
}

function matchesNumberFilter(
  actual: number,
  operator: string,
  values: number[]
): boolean {
  switch (operator) {
    case "greaterThan":
      return actual > (values[0] ?? Number.NaN);
    case "greaterThanOrEqual":
      return actual >= (values[0] ?? Number.NaN);
    case "lessThan":
      return actual < (values[0] ?? Number.NaN);
    case "lessThanOrEqual":
      return actual <= (values[0] ?? Number.NaN);
    default:
      return (
        actual >= (values[0] ?? Number.NaN) &&
        actual <= (values[1] ?? Number.NaN)
      );
  }
}

/** Resolve labels with strict primitive identity, preserving unknown stored choices. */
export function dataTypeOptionLabel(value: unknown, options?: unknown): string {
  const option = Array.isArray(options)
    ? options.find((item) => Object.is(item.value, value))
    : undefined;
  return option?.label ?? String(value ?? "");
}

/** What a column says about showing its values as text. */
export interface FieldTextColumn extends ColumnValueFormat {
  options?: unknown;
  typeKey?: string;
}

const matchingOption = (value: unknown, options: unknown) =>
  Array.isArray(options)
    ? (options as ContractRecord[]).find((item) =>
        Object.is(item?.value, value)
      )
    : undefined;

/**
 * A field's value as one line of text — titles, group and lane names, labels
 * read aloud: option labels, numbers and dates in the column's format and the
 * table locale, places by name. Empty values give "".
 */
export function fieldText(
  value: unknown,
  column: FieldTextColumn | undefined,
  locale?: string,
  row?: ContractRecord
): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => fieldText(item, column, locale, row))
      .filter(Boolean)
      .join(", ");
  }
  const option = matchingOption(value, column?.options);
  if (option) {
    return String(option.label ?? option.value ?? "");
  }
  if (value === null || value === undefined || value === "") {
    return "";
  }
  const type = column
    ? resolveDataType(column.type, row, column.typeKey)
    : undefined;
  const formatted = formatColumnValue(
    value,
    column && { ...column, type },
    locale
  );
  if (formatted !== undefined) {
    return formatted;
  }
  if (type === "location") {
    return formatLocation(value);
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

/**
 * Group headings use accessor values and option labels, never aggregated
 * IDs; with the column, numbers and dates read in its format.
 */
export function groupedValueLabel(
  value: unknown,
  options?: unknown,
  format?: { column?: FieldTextColumn; locale?: string }
): string {
  if (format?.column) {
    return fieldText(
      value,
      { ...format.column, options: options ?? format.column.options },
      format.locale
    );
  }
  return Array.isArray(value)
    ? value.map((item) => dataTypeOptionLabel(item, options)).join(", ")
    : dataTypeOptionLabel(value, options);
}

const YEAR_MONTH_GROUP_KEY = /^\d{4}-\d{2}$/;

/** A record's group key: `""` groups the records without a value. */
export function groupValueKey(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

/**
 * The heading of the group of records without a value, in Kanban lanes and
 * list and gallery sections alike.
 */
export function emptyGroupLabel(locale?: string): string {
  return locale?.toLowerCase().startsWith("fr") ? "Aucune valeur" : "No value";
}

/**
 * Date columns group by calendar month, whatever their accessor: the key is
 * the local `YYYY-MM` of the value, or `""` when it is not a date.
 */
export function dateGroupKey(value: unknown): string {
  const date = parseDateValue(value);
  if (!date) {
    return "";
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * A group heading: date columns read their month key as the month's name;
 * other columns read the value like `groupedValueLabel`.
 */
export function groupHeadingLabel(
  groupingValue: unknown,
  value: unknown,
  column: FieldTextColumn | undefined,
  locale?: string
): string {
  if (
    column?.type === "date" &&
    typeof groupingValue === "string" &&
    YEAR_MONTH_GROUP_KEY.test(groupingValue)
  ) {
    return formatDateValue(`${groupingValue}-01`, {
      preset: "month-year",
      locale,
    });
  }
  return groupedValueLabel(value, column?.options, { column, locale });
}

/** Count and select records, excluding synthetic rows at every grouping depth. */
export function groupedLeafRows<
  T extends { getIsGrouped: () => boolean; subRows: T[] },
>(row: T): T[] {
  return row.getIsGrouped() ? row.subRows.flatMap(groupedLeafRows) : [row];
}

export function dataTypeFilter(type?: string, hasOptions = false) {
  if (!type) {
    return hasOptions ? "select" : "text";
  }
  return TABLE_DATA_TYPES[resolveDataType(type)].filter;
}

export const optionControlKey = (value: unknown): string =>
  JSON.stringify([typeof value, value]);
export function optionControlValue(key: string): unknown {
  try {
    return JSON.parse(key)[1];
  } catch {
    return key;
  }
}

/** Date-only inputs use local calendar components, never a UTC conversion. */
export function dataTypeDateInput(value: unknown): string {
  if (value == null || value === "") {
    return "";
  }
  if (typeof value === "string" && DATE_ONLY_PATTERN.test(value)) {
    return value;
  }
  const date =
    value instanceof Date ? value : new Date(value as string | number);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Structural validation applies even when the application does not supply a schema. */
export function dataTypeValueError(
  type: string,
  value: unknown
): string | undefined {
  if (value == null || value === "") {
    return;
  }
  if (type === "location") {
    return locationValueError(value);
  }
  if (
    type === "number" &&
    (typeof value !== "number" || !Number.isFinite(value))
  ) {
    return "Expected a valid number";
  }
  if (
    ["boolean", "switch", "checkbox"].includes(type) &&
    typeof value !== "boolean"
  ) {
    return "Expected a boolean";
  }
  if (
    type === "multiSelect" &&
    (!Array.isArray(value) ||
      value.some(
        (item) => !["string", "number", "boolean"].includes(typeof item)
      ))
  ) {
    return "Expected an array of option values";
  }
  if (type === "date") {
    const date =
      value instanceof Date ? value : new Date(value as string | number);
    if (!Number.isFinite(date.getTime())) {
      return "Expected a valid date";
    }
    if (
      typeof value === "string" &&
      DATE_ONLY_PATTERN.test(value) &&
      date.toISOString().slice(0, 10) !== value
    ) {
      return "Expected a valid date";
    }
  }
}
