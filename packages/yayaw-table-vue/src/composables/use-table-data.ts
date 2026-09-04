import type { QueryClient } from "@tanstack/vue-query";
import {
  type ComputedRef,
  computed,
  onScopeDispose,
  type Ref,
  ref,
  watch,
} from "vue";
import type {
  AdvancedFiltersState,
  ColumnFiltersState,
  PaginationState,
  SortingState,
  TableActions,
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
  queryClient,
  tableId,
  searchDebounceMs,
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
  queryClient: QueryClient;
  tableId: string;
  searchDebounceMs?: Readonly<Ref<number>>;
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
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  const cancelSearch = (): void => {
    clearTimeout(searchTimer);
    searchTimer = undefined;
  };
  onScopeDispose(() => {
    cancelSearch();
    requestId += 1;
  });

  const refresh = async (): Promise<void> => {
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
      const params = {
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
      };
      const list = actions.value.list;
      const result = await queryClient.fetchQuery({
        queryKey: ["yayaw-table", tableId, params],
        queryFn: () => list(params),
        staleTime: 0,
      });
      if (currentRequest !== requestId) {
        return;
      }
      rows.value = result.data;
      rowCount.value = result.meta?.totalCount ?? result.data.length;
      pageCount.value =
        result.meta?.pageCount ??
        Math.ceil(rowCount.value / pagination.value.pageSize);
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

  watch(
    inputData,
    async () => {
      if (!isServer.value) {
        await refresh();
      }
    },
    { deep: true }
  );
  watch(
    [actions, search, filters, advancedFilters, sorting, grouping, pagination],
    async (current, previous) => {
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
        searchTimer = setTimeout(refresh, delay);
      } else {
        await refresh();
      }
    },
    { deep: true, immediate: true }
  );

  return { rows, rowCount, pageCount, isLoading, error, isServer, refresh };
};
