import type {
  ColumnFiltersState,
  ColumnPinningState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import type { AdvancedFiltersState } from "../types/filter-types";
import type { TableViewConfig } from "../types/view-types";

const EMPTY_PINNING: ColumnPinningState = { left: [], right: [] };

function hasArrayValues(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0;
}

function hasObjectValues(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value && typeof value === "object" && Object.keys(value).length > 0
  );
}

function normalizePageSize(value: number | string | undefined): number | undefined {
  const numericValue = typeof value === "string" ? Number(value) : value;
  if (
    typeof numericValue !== "number" ||
    !Number.isFinite(numericValue) ||
    numericValue <= 0
  ) {
    return;
  }

  return Math.trunc(numericValue);
}

export function normalizeColumnPinning(
  pinning: ColumnPinningState | undefined
): ColumnPinningState | undefined {
  const left = Array.isArray(pinning?.left) ? pinning.left : [];
  const right = Array.isArray(pinning?.right) ? pinning.right : [];
  if (left.length === 0 && right.length === 0) {
    return;
  }

  return { left, right };
}

export function normalizeTableViewConfig(
  config: TableViewConfig
): TableViewConfig {
  const normalized: TableViewConfig = {};
  const advancedFilters = hasArrayValues(config.advancedFilters)
    ? (config.advancedFilters as AdvancedFiltersState)
    : undefined;
  const columnFilters = hasArrayValues(config.columnFilters)
    ? (config.columnFilters as ColumnFiltersState)
    : undefined;
  const columnOrder = hasArrayValues(config.columnOrder)
    ? config.columnOrder
    : undefined;
  const columnPinning = normalizeColumnPinning(config.columnPinning);
  const columnVisibility = hasObjectValues(config.columnVisibility)
    ? (config.columnVisibility as VisibilityState)
    : undefined;
  const globalSearch =
    typeof config.globalSearch === "string" && config.globalSearch.trim()
      ? config.globalSearch.trim()
      : undefined;
  const grouping = hasArrayValues(config.grouping) ? config.grouping : undefined;
  const pageSize = normalizePageSize(config.pageSize);
  const sorting = hasArrayValues(config.sorting)
    ? (config.sorting as SortingState)
    : undefined;

  if (advancedFilters) {
    normalized.advancedFilters = advancedFilters;
  }
  if (columnFilters) {
    normalized.columnFilters = columnFilters;
  }
  if (columnOrder) {
    normalized.columnOrder = columnOrder;
  }
  if (columnPinning) {
    normalized.columnPinning = columnPinning;
  }
  if (columnVisibility) {
    normalized.columnVisibility = columnVisibility;
  }
  if (globalSearch) {
    normalized.globalSearch = globalSearch;
  }
  if (grouping) {
    normalized.grouping = grouping;
  }
  if (pageSize) {
    normalized.pageSize = pageSize;
  }
  if (sorting) {
    normalized.sorting = sorting;
  }

  return normalized;
}

export function createTableViewConfigSnapshot({
  advancedFiltersParam,
  filtersParam,
  globalSearchParam,
  groupingParam,
  orderParam,
  pageSizeParam,
  pinningParam,
  sortParam,
  visibilityParam,
}: {
  advancedFiltersParam: AdvancedFiltersState;
  filtersParam: ColumnFiltersState;
  globalSearchParam: string;
  groupingParam: string[];
  orderParam: string[];
  pageSizeParam: string;
  pinningParam?: ColumnPinningState;
  sortParam: SortingState;
  visibilityParam: VisibilityState;
}): TableViewConfig {
  return normalizeTableViewConfig({
    advancedFilters: advancedFiltersParam,
    columnFilters: filtersParam,
    columnOrder: orderParam,
    columnPinning: normalizeColumnPinning(pinningParam) ?? EMPTY_PINNING,
    columnVisibility: visibilityParam,
    globalSearch: globalSearchParam,
    grouping: groupingParam,
    pageSize: normalizePageSize(pageSizeParam),
    sorting: sortParam,
  });
}

export function areTableViewConfigsEqual(
  left: TableViewConfig,
  right: TableViewConfig
): boolean {
  return (
    JSON.stringify(normalizeTableViewConfig(left)) ===
    JSON.stringify(normalizeTableViewConfig(right))
  );
}
