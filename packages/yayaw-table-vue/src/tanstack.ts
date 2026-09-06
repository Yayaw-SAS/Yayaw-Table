/** TanStack Table v9 features and compatibility types used by the Vue adapter. */
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
  type Column as TanStackColumn,
  type ColumnDef as TanStackColumnDef,
  type ColumnPinningState as TanStackColumnPinningState,
  FlexRender as TanStackFlexRender,
  type Row as TanStackRow,
  tableFeatures,
  useTable,
} from "@tanstack/vue-table";

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
export type Row<TData> = TanStackRow<
  YayawTableFeatures,
  CompatibleRowData<TData>
>;
export type InternalColumnPinningState = TanStackColumnPinningState;

export const toInternalColumnPinning = (value?: {
  left?: string[];
  right?: string[];
}): InternalColumnPinningState => ({
  end: value?.right ?? [],
  start: value?.left ?? [],
});

export const fromInternalColumnPinning = (
  value?: InternalColumnPinningState
): { left: string[]; right: string[] } => ({
  left: value?.start ?? [],
  right: value?.end ?? [],
});

export const useYayawTable = <TData extends RowData>(
  options: Omit<TableOptions<YayawTableFeatures, TData>, "features">
) => {
  Object.defineProperty(options, "features", {
    configurable: true,
    enumerable: true,
    value: yayawTableFeatures,
  });
  return useTable(options as TableOptions<YayawTableFeatures, TData>);
};

export const FlexRender = TanStackFlexRender;
export type { RowSelectionState, Updater } from "@tanstack/vue-table";
