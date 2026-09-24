import type { QueryClient } from "@tanstack/vue-query";
import {
  type ComputedRef,
  computed,
  onScopeDispose,
  type Ref,
  ref,
  watch,
} from "vue";
import { withManualOrderView } from "../manual-order";
import { compatibleListParams } from "../table-contracts";
import type {
  AdvancedFiltersState,
  ColumnFiltersState,
  PaginationState,
  SortingState,
  TableActions,
  TableListParams,
  TableRecord,
} from "../types";

export interface TableDataResult<TData extends TableRecord> {
  rows: Ref<TData[]>;
  rowCount: Ref<number>;
  pageCount: Ref<number>;
  isLoading: Ref<boolean>;
  error: Ref<Error | undefined>;
  isServer: ComputedRef<boolean>;
  refresh: () => Promise<void>;
}

export const useTableData = <TData extends TableRecord>({
  actions,
  inputData,
  search,
  filters,
  advancedFilters,
  sorting,
  grouping,
  pagination,
  initialRowCount,
  initialPageCount,
  initialRowsCurrent = false,
  queryClient,
  tableId,
  searchDebounceMs,
  viewId,
}: {
  actions: ComputedRef<TableActions<TData> | undefined>;
  inputData: ComputedRef<TData[]>;
  search: Ref<string>;
  filters: Ref<ColumnFiltersState>;
  advancedFilters: Ref<AdvancedFiltersState>;
  sorting: Ref<SortingState>;
  grouping: Ref<string[]>;
  pagination: Ref<PaginationState>;
  initialRowCount?: number;
  initialPageCount?: number;
  /**
   * The rows passed in are the starting state's first page, produced in its
   * sort (see `initial-rows.ts`): keep them until the state changes instead
   * of loading that page again on mount.
   */
  initialRowsCurrent?: boolean;
  queryClient: QueryClient;
  tableId: string;
  searchDebounceMs?: Readonly<Ref<number>>;
  /** Active saved view; sent with the manual-order sort so the host applies that view's order. */
  viewId?: Readonly<Ref<string | undefined>>;
}): TableDataResult<TData> => {
  const rows = ref<TData[]>([...inputData.value]) as Ref<TData[]>;
  const rowCount = ref(initialRowCount ?? inputData.value.length);
  const pageCount = ref(
    initialPageCount ?? Math.ceil(rowCount.value / pagination.value.pageSize)
  );
  const isLoading = ref(false);
  const error = ref<Error>();
  const isServer = computed(() => typeof actions.value?.list === "function");
  let requestId = 0;
  let activeQueryKey = "";
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  const cancelSearch = (): void => {
    clearTimeout(searchTimer);
    searchTimer = undefined;
  };
  onScopeDispose(() => {
    cancelSearch();
    requestId += 1;
  });

  const listParams = () =>
    withManualOrderView(
      {
        page: pagination.value.pageIndex + 1,
        pageSize: pagination.value.pageSize,
        search: search.value,
        filters: Object.fromEntries(
          filters.value.map((filter) => [filter.id, filter.value])
        ),
        advancedFilters: advancedFilters.value.filters,
        advancedFilterJoin: advancedFilters.value.joinOperator,
        sorting: sorting.value,
        grouping: grouping.value,
      },
      sorting.value,
      viewId?.value
    );
  const listQueryKey = (params: ReturnType<typeof listParams>) => [
    "yayaw-table",
    tableId,
    params,
  ];

  const loadRows = async (): Promise<void> => {
    cancelSearch();
    if (!actions.value?.list) {
      rows.value = [...inputData.value];
      rowCount.value = inputData.value.length;
      pageCount.value = Math.ceil(rowCount.value / pagination.value.pageSize);
      return;
    }
    const currentRequest = ++requestId;
    isLoading.value = true;
    error.value = undefined;
    try {
      const params = listParams();
      const list = actions.value.list;
      activeQueryKey = JSON.stringify(listQueryKey(params));
      const result = await queryClient.fetchQuery({
        queryKey: listQueryKey(params),
        queryFn: () =>
          list(compatibleListParams(params) as unknown as TableListParams),
        staleTime: 0,
      });
      if (currentRequest !== requestId) {
        return;
      }
      rowCount.value = result.meta?.totalCount ?? result.data.length;
      pageCount.value =
        result.meta?.pageCount ??
        Math.ceil(rowCount.value / pagination.value.pageSize);
      const lastPage = Math.max(0, pageCount.value - 1);
      if (pagination.value.pageIndex > lastPage) {
        // A deletion can remove the last page. Let the pagination watcher load its predecessor.
        pagination.value = { ...pagination.value, pageIndex: lastPage };
        return;
      }
      rows.value = result.data;
    } catch (cause) {
      if (currentRequest === requestId) {
        error.value = cause instanceof Error ? cause : new Error(String(cause));
      }
    } finally {
      if (currentRequest === requestId) {
        isLoading.value = false;
      }
    }
  };

  const refresh = async (): Promise<void> => {
    // A mutation must not reuse a pending list response captured before the write.
    requestId += 1;
    await queryClient.cancelQueries({
      queryKey: ["yayaw-table", tableId],
      predicate: (query) => JSON.stringify(query.queryKey) === activeQueryKey,
    });
    await loadRows();
  };

  const unsubscribe = queryClient.getQueryCache().subscribe(async (event) => {
    const key = event.query.queryKey;
    if (
      key[0] === "yayaw-table" &&
      key[1] === tableId &&
      JSON.stringify(key) === activeQueryKey &&
      event.type === "updated" &&
      event.action.type === "invalidate"
    ) {
      await refresh();
    }
  });
  onScopeDispose(unsubscribe);

  // Current rows stand for the starting state's first page, cached as its
  // response so an invalidation still reloads them, until the state or the
  // actions change (reading the URL on mount may set equal values again).
  let currentRowsKey = "";
  if (initialRowsCurrent && isServer.value) {
    const params = listParams();
    currentRowsKey = JSON.stringify(listQueryKey(params));
    activeQueryKey = currentRowsKey;
    queryClient.setQueryData(listQueryKey(params), {
      data: [...inputData.value],
      meta: { pageCount: pageCount.value, totalCount: rowCount.value },
    });
  }
  const keepsCurrentRows = (
    current: unknown[],
    previous: unknown[]
  ): boolean => {
    if (!currentRowsKey) {
      return false;
    }
    const sameActions = previous.length === 0 || current[0] === previous[0];
    if (
      sameActions &&
      JSON.stringify(listQueryKey(listParams())) === currentRowsKey
    ) {
      return true;
    }
    currentRowsKey = "";
    return false;
  };

  watch(
    inputData,
    async () => {
      if (!isServer.value) {
        await loadRows();
      }
    },
    { deep: true }
  );
  watch(
    [
      actions,
      search,
      filters,
      advancedFilters,
      sorting,
      grouping,
      pagination,
      () => viewId?.value,
    ],
    async (current, previous) => {
      if (keepsCurrentRows(current, previous)) {
        return;
      }
      cancelSearch();
      // Invalidate in-flight results before the debounce window starts.
      requestId += 1;
      const delay = Math.max(0, searchDebounceMs?.value ?? 0);
      if (
        previous.length &&
        current[1] !== previous[1] &&
        delay &&
        isServer.value
      ) {
        searchTimer = setTimeout(loadRows, delay);
      } else {
        await loadRows();
      }
    },
    { deep: true, immediate: true }
  );

  return { rows, rowCount, pageCount, isLoading, error, isServer, refresh };
};
