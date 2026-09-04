import {
  computed,
  onBeforeUnmount,
  onMounted,
  type Ref,
  ref,
  watch,
} from "vue";
import {
  lockedColumnOrder,
  lockedColumnPinning,
  lockedColumnVisibility,
} from "../column-locks";
import { createTableViewSnapshot } from "../core";
import {
  normalizeFilterEnvelope,
  normalizeViewAliases,
  positiveInteger,
} from "../table-contracts";
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
  resetFilters: () => void;
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
  const columnIds = config.columns.definitions.map((column) => column.id);
  watch(
    [visibility, order, pinning],
    () => {
      const nextVisibility = lockedColumnVisibility(
        visibility.value,
        config.columns.mandatory
      );
      const nextOrder = lockedColumnOrder(order.value, columnIds);
      const nextPinning = lockedColumnPinning(
        pinning.value,
        columnIds,
        config.table.enableColumnPinning
      );
      if (serialize(visibility.value) !== serialize(nextVisibility)) {
        visibility.value = nextVisibility;
      }
      if (serialize(order.value) !== serialize(nextOrder)) {
        order.value = nextOrder;
      }
      if (serialize(pinning.value) !== serialize(nextPinning)) {
        pinning.value = nextPinning;
      }
    },
    { deep: true, immediate: true, flush: "sync" }
  );
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
  const enabledFilters = (value: ColumnFiltersState): ColumnFiltersState =>
    config.table.enableColumnFilters ? value : [];
  const enabledAdvancedFilters = (
    value: AdvancedFiltersState
  ): AdvancedFiltersState =>
    config.table.enableColumnFilters
      ? (normalizeFilterEnvelope(value) as unknown as AdvancedFiltersState)
      : emptyAdvancedFilters();
  const enabledGrouping = (value: string[]): string[] =>
    config.table.enableGrouping ? value : [];
  const enabledPinning = (value: ColumnPinningState): ColumnPinningState =>
    config.table.enableColumnPinning ? value : emptyPinning();
  const enabledDisplayMode = (
    requested?: TableDisplayMode
  ): TableDisplayMode =>
    requested && config.table.displayModes?.includes(requested)
      ? requested
      : (config.table.defaultDisplayMode ?? "table");

  const snapshot = computed<TableViewConfig>(() =>
    createTableViewSnapshot({
      globalSearch: search.value,
      columnFilters: enabledFilters(filters.value),
      columnPinning: enabledPinning(pinning.value),
      search: search.value,
      filters: enabledFilters(filters.value),
      advancedFilters: enabledAdvancedFilters(advancedFilters.value),
      sorting: sorting.value,
      columnVisibility: visibility.value,
      columnOrder: order.value,
      displayMode: displayMode.value,
      kanban: kanban.value,
      gallery: gallery.value,
      grouping: enabledGrouping(grouping.value),
      pinning: enabledPinning(pinning.value),
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
    filters.value = enabledFilters(
      parseJson(params.get(`${tableId}-filters`), [])
    );
    advancedFilters.value = enabledAdvancedFilters(
      parseJson(
        params.get(`${tableId}-advancedFilters`),
        emptyAdvancedFilters()
      )
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
    grouping.value = enabledGrouping(
      parseJson(params.get(`${tableId}-grouping`), [])
    );
    pinning.value = enabledPinning(
      parseJson(params.get(`${tableId}-pinning`), emptyPinning())
    );
    pagination.value = {
      pageIndex: Math.max(0, positiveInteger(params.get(`${tableId}-page`), 0)),
      pageSize: positiveInteger(
        params.get(`${tableId}-pageSize`),
        config.table.defaultPageSize
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
    if (
      !params.has(`${tableId}-grouping`) &&
      (params.has(`${tableId}-kanban`) ||
        params.has(`${tableId}-kanbanGroupBy`)) &&
      kanban.value.groupBy
    ) {
      grouping.value = enabledGrouping([kanban.value.groupBy]);
    }
    gallery.value = parseJson(params.get(`${tableId}-gallery`), gallery.value);
    activeViewId.value = params.get("view") ?? activeViewId.value;
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

  const applyView = (input: TableViewConfig, viewId?: string): void => {
    const aliases = normalizeViewAliases(input);
    const view = {
      ...input,
      search: aliases.globalSearch,
      filters: aliases.columnFilters,
      pinning: aliases.columnPinning,
      grouping: aliases.grouping,
    } as TableViewConfig;
    search.value = view.search ?? "";
    filters.value = enabledFilters(view.filters ?? []);
    advancedFilters.value = enabledAdvancedFilters(
      normalizeFilterEnvelope(
        view.advancedFilters
      ) as unknown as AdvancedFiltersState
    );
    sorting.value = view.sorting ?? [];
    visibility.value = view.columnVisibility ?? visibility.value;
    order.value = view.columnOrder ?? config.columns.order;
    displayMode.value = enabledDisplayMode(view.displayMode);
    kanban.value = view.kanban ?? {};
    gallery.value = view.gallery ?? {};
    grouping.value = enabledGrouping(view.grouping ?? []);
    pinning.value = enabledPinning(view.pinning ?? emptyPinning());
    pagination.value = {
      pageIndex: 0,
      pageSize: view.pageSize ?? config.table.defaultPageSize,
    };
    activeViewId.value = viewId;
  };

  const resetFilters = (): void => {
    search.value = "";
    filters.value = [];
    advancedFilters.value = emptyAdvancedFilters();
    pagination.value = { ...pagination.value, pageIndex: 0 };
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
    resetFilters,
    shareableUrl,
  };
};
