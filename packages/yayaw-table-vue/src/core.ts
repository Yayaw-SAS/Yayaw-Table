import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";
import {
  matchesContractFilter,
  normalizeFilterEnvelope,
} from "./table-contracts";
import type {
  AdvancedFilter,
  AdvancedFiltersState,
  CalculationType,
  ColumnDefinition,
  ColumnFiltersState,
  ColumnNumberFormat,
  CreateTableViewInput,
  SortingState,
  TableRecord,
  TableView,
  TableViewActions,
  TableViewConfig,
} from "./types";

const CSV_ESCAPE_PATTERN = /[",\n\r]/;
const VIEW_STORAGE_KEY_PATTERN = /^yayaw-table:(.+):views$/;

const isEmptyValue = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);

const toComparable = (value: unknown): number | string => {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  const date = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isNaN(date) ? String(value ?? "").toLocaleLowerCase() : date;
};

const compareValues = (
  left: number | string,
  right: number | string
): number => {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
};

export const matchesAdvancedFilter = (
  row: TableRecord,
  filter: AdvancedFilter
): boolean => {
  return matchesContractFilter(row[filter.columnId], { ...filter });
};

export const applyAdvancedFilters = <TData extends TableRecord>(
  rows: TData[],
  input?: AdvancedFiltersState | unknown[]
): TData[] => {
  const normalized = normalizeFilterEnvelope(input);
  const state = {
    ...normalized,
    filters: normalized.filters.filter((filter) => filter.isActive !== false),
  } as unknown as AdvancedFiltersState;
  if (!state.filters.length) {
    return rows;
  }
  return rows.filter((row) =>
    state.joinOperator === "or"
      ? state.filters.some((filter) => matchesAdvancedFilter(row, filter))
      : state.filters.every((filter) => matchesAdvancedFilter(row, filter))
  );
};

export const applyTableQuery = <TData extends TableRecord>(
  rows: TData[],
  {
    columns,
    search = "",
    filters = [],
    advancedFilters,
    sorting = [],
  }: {
    columns: ColumnDefinition<TData>[];
    search?: string;
    filters?: ColumnFiltersState;
    advancedFilters?: AdvancedFiltersState;
    sorting?: SortingState;
  }
): TData[] => {
  const valueFor = (row: TData, columnId: string): unknown => {
    const column = columns.find((item) => item.id === columnId);
    return column?.accessorFn
      ? column.accessorFn(row)
      : row[column?.accessorKey ?? columnId];
  };
  const query = search.trim().toLocaleLowerCase();
  const filtered = rows.filter((row) => {
    if (
      query &&
      !columns.some((column) =>
        String(valueFor(row, column.id) ?? "")
          .toLocaleLowerCase()
          .includes(query)
      )
    ) {
      return false;
    }
    return filters.every((filter) => {
      const actual = valueFor(row, filter.id);
      const expected = String(filter.value ?? "").toLocaleLowerCase();
      if (Array.isArray(actual)) {
        return actual.some((value) =>
          String(value).toLocaleLowerCase().includes(expected)
        );
      }
      return String(actual ?? "")
        .toLocaleLowerCase()
        .includes(expected);
    });
  });
  const advancedRows = advancedFilters?.filters.length
    ? (applyAdvancedFilters(
        filtered.map((row) => ({
          ...row,
          ...Object.fromEntries(
            columns.map((column) => [column.id, valueFor(row, column.id)])
          ),
        })),
        advancedFilters
      ) as TData[])
    : filtered;
  if (!sorting.length) {
    return advancedRows;
  }
  return [...advancedRows].sort((leftRow, rightRow) => {
    for (const sort of sorting) {
      const left = toComparable(valueFor(leftRow, sort.id));
      const right = toComparable(valueFor(rightRow, sort.id));
      const comparison = compareValues(left, right);
      if (comparison) {
        return sort.desc ? -comparison : comparison;
      }
    }
    return 0;
  });
};

export const formatNumber = (
  value: unknown,
  options: ColumnNumberFormat = {}
): string => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return value === null || value === undefined ? "—" : String(value);
  }
  if (options.currency) {
    return new Intl.NumberFormat(options.locale, {
      style: "currency",
      currency: options.currency,
      minimumFractionDigits: options.decimalPlaces,
      maximumFractionDigits: options.decimalPlaces,
    }).format(numeric);
  }
  const formatted = new Intl.NumberFormat(options.locale, {
    minimumFractionDigits: options.decimalPlaces,
    maximumFractionDigits: options.decimalPlaces,
    useGrouping: options.thousandsSeparator !== "none",
  }).format(numeric);
  return `${options.prefix ?? ""}${formatted}${options.suffix ?? ""}`;
};

const pad2 = (value: number): string => String(value).padStart(2, "0");

export const formatDateValue = (
  value: unknown,
  preset = "localized-short",
  customFormat?: string,
  locale?: string
): string => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string") {
    date = parseISO(value);
  } else {
    date = new Date(String(value));
  }
  if (!isValid(date)) {
    return String(value);
  }
  if (customFormat) {
    return format(date, customFormat);
  }
  switch (preset) {
    case "localized-short":
      return new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(
        date
      );
    case "localized-medium":
      return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
        date
      );
    case "localized-long":
      return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
        date
      );
    case "month-name-long":
      return new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(date);
    case "month-year":
      return new Intl.DateTimeFormat(locale, {
        month: "long",
        year: "numeric",
      }).format(date);
    case "dmy-numeric":
      return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
    case "dmy-short":
      return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${String(date.getFullYear()).slice(-2)}`;
    case "mdy-numeric":
      return `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}/${date.getFullYear()}`;
    case "mdy-short":
      return `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}/${String(date.getFullYear()).slice(-2)}`;
    case "iso-date":
      return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    case "dateTime":
      return format(date, "PPp");
    case "iso":
      return date.toISOString();
    case "long":
      return format(date, "PPPP");
    case "relative":
      return formatDistanceToNow(date, { addSuffix: true });
    case "short":
      return format(date, "P");
    case "time":
      return format(date, "p");
    default:
      return format(date, "PP");
  }
};

export const displayCellValue = (
  value: unknown,
  column: ColumnDefinition,
  locale?: string
): string => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (column.type === "date") {
    return formatDateValue(
      value,
      column.dateDisplayPreset,
      column.dateFormat,
      locale
    );
  }
  if (column.type === "number") {
    return formatNumber(value, { locale, ...column.numberFormat });
  }
  if (column.type === "boolean") {
    return value ? "Yes" : "No";
  }
  if (column.type === "json") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  if (Array.isArray(value)) {
    return value.map(String).join(", ");
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  const displayed = String(value);
  return column.type === "string" && column.showQuotes
    ? `“${displayed}”`
    : displayed;
};

const numericValues = (rows: TableRecord[], columnId: string): number[] =>
  rows
    .map((row) => row[columnId])
    .filter((value) => !isEmptyValue(value))
    .map(Number)
    .filter(Number.isFinite);

const calculateDateColumn = (
  values: unknown[],
  calculation: CalculationType,
  locale?: string
): string | null | undefined => {
  if (!["min", "max", "range"].includes(calculation)) {
    return undefined;
  }
  const dates = values
    .filter((value) => !isEmptyValue(value))
    .map((value) => (value instanceof Date ? value : new Date(String(value))))
    .filter((value) => isValid(value))
    .sort((left, right) => left.getTime() - right.getTime());
  const first = dates.at(0);
  const last = dates.at(-1);
  if (!(first && last)) {
    return null;
  }
  if (calculation === "range") {
    return `${Math.round((last.getTime() - first.getTime()) / 86_400_000)}d`;
  }
  const selected = calculation === "min" ? first : last;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(selected);
};

const calculateCounts = (
  values: unknown[],
  nonEmpty: unknown[],
  calculation: CalculationType
): number | undefined => {
  const total = values.length;
  switch (calculation) {
    case "count_all":
      return total;
    case "count_empty":
      return total - nonEmpty.length;
    case "count_not_empty":
    case "count_values":
      return nonEmpty.length;
    case "count_unique":
      return new Set(nonEmpty.map((value) => JSON.stringify(value))).size;
    case "count_true":
      return values.filter((value) => value === true).length;
    case "count_false":
      return values.filter((value) => value === false).length;
    case "percent_empty":
      return total ? ((total - nonEmpty.length) / total) * 100 : 0;
    case "percent_not_empty":
      return total ? (nonEmpty.length / total) * 100 : 0;
    case "percent_true":
      return total
        ? (values.filter((value) => value === true).length / total) * 100
        : 0;
    case "percent_false":
      return total
        ? (values.filter((value) => value === false).length / total) * 100
        : 0;
    default:
      return undefined;
  }
};

const calculateNumeric = (
  numbers: number[],
  calculation: CalculationType
): number | null => {
  if (!numbers.length) {
    return null;
  }
  switch (calculation) {
    case "sum":
      return numbers.reduce((sum, value) => sum + value, 0);
    case "average":
      return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
    case "median": {
      const middle = Math.floor(numbers.length / 2);
      const middleValue = numbers[middle] ?? 0;
      return numbers.length % 2
        ? middleValue
        : ((numbers[middle - 1] ?? 0) + middleValue) / 2;
    }
    case "min":
      return numbers.at(0) ?? null;
    case "max":
      return numbers.at(-1) ?? null;
    case "range":
      return (numbers.at(-1) ?? 0) - (numbers.at(0) ?? 0);
    default:
      return null;
  }
};

export const calculateColumn = (
  rows: TableRecord[],
  columnId: string,
  calculation: CalculationType,
  columnType?: string,
  locale?: string
): number | string | null => {
  const values = rows.map((row) => row[columnId]);
  const numbers = numericValues(rows, columnId).sort((a, b) => a - b);
  const nonEmpty = values.filter((value) => !isEmptyValue(value));
  if (columnType === "date") {
    const dateResult = calculateDateColumn(values, calculation, locale);
    if (dateResult !== undefined) {
      return dateResult;
    }
  }
  const countResult = calculateCounts(values, nonEmpty, calculation);
  return countResult ?? calculateNumeric(numbers, calculation);
};

const csvEscape = (value: unknown): string => {
  let text = "";
  if (value !== null && value !== undefined) {
    text = typeof value === "object" ? JSON.stringify(value) : String(value);
  }
  return CSV_ESCAPE_PATTERN.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
};

export const exportColumns = (
  columns: ColumnDefinition[],
  visibility: Record<string, boolean>,
  order: string[]
): ColumnDefinition[] => {
  const ids = [...new Set([...order, ...columns.map((column) => column.id)])];
  return ids.flatMap((id) => {
    const column = columns.find((item) => item.id === id);
    return column && visibility[id] !== false ? [column] : [];
  });
};

export const rowsToCsv = (
  rows: TableRecord[],
  columns: ColumnDefinition[]
): string => {
  const exportColumns = columns.filter(
    (column) => column.type !== "actions" && column.id !== "select"
  );
  return [
    exportColumns.map((column) => csvEscape(column.header)).join(","),
    ...rows.map((row) =>
      exportColumns
        .map((column) =>
          csvEscape(
            column.accessorFn
              ? column.accessorFn(row)
              : row[column.accessorKey ?? column.id]
          )
        )
        .join(",")
    ),
  ].join("\n");
};

export const downloadCsv = (
  rows: TableRecord[],
  columns: ColumnDefinition[],
  filename: string
): void => {
  if (typeof document === "undefined") {
    return;
  }
  const blob = new Blob([rowsToCsv(rows, columns)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const createTableViewSnapshot = (
  config: TableViewConfig
): TableViewConfig => {
  const snapshot: TableViewConfig = {
    ...config,
    advancedFilters: normalizeFilterEnvelope(
      config.advancedFilters
    ) as unknown as AdvancedFiltersState,
  };
  if (!snapshot.search) {
    snapshot.search = undefined;
  }
  if (!snapshot.filters?.length) {
    snapshot.filters = undefined;
  }
  if (!normalizeFilterEnvelope(snapshot.advancedFilters).filters.length) {
    snapshot.advancedFilters = undefined;
  }
  if (!snapshot.sorting?.length) {
    snapshot.sorting = undefined;
  }
  if (!snapshot.grouping?.length) {
    snapshot.grouping = undefined;
  }
  if (!snapshot.columnOrder?.length) {
    snapshot.columnOrder = undefined;
  }
  if (
    !snapshot.columnSizing ||
    Object.keys(snapshot.columnSizing).length === 0
  ) {
    snapshot.columnSizing = undefined;
  }
  if (
    snapshot.columnVisibility &&
    Object.keys(snapshot.columnVisibility).length === 0
  ) {
    snapshot.columnVisibility = undefined;
  }
  return snapshot;
};

const storageKey = (tableId: string): string => `yayaw-table:${tableId}:views`;

const loadLocalViews = (tableId: string): TableView[] => {
  if (typeof localStorage === "undefined") {
    return [];
  }
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(tableId)) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const storeLocalViews = (tableId: string, views: TableView[]): void => {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(storageKey(tableId), JSON.stringify(views));
  }
};

export const createLocalTableViewActions = (): Required<TableViewActions> => ({
  list: ({ tableId }) => loadLocalViews(tableId),
  create: (input: CreateTableViewInput) => {
    const now = new Date().toISOString();
    const view: TableView = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    storeLocalViews(input.tableId, [...loadLocalViews(input.tableId), view]);
    return { success: true, data: view };
  },
  update: (id, input) => {
    let updated: TableView | undefined;
    const tableId =
      input.tableId ??
      (typeof window === "undefined"
        ? ""
        : (Object.keys(localStorage)
            .map((key) => key.match(VIEW_STORAGE_KEY_PATTERN)?.[1])
            .find(
              (candidate) =>
                candidate &&
                loadLocalViews(candidate).some((view) => view.id === id)
            ) ?? ""));
    if (loadLocalViews(tableId).find((view) => view.id === id)?.isSystem) {
      return { success: false, error: "System views cannot be updated" };
    }
    const views = loadLocalViews(tableId).map((view) => {
      if (view.id !== id) {
        return view;
      }
      updated = {
        ...view,
        ...input,
        config: input.config ?? view.config,
        updatedAt: new Date().toISOString(),
      };
      return updated;
    });
    if (updated) {
      storeLocalViews(tableId, views);
    }
    return updated
      ? { success: true, data: updated }
      : { success: false, error: "View not found" };
  },
  delete: (id, { tableId }) => {
    const views = loadLocalViews(tableId);
    const target = views.find((view) => view.id === id);
    if (target?.isSystem) {
      return { success: false, error: "System views cannot be deleted" };
    }
    storeLocalViews(
      tableId,
      views.filter((view) => view.id !== id)
    );
    return { success: true };
  },
});

export const safeHttpUrl = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
};

export const rowId = (row: TableRecord, fallback: string): string =>
  String(row.id ?? row.key ?? fallback);

const IMAGE_SOURCE =
  /^(?:https?:\/\/|\/(?!\/)|data:image\/[a-z0-9.+-]+;base64,|blob:)/i;
export const imageSource = (value: unknown): string | undefined =>
  typeof value === "string" && IMAGE_SOURCE.test(value.trim())
    ? value.trim()
    : undefined;
