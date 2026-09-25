/**
 * Hook for fetching and managing table data with URL state
 * Uses TanStack Query for data fetching and caching
 */
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useCallback, useEffect } from "react";

import { rowSelectionAtom } from "../atoms/table-atoms";
import {
  type TableSorting,
  useTableDefaultSorting,
} from "../providers/table-state-sync-provider";
import {
  type InitialRowsUse,
  resolveInitialRowsUse,
} from "../utils/initial-rows";
import { processServerFilters } from "../utils/server-filters";

import { invalidateAndRefetchTableData } from "./query-cache-utils";
import { isManualOrder } from "../utils/manual-order";
import { useTableUrlState } from "./use-table-url-state";

const _DEBUG = false;

/** The rows while nothing is loaded: one array, so renders keep the same rows. */
const EMPTY_ROWS: never[] = [];

interface UseTableUrlDataOptions<TData> {
  defaultPageSize?: number;
  /**
   * The table's configured sort (`columns.sort`), where it starts when neither
   * the URL nor a view sets one. Defaults to the enclosing table's.
   */
  defaultSorting?: TableSorting;
  enabled?: boolean;
  /** @deprecated Unused: the rows keep the order the query returns. */
  getRowId?: (row: TData) => string;
  initialData?: TData[];
  /**
   * The sort `initialData` was produced with. When it is `columns.sort` and
   * the table starts there, the rows are current and do not load again.
   */
  initialDataSort?: TableSorting;
  initialPageCount?: number;
  initialRowCount?: number;
  syncUrl?: boolean;
  queryFn: (params: {
    columnFilters: Array<{ id: string; value: unknown }>;
    complexFilters: unknown[];
    advancedFilters: unknown[];
    pagination: {
      pageIndex: number;
      pageSize: number;
    };
    serverFilters: Record<string, unknown>;
    sorting: {
      desc: boolean;
      id: string;
    }[];
    tableId: string;
  }) => Promise<{
    data: TData[];
    pageCount: number;
    rowCount: number;
  }>;
  tableId: string;
}

function hasStateValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (value && typeof value === "object") {
    return Object.keys(value).length > 0;
  }

  return false;
}

interface InitialTableQueryState {
  advancedFiltersParam?: unknown;
  /** The table's `columns.sort`: the host's rows also show at once under it. */
  configuredSorting?: unknown;
  defaultPageSize: number;
  filtersParam?: unknown;
  globalSearchParam?: string | null;
  /** The sort the host produced `initialData` with, when it says. */
  initialDataSort?: unknown;
  pagination: { pageIndex: number; pageSize: number };
  serverFilters?: Record<string, unknown>;
  sortParam?: unknown;
}

/** Whether the table starts on page 1 at its default page size, without filters or search. */
function isInitialTablePage({
  advancedFiltersParam,
  defaultPageSize,
  filtersParam,
  globalSearchParam,
  pagination,
  serverFilters,
}: InitialTableQueryState): boolean {
  const resolvedDefaultPageSize =
    Number.isFinite(defaultPageSize) && defaultPageSize > 0
      ? Math.trunc(defaultPageSize)
      : 10;

  return (
    pagination.pageIndex === 0 &&
    pagination.pageSize === resolvedDefaultPageSize &&
    !hasStateValue(filtersParam) &&
    !hasStateValue(advancedFiltersParam) &&
    !hasStateValue(globalSearchParam) &&
    !hasStateValue(serverFilters)
  );
}

/**
 * How the table starts from `initialData` (see `utils/initial-rows.ts`):
 * `current` rows stay for the query's stale time, `placeholder` rows show at
 * once and load again on mount in the starting sort, `unused` rows belong to
 * another state and the table shows its loading state instead.
 */
export function resolveInitialTableRowsUse(
  state: InitialTableQueryState
): InitialRowsUse {
  const use = resolveInitialRowsUse({
    configuredSorting: state.configuredSorting,
    firstPage: isInitialTablePage(state),
    initialDataSort: state.initialDataSort,
    sorting: state.sortParam,
  });
  // Rows given without their sort to a table that has none are in the list's
  // order: React has always kept them (Vue loads that page again on mount).
  if (
    use === "placeholder" &&
    !Array.isArray(state.initialDataSort) &&
    !hasStateValue(state.sortParam)
  ) {
    return "current";
  }
  return use;
}

/** Whether the host's rows are the table's first value (SSR and first render). */
export function shouldUseInitialTableQueryData(
  state: InitialTableQueryState
): boolean {
  return resolveInitialTableRowsUse(state) !== "unused";
}

/**
 * The last page index a list response leaves: its page count, or the pages
 * its row total fills when that is more. At least the first page.
 */
export function resolveLastPageIndex(
  result: { pageCount?: number; rowCount?: number },
  pageSize: number
): number {
  const byPageCount = Number.isFinite(result.pageCount)
    ? Number(result.pageCount)
    : 0;
  const byRowCount =
    Number.isFinite(result.rowCount) && pageSize > 0
      ? Math.ceil(Number(result.rowCount) / pageSize)
      : 0;
  return Math.max(0, Math.max(byPageCount, byRowCount) - 1);
}

export function resolveInitialTableQueryData<TData>({
  initialData,
  initialPageCount,
  initialRowCount,
}: {
  initialData: TData[];
  initialPageCount?: number;
  initialRowCount?: number;
}):
  | {
      data: TData[];
      pageCount: number;
      rowCount: number;
    }
  | undefined {
  if (initialData.length === 0) {
    return undefined;
  }

  return {
    data: initialData,
    pageCount: initialPageCount ?? 1,
    rowCount: initialRowCount ?? initialData.length,
  };
}

/**
 * Hook for fetching and managing table data with URL state
 * @param options - Configuration options for data fetching
 * @returns Object with data and loading state
 */
export function useTableUrlData<TData>({
  defaultPageSize = 10,
  defaultSorting,
  enabled = true,
  initialData = [],
  initialDataSort,
  initialPageCount,
  initialRowCount,
  queryFn,
  syncUrl,
  tableId,
}: UseTableUrlDataOptions<TData>) {
  const resolvedDefaultPageSize =
    Number.isFinite(defaultPageSize) && defaultPageSize > 0
      ? Math.trunc(defaultPageSize)
      : 10;
  const inheritedDefaultSorting = useTableDefaultSorting();
  const configuredSorting = defaultSorting ?? inheritedDefaultSorting;

  // Get URL state - include advanced filters!
  const {
    filtersParam,
    advancedFiltersParam,
    pagination,
    setPageParam,
    sortParam,
    globalSearchParam,
    viewParam,
  } = useTableUrlState({
    defaultPageSize: resolvedDefaultPageSize,
    defaultSorting: configuredSorting,
    enabled: syncUrl,
    tableId,
  });

  const [rowSelection, setRowSelection] = useAtom(rowSelectionAtom(tableId));

  // Get query client
  const queryClient = useQueryClient();

  // Process filters for server-side compatibility
  const processedFiltersQuery = useQuery({
    queryFn: () => {
      // Ensure filtersParam is always an array
      const filters = Array.isArray(filtersParam) ? filtersParam : [];
      // Ensure advancedFiltersParam is always an array
      const advancedFilters = Array.isArray(advancedFiltersParam)
        ? advancedFiltersParam
        : [];
      if (filters.length === 0 && advancedFilters.length === 0) {
        return { complexFilters: [], serverFilters: {}, advancedFilters: [] };
      }

      // Extract global filter if present
      const globalFilterEntry = filters.find(
        (f: unknown): f is { id: string; value: unknown } =>
          typeof f === "object" &&
          f !== null &&
          "id" in f &&
          (f as { id: string }).id === "global"
      );
      const globalFilter =
        globalFilterEntry &&
        typeof globalFilterEntry === "object" &&
        "value" in globalFilterEntry
          ? (globalFilterEntry.value as string)
          : "";

      // Process column filters for server-side compatibility
      const result = processServerFilters(
        (filters as Array<{ id: string; value: unknown }>)
          .filter((filter) => filter.id !== "global") // Remove global filter from regular filters
          .map((filter) => ({
            id: filter.id,
            value: filter.value,
          }))
      );

      // Add global filter if present
      if (globalFilter) {
        result.serverFilters.global = globalFilter;
      }

      // Add advanced filters to the result
      const finalResult = {
        ...result,
        advancedFilters: advancedFilters.filter(
          (filter: { isActive: boolean }) => filter.isActive
        ), // Only include active filters
      };
      return finalResult;
    },
    // Include advancedFiltersParam in query key
    queryKey: [
      "tableProcessedFilters",
      tableId,
      filtersParam,
      advancedFiltersParam,
    ],
    staleTime: 5000, // 5 seconds
  });

  // Extract complex filters, server filters, and advanced filters from the query result
  const { complexFilters, serverFilters, advancedFilters } =
    processedFiltersQuery.data || {
      complexFilters: [],
      serverFilters: {},
      advancedFilters: [],
    };

  // The host's rows show on the server and the first render when the table
  // starts in its default state, the configured sort included.
  const initialRowsUse: InitialRowsUse =
    initialData.length > 0
      ? resolveInitialTableRowsUse({
          advancedFiltersParam,
          configuredSorting,
          defaultPageSize: resolvedDefaultPageSize,
          filtersParam,
          globalSearchParam,
          initialDataSort,
          pagination,
          serverFilters,
          sortParam,
        })
      : "unused";
  const usesInitialRows = initialRowsUse !== "unused";

  // Modify the enabled condition to also run when processedFiltersQuery is pending but we have initial data
  // This prevents the infinite loading state when processedFiltersQuery is stuck in pending
  const shouldEnableQuery =
    Boolean(tableId) &&
    enabled &&
    (processedFiltersQuery.status === "success" ||
      (processedFiltersQuery.status === "pending" && usesInitialRows));

  const initialQueryData = usesInitialRows
    ? resolveInitialTableQueryData({
        initialData,
        initialPageCount,
        initialRowCount,
      })
    : undefined;

  // Query for fetching data
  const {
    data: queryResult,
    error,
    isError,
    isLoading,
    refetch,
    status,
  } = useQuery({
    // Enable the query when processedFiltersQuery is complete or when we have initial data
    enabled: shouldEnableQuery,
    initialData: initialQueryData,
    // Rows shown until the starting sort loads are stale at once: the first
    // page loads again on mount in that sort, as in Vue.
    ...(initialRowsUse === "placeholder" ? { initialDataUpdatedAt: 0 } : {}),
    queryFn: async () => {
      // Convert serverFilters to columnFilters format for compatibility
      const columnFilters = Object.entries(serverFilters).map(
        ([id, value]) => ({
          id,
          value,
        })
      );

      const params = {
        // Use columnFilters for TanStack Table compatibility
        columnFilters,
        // Use complexFilters for special filter types
        complexFilters,
        // Advanced filters for enhanced filtering
        advancedFilters,
        // Global search (server-side global filtering)
        globalSearch: globalSearchParam,
        // Pagination parameters from URL
        pagination,
        // Use serverFilters directly for server-side filtering (without key filters)
        serverFilters,
        // Sorting parameters
        sorting: (sortParam as { desc: boolean; id: string }[]) || [],
        // Table identifier
        tableId,
      };
      const result = await queryFn(params);
      return result;
    },
    queryKey: [
      "tableData",
      tableId,
      JSON.stringify(sortParam),
      // A manual order is the view's own, so another view is another result.
      isManualOrder(sortParam) ? (viewParam ?? "") : "",
      JSON.stringify(filtersParam),
      JSON.stringify(advancedFiltersParam),
      globalSearchParam || "",
      JSON.stringify(pagination),
      JSON.stringify(serverFilters),
    ],
    // Prevent refetching on window focus to avoid duplicate requests
    refetchOnWindowFocus: false,
    // Improve cache options for better performance
    staleTime: 30_000, // 30 seconds
  });

  // A page past the last one (a link, rows removed since) moves to the last
  // page once the list answers, as in Vue. Until then the table loads.
  const lastPageIndex = queryResult
    ? resolveLastPageIndex(queryResult, pagination.pageSize)
    : pagination.pageIndex;
  const isPastLastPage = pagination.pageIndex > lastPageIndex;
  useEffect(() => {
    if (isPastLastPage) {
      setPageParam(String(lastPageIndex));
    }
  }, [isPastLastPage, lastPageIndex, setPageParam]);

  // The rows in the order the query returned them (none past the last page),
  // the same array until the data changes: renderers reload on each new array
  // (see `revision`). The `<tableId>-order` key is the column order; a manual
  // row order is a sort.
  const data: TData[] = (!isPastLastPage && queryResult?.data) || EMPTY_ROWS;

  // Enhanced refetch that invalidates the cache
  const enhancedRefetch = useCallback(async () => {
    return await invalidateAndRefetchTableData({
      queryClient,
      refetch,
      tableId,
    });
  }, [queryClient, refetch, tableId]);

  return {
    data,
    enhancedRefetch,
    error,
    isError,
    isLoading: isLoading || isPastLastPage,
    pageCount: queryResult?.pageCount ?? initialPageCount ?? 0,
    pagination,
    refetch,
    rowCount: queryResult?.rowCount ?? initialRowCount ?? initialData.length,
    rowSelection,
    setRowSelection,
    status,
  };
}
