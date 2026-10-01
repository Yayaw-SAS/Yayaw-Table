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
  /**
   * Server rendering (`serverPrefetch`): loads the starting page unless
   * current rows already stand for it. A failure leaves the loading state,
   * so the browser loads the page again.
   */
  prefetch: () => Promise<void>;
}

interface ListResult<TData> {
  data: TData[];
  meta?: { pageCount?: number; totalCount?: number };
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

  const listParams = (page = pagination.value) =>
    withManualOrderView(
      {
        page: page.pageIndex + 1,
        pageSize: page.pageSize,
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

  const showCounts = (result: ListResult<TData>): void => {
    rowCount.value = result.meta?.totalCount ?? result.data.length;
    pageCount.value =
      result.meta?.pageCount ??
      Math.ceil(rowCount.value / pagination.value.pageSize);
  };

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
      showCounts(result);
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
  // They are the host's rows (`initialRowsCurrent`), or the starting page the
  // query client holds fresh, e.g. dehydrated from the server rendering.
  let currentRowsKey = "";
  const keepCurrent = (key: unknown[]): void => {
    currentRowsKey = JSON.stringify(key);
    activeQueryKey = currentRowsKey;
  };
  /** A response the query client holds fresh by its `staleTime` (0 by default: none). */
  const freshResult = (key: unknown[]): ListResult<TData> | undefined => {
    const query = queryClient
      .getQueryCache()
      .find<ListResult<TData>>({ queryKey: key, exact: true });
    const { staleTime } = queryClient.defaultQueryOptions({ queryKey: key });
    if (
      !query ||
      query.isStaleByTime(
        typeof staleTime === "function" ? staleTime(query as never) : staleTime
      )
    ) {
      return;
    }
    return query.state.data;
  };
  if (isServer.value) {
    const key = listQueryKey(listParams());
    const cached = initialRowsCurrent ? undefined : freshResult(key);
    if (initialRowsCurrent) {
      queryClient.setQueryData(key, {
        data: [...inputData.value],
        meta: { pageCount: pageCount.value, totalCount: rowCount.value },
      });
    } else if (cached) {
      showCounts(cached);
      rows.value = cached.data;
    }
    if (initialRowsCurrent || cached) {
      keepCurrent(key);
    }
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
  // A smaller page size on the first page (automatic page size measuring
  // fewer rows than the server rendered) shows the first rows already loaded.
  const trimsFirstPage = (current: unknown[], previous: unknown[]): boolean => {
    const shown = previous[6] as PaginationState | undefined;
    const { pageIndex, pageSize } = pagination.value;
    if (
      !shown ||
      current[0] !== previous[0] ||
      !isServer.value ||
      isLoading.value ||
      error.value ||
      pageIndex !== 0 ||
      shown.pageIndex !== 0 ||
      pageSize >= shown.pageSize ||
      JSON.stringify(listQueryKey(listParams(shown))) !== activeQueryKey
    ) {
      return false;
    }
    rows.value = rows.value.slice(0, pageSize);
    pageCount.value = Math.ceil(rowCount.value / pageSize);
    const key = listQueryKey(listParams());
    queryClient.setQueryData(key, {
      data: rows.value,
      meta: { pageCount: pageCount.value, totalCount: rowCount.value },
    });
    keepCurrent(key);
    return true;
  };
  const prefetch = async (): Promise<void> => {
    if (!isServer.value || currentRowsKey) {
      return;
    }
    await loadRows();
    // What the server could not show (an error, a page past the last one)
    // loads again in the browser.
    if (
      error.value ||
      JSON.stringify(listQueryKey(listParams())) !== activeQueryKey
    ) {
      error.value = undefined;
      isLoading.value = true;
    }
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
      if (
        keepsCurrentRows(current, previous) ||
        trimsFirstPage(current, previous)
      ) {
        return;
      }
      if (typeof window === "undefined") {
        // Server rendering requests nothing on its own (see `prefetch`): it
        // shows the loading state the browser starts with.
        isLoading.value = isServer.value;
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

  return {
    rows,
    rowCount,
    pageCount,
    isLoading,
    error,
    isServer,
    refresh,
    prefetch,
  };
};
