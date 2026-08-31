import {
  computed,
  onBeforeUnmount,
  onMounted,
  type Ref,
  ref,
  watch,
} from "vue";
import { createTableViewSnapshot } from "../core";
import type {
  AdvancedFiltersState,
  ColumnFiltersState,
  ColumnPinningState,
  ColumnVisibilityState,
  PaginationState,
  SortingState,
  TableConfig,
  TableDisplayMode,
  TableGalleryViewConfig,
  TableKanbanViewConfig,
  TableRecord,
  TableViewConfig,
} from "../types";

const emptyAdvancedFilters = (): AdvancedFiltersState => ({
  filters: [],
  joinOperator: "and",
});
const emptyPinning = (): ColumnPinningState => ({
  left: ["select"],
  right: ["actions"],
});

const parseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    try {
      return JSON.parse(decodeURIComponent(value)) as T;
    } catch {
      return fallback;
    }
  }
};

const serialize = (value: unknown): string => JSON.stringify(value);
const serializeEncoded = (value: unknown): string =>
  encodeURIComponent(JSON.stringify(value));

export interface TableStateRefs {
  search: Ref<string>;
  filters: Ref<ColumnFiltersState>;
  advancedFilters: Ref<AdvancedFiltersState>;
  sorting: Ref<SortingState>;
  visibility: Ref<ColumnVisibilityState>;
  order: Ref<string[]>;
  grouping: Ref<string[]>;
  pinning: Ref<ColumnPinningState>;
  pagination: Ref<PaginationState>;
  displayMode: Ref<TableDisplayMode>;
  kanban: Ref<TableKanbanViewConfig>;
  gallery: Ref<TableGalleryViewConfig>;
  activeViewId: Ref<string | undefined>;
  snapshot: Readonly<Ref<TableViewConfig>>;
  applyView: (config: TableViewConfig, viewId?: string) => void;
  reset: () => void;
  shareableUrl: () => string;
}

export const useTableState = <TData extends TableRecord>({
  config,
  syncUrl,
}: {
  config: TableConfig<TData>;
  syncUrl: boolean;
}): TableStateRefs => {
  const tableId = config.id;
  const search = ref("");
  const filters = ref<ColumnFiltersState>([]);
  const advancedFilters = ref<AdvancedFiltersState>(emptyAdvancedFilters());
  const sorting = ref<SortingState>(config.columns.sort ?? []);
  const visibility = ref<ColumnVisibilityState>(
    Object.fromEntries(
      config.columns.definitions.map((column) => [
        column.id,
        config.columns.visible.includes(column.id),
      ])
    )
  );
  const order = ref([...config.columns.order]);
  const grouping = ref<string[]>([]);
  const pinning = ref<ColumnPinningState>(emptyPinning());
  const pagination = ref<PaginationState>({
    pageIndex: 0,
    pageSize: config.table.defaultPageSize,
  });
  const displayMode = ref<TableDisplayMode>(
    config.table.defaultDisplayMode ?? "table"
  );
  const kanban = ref<TableKanbanViewConfig>({
    groupBy: config.table.kanban?.groupBy,
    titleColumn: config.table.kanban?.titleColumn,
    cardColumnIds: config.table.kanban?.cardColumnIds,
    showCardLabels: config.table.kanban?.showCardLabels,
  });
  const gallery = ref<TableGalleryViewConfig>({ ...config.table.gallery });
  const activeViewId = ref<string>();
  let hydrating = true;
  let urlTimer: ReturnType<typeof setTimeout> | undefined;

  const snapshot = computed<TableViewConfig>(() =>
    createTableViewSnapshot({
      search: search.value,
      filters: filters.value,
      advancedFilters: advancedFilters.value,
      sorting: sorting.value,
      columnVisibility: visibility.value,
      columnOrder: order.value,
      displayMode: displayMode.value,
      kanban: kanban.value,
      gallery: gallery.value,
      grouping: grouping.value,
      pinning: pinning.value,
      pageSize: pagination.value.pageSize,
    })
  );

  const fromUrl = (): void => {
    if (!syncUrl || typeof window === "undefined") {
      hydrating = false;
      return;
    }
    const params = new URLSearchParams(window.location.search);
    search.value = params.get(`${tableId}-q`) ?? "";
    filters.value = parseJson(params.get(`${tableId}-filters`), []);
    advancedFilters.value = parseJson(
      params.get(`${tableId}-advancedFilters`),
      emptyAdvancedFilters()
    );
    sorting.value = parseJson(
      params.get(`${tableId}-sort`),
      config.columns.sort ?? []
    );
    visibility.value = parseJson(
      params.get(`${tableId}-visibility`),
      visibility.value
    );
    order.value = parseJson(
      params.get(`${tableId}-order`),
      config.columns.order
    );
    grouping.value = parseJson(params.get(`${tableId}-grouping`), []);
    pinning.value = parseJson(params.get(`${tableId}-pinning`), emptyPinning());
    pagination.value = {
      pageIndex: Math.max(0, Number(params.get(`${tableId}-page`) ?? 0)),
      pageSize: Math.max(
        1,
        Number(
          params.get(`${tableId}-pageSize`) ?? config.table.defaultPageSize
        )
      ),
    };
    const requestedMode = params.get(
      `${tableId}-display`
    ) as TableDisplayMode | null;
    if (requestedMode && config.table.displayModes?.includes(requestedMode)) {
      displayMode.value = requestedMode;
    }
    kanban.value = parseJson(params.get(`${tableId}-kanban`), kanban.value);
    if (!kanban.value.groupBy) {
      kanban.value = {
        ...kanban.value,
        groupBy:
          params.get(`${tableId}-kanbanGroupBy`) ??
          config.table.kanban?.groupBy,
      };
    }
    gallery.value = parseJson(params.get(`${tableId}-gallery`), gallery.value);
    activeViewId.value = params.get("view") ?? undefined;
    hydrating = false;
  };

  const commitUrl = (): void => {
    const url = new URL(window.location.href);
    const set = (key: string, value: string | undefined): void =>
      value ? url.searchParams.set(key, value) : url.searchParams.delete(key);
    set(`${tableId}-q`, search.value || undefined);
    set(
      `${tableId}-filters`,
      filters.value.length ? serialize(filters.value) : undefined
    );
    set(
      `${tableId}-advancedFilters`,
      advancedFilters.value.filters.length
        ? serialize(advancedFilters.value)
        : undefined
    );
    set(
      `${tableId}-sort`,
      sorting.value.length ? serialize(sorting.value) : undefined
    );
    set(`${tableId}-visibility`, serialize(visibility.value));
    set(`${tableId}-order`, serialize(order.value));
    set(
      `${tableId}-grouping`,
      grouping.value.length ? serialize(grouping.value) : undefined
    );
    set(`${tableId}-pinning`, serializeEncoded(pinning.value));
    set(
      `${tableId}-page`,
      pagination.value.pageIndex
        ? String(pagination.value.pageIndex)
        : undefined
    );
    set(
      `${tableId}-pageSize`,
      pagination.value.pageSize !== config.table.defaultPageSize
        ? String(pagination.value.pageSize)
        : undefined
    );
    set(
      `${tableId}-display`,
      displayMode.value !== (config.table.defaultDisplayMode ?? "table")
        ? displayMode.value
        : undefined
    );
    set(
      `${tableId}-kanban`,
      Object.keys(kanban.value).length ? serialize(kanban.value) : undefined
    );
    set(
      `${tableId}-gallery`,
      Object.keys(gallery.value).length ? serialize(gallery.value) : undefined
    );
    set("view", activeViewId.value);
    window.history.replaceState(window.history.state, "", url);
  };

  const writeUrl = (): void => {
    if (!syncUrl || hydrating || typeof window === "undefined") {
      return;
    }
    if (urlTimer) {
      clearTimeout(urlTimer);
    }
    urlTimer = setTimeout(commitUrl, 40);
  };

  const applyView = (view: TableViewConfig, viewId?: string): void => {
    search.value = view.search ?? "";
    filters.value = view.filters ?? [];
    advancedFilters.value = view.advancedFilters ?? emptyAdvancedFilters();
    sorting.value = view.sorting ?? [];
    visibility.value = view.columnVisibility ?? visibility.value;
    order.value = view.columnOrder ?? config.columns.order;
    displayMode.value =
      view.displayMode ?? config.table.defaultDisplayMode ?? "table";
    kanban.value = view.kanban ?? {};
    gallery.value = view.gallery ?? {};
    grouping.value = view.grouping ?? [];
    pinning.value = view.pinning ?? emptyPinning();
    pagination.value = {
      pageIndex: 0,
      pageSize: view.pageSize ?? config.table.defaultPageSize,
    };
    activeViewId.value = viewId;
  };

  const reset = (): void => {
    applyView({
      sorting: config.columns.sort ?? [],
      columnVisibility: Object.fromEntries(
        config.columns.definitions.map((column) => [
          column.id,
          config.columns.visible.includes(column.id),
        ])
      ),
      columnOrder: config.columns.order,
      displayMode: config.table.defaultDisplayMode,
      pageSize: config.table.defaultPageSize,
    });
  };

  const shareableUrl = (): string =>
    typeof window === "undefined" ? "" : window.location.href;

  watch(
    [
      search,
      filters,
      advancedFilters,
      sorting,
      visibility,
      order,
      grouping,
      pinning,
      pagination,
      displayMode,
      kanban,
      gallery,
      activeViewId,
    ],
    writeUrl,
    { deep: true }
  );
  watch(
    [search, filters, advancedFilters, sorting],
    () => {
      if (!hydrating && pagination.value.pageIndex !== 0) {
        pagination.value = { ...pagination.value, pageIndex: 0 };
      }
    },
    { deep: true }
  );
  onMounted(() => {
    fromUrl();
    window.addEventListener("popstate", fromUrl);
  });
  onBeforeUnmount(() => {
    if (urlTimer) {
      clearTimeout(urlTimer);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("popstate", fromUrl);
    }
  });

  return {
    search,
    filters,
    advancedFilters,
    sorting,
    visibility,
    order,
    grouping,
    pinning,
    pagination,
    displayMode,
    kanban,
    gallery,
    activeViewId,
    snapshot,
    applyView,
    reset,
    shareableUrl,
  };
};
