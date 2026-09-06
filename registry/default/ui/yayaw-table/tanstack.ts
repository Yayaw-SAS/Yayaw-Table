/**
 * TanStack Table v9 configuration shared by every React table instance.
 *
 * Keeping the feature set in one module gives the rest of YaYaw Table a stable,
 * two-generic type surface while TanStack's v9 types carry the feature set as
 * their first generic parameter.
 */
"use client";

import {
  aggregationFn_count,
  aggregationFn_sum,
  columnFilteringFeature,
  columnGroupingFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createExpandedRowModel,
  createFilteredRowModel,
  createGroupedRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_arrIncludes,
  filterFn_equals,
  filterFn_includesString,
  filterFn_inDateRange,
  filterFn_inNumberRange,
  filterFn_weakEquals,
  globalFilteringFeature,
  type RowData,
  rowAggregationFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_text,
  type TableOptions,
  type Cell as TanStackCell,
  type CellContext as TanStackCellContext,
  type Column as TanStackColumn,
  type ColumnDef as TanStackColumnDef,
  type ColumnMeta as TanStackColumnMeta,
  type ColumnPinningState as TanStackColumnPinningState,
  type Header as TanStackHeader,
  type Row as TanStackRow,
  type Table as TanStackTable,
  type TableState as TanStackTableState,
  tableFeatures,
  flexRender as tanstackFlexRender,
  useTable as useTanStackTable,
} from "@tanstack/react-table";
import { useRef } from "react";

export const yayawTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  columnGroupingFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnVisibilityFeature,
  rowAggregationFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  groupedRowModel: createGroupedRowModel(),
  expandedRowModel: createExpandedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  aggregationFns: {
    count: aggregationFn_count,
    sum: aggregationFn_sum,
  },
  filterFns: {
    arrIncludes: filterFn_arrIncludes,
    equals: filterFn_equals,
    inDateRange: filterFn_inDateRange,
    inNumberRange: filterFn_inNumberRange,
    includesString: filterFn_includesString,
    weakEquals: filterFn_weakEquals,
  },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
});

export type YayawTableFeatures = typeof yayawTableFeatures;
type CompatibleRowData<TData> = TData & Record<string, unknown>;

/** Persisted YaYaw pinning keeps its existing physical left/right contract. */
export interface ColumnPinningState {
  left?: string[];
  right?: string[];
}

export type InternalColumnPinningState = TanStackColumnPinningState;

export const toInternalColumnPinning = (
  value?: ColumnPinningState
): InternalColumnPinningState => ({
  end: value?.right ?? [],
  start: value?.left ?? [],
});

export const fromInternalColumnPinning = (
  value?: InternalColumnPinningState
): Required<ColumnPinningState> => ({
  left: value?.start ?? [],
  right: value?.end ?? [],
});

export type Cell<TData, TValue = unknown> = TanStackCell<
  YayawTableFeatures,
  CompatibleRowData<TData>,
  TValue
>;
export type CellContext<TData, TValue = unknown> = TanStackCellContext<
  YayawTableFeatures,
  CompatibleRowData<TData>,
  TValue
>;
export type Column<TData, TValue = unknown> = TanStackColumn<
  YayawTableFeatures,
  CompatibleRowData<TData>,
  TValue
>;
export type ColumnDef<TData, TValue = unknown> = TanStackColumnDef<
  YayawTableFeatures,
  CompatibleRowData<TData>,
  TValue
>;
export type ColumnMeta<TData, TValue = unknown> = TanStackColumnMeta<
  YayawTableFeatures,
  CompatibleRowData<TData>,
  TValue
>;
export type Header<TData, TValue = unknown> = TanStackHeader<
  YayawTableFeatures,
  CompatibleRowData<TData>,
  TValue
>;
export type Row<TData> = TanStackRow<
  YayawTableFeatures,
  CompatibleRowData<TData>
>;
export type Table<TData> = TanStackTable<
  YayawTableFeatures,
  CompatibleRowData<TData>
>;
export type TableState = TanStackTableState<YayawTableFeatures>;

export const useYayawTable = <TData extends RowData>(
  options: Omit<TableOptions<YayawTableFeatures, TData>, "features">
) => {
  const stableOptions = useRef<TableOptions<YayawTableFeatures, TData>>({
    ...options,
    features: yayawTableFeatures,
  });
  Object.assign(stableOptions.current, options);
  return useTanStackTable(stableOptions.current);
};

export const flexRender = tanstackFlexRender;
export type {
  AccessorFn,
  ColumnFilter,
  ColumnFiltersState,
  ColumnOrderState,
  ColumnSizingState,
  ColumnSort,
  ColumnVisibilityState as VisibilityState,
  ExpandedState,
  GroupingState,
  OnChangeFn,
  PaginationState,
  RowSelectionState,
  SortingState,
  Updater,
} from "@tanstack/react-table";
