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
import { cloneFormValue } from "../form-runtime";
import {
  normalizeColumnSizing,
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
  sizing: Ref<Record<string, number>>;
  grouping: Ref<string[]>;
  pinning: Ref<ColumnPinningState>;
  pagination: Ref<PaginationState>;
  displayMode: Ref<TableDisplayMode>;
  kanban: Ref<TableKanbanViewConfig>;
  gallery: Ref<TableGalleryViewConfig>;
  columnDragEnabled: Ref<boolean>;
  activeViewId: Ref<string | undefined>;
  initialViewId?: string;
  hasInitialTableUrlState: boolean;
  resolveView: (config: TableViewConfig) => TableViewConfig;
  snapshot: Readonly<Ref<TableViewConfig>>;
  applyView: (config: TableViewConfig, viewId?: string) => void;
  reset: () => void;
  resetFilters: () => void;
  shareableUrl: () => string;
}

export const useTableState = <TData extends TableRecord>({
  config,
  syncUrl,
  initialActiveViewId,
}: {
  config: TableConfig<TData>;
  syncUrl: boolean;
  initialActiveViewId?: string;
}): TableStateRefs => {
  const tableId = config.id;
  const columnDragStorageKey = `${tableId}-column-drag-enabled`;
  const columnDndFeatureEnabled = config.table.enableColumnDnd !== false;
  const initialColumnDragEnabled = (): boolean => {
    if (!columnDndFeatureEnabled) {
      return false;
    }
    if (typeof window === "undefined") {
      return config.table.enableColumnDragDropByDefault;
    }
    const storedPreference = window.localStorage.getItem(columnDragStorageKey);
    return storedPreference === null
      ? config.table.enableColumnDragDropByDefault
      : storedPreference === "true";
  };
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
  const sizing = ref<Record<string, number>>({});
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
  const columnDragEnabled = ref(initialColumnDragEnabled());
  watch(
    columnDragEnabled,
    (enabled) => {
      const effectiveValue = columnDndFeatureEnabled && enabled;
      if (enabled !== effectiveValue) {
        columnDragEnabled.value = effectiveValue;
        return;
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          columnDragStorageKey,
          String(effectiveValue)
        );
      }
    },
    { immediate: true }
  );
  // Capture the incoming URL before this table starts writing its own state.
  const initialParams = new URLSearchParams(
    syncUrl && typeof window !== "undefined" ? window.location.search : ""
  );
  const hasInitialTableUrlState = [...initialParams.keys()].some((key) =>
    key.startsWith(`${tableId}-`)
  );
  const initialViewId =
    initialParams.get("view") ??
    (hasInitialTableUrlState ? undefined : initialActiveViewId);
  const activeViewId = ref<string | undefined>(initialViewId);
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
  const enabledSizing = (value: unknown): Record<string, number> =>
    config.table.enableColumnResizing
      ? normalizeColumnSizing(value, columnIds)
      : {};
  const enabledDisplayMode = (
    requested?: TableDisplayMode
  ): TableDisplayMode =>
    requested && config.table.displayModes?.includes(requested)
      ? requested
      : (config.table.defaultDisplayMode ?? "table");

  const snapshot = computed<TableViewConfig>(() => ({
    ...createTableViewSnapshot({
      globalSearch: search.value,
      columnFilters: enabledFilters(filters.value),
      columnPinning: enabledPinning(pinning.value),
      search: search.value,
      filters: enabledFilters(filters.value),
      advancedFilters: enabledAdvancedFilters(advancedFilters.value),
      sorting: sorting.value,
      columnVisibility: visibility.value,
      columnOrder: order.value,
      columnSizing: enabledSizing(sizing.value),
      displayMode: displayMode.value,
      kanban: kanban.value,
      gallery: gallery.value,
      grouping: enabledGrouping(grouping.value),
      pinning: enabledPinning(pinning.value),
      pageSize: pagination.value.pageSize,
    }),
    // Empty grouping is intentional, even when a Kanban lane is configured.
    grouping: enabledGrouping(grouping.value),
  }));

  const fromUrl = (): void => {
    if (!syncUrl || typeof window === "undefined") {
      hydrating = false;
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const defaults = resolveView({});
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
      defaults.columnVisibility ?? {}
    );
    order.value = parseJson(
      params.get(`${tableId}-order`),
      config.columns.order
    );
    sizing.value = enabledSizing(
      parseJson(params.get(`${tableId}-sizing`), {})
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
    displayMode.value = enabledDisplayMode(requestedMode ?? undefined);
    kanban.value = parseJson(
      params.get(`${tableId}-kanban`),
      defaults.kanban ?? {}
    );
    if (!kanban.value.groupBy) {
      kanban.value = {
        ...kanban.value,
        groupBy:
          params.get(`${tableId}-kanbanGroupBy`) ??
          config.table.kanban?.groupBy,
      };
    }
    if (
      displayMode.value === "kanban" &&
      !params.has(`${tableId}-grouping`) &&
      (params.has(`${tableId}-kanban`) ||
        params.has(`${tableId}-kanbanGroupBy`)) &&
      kanban.value.groupBy
    ) {
      grouping.value = enabledGrouping([kanban.value.groupBy]);
    }
    gallery.value = parseJson(
      params.get(`${tableId}-gallery`),
      defaults.gallery ?? {}
    );
    activeViewId.value =
      params.get("view") ?? (hydrating ? initialViewId : undefined);
    hydrating = false;
  };

  const serializedGrouping = computed(() =>
    grouping.value.length || kanban.value.groupBy
      ? serialize(grouping.value)
      : undefined
  );
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
      `${tableId}-sizing`,
      Object.keys(sizing.value).length ? serialize(sizing.value) : undefined
    );
    set(`${tableId}-grouping`, serializedGrouping.value);
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

  /** Resolve partial saved views against catalogue defaults, never the previously selected view. */
  const resolveView = (input: TableViewConfig): TableViewConfig => {
    const aliases = normalizeViewAliases(input);
    const globalSearch = String(aliases.globalSearch ?? "");
    const columnFilters = enabledFilters(
      aliases.columnFilters as ColumnFiltersState
    );
    const columnPinning = lockedColumnPinning(
      enabledPinning(aliases.columnPinning as ColumnPinningState),
      columnIds,
      config.table.enableColumnPinning
    );
    return cloneFormValue(
      createTableViewSnapshot({
        globalSearch,
        search: globalSearch,
        columnFilters,
        filters: columnFilters,
        columnPinning,
        pinning: columnPinning,
        advancedFilters: enabledAdvancedFilters(
          normalizeFilterEnvelope(
            input.advancedFilters
          ) as unknown as AdvancedFiltersState
        ),
        sorting: input.sorting ?? config.columns.sort ?? [],
        columnVisibility: lockedColumnVisibility(
          input.columnVisibility ??
            Object.fromEntries(
              config.columns.definitions.map((column) => [
                column.id,
                config.columns.visible.includes(column.id),
              ])
            ),
          config.columns.mandatory
        ),
        columnOrder: lockedColumnOrder(
          input.columnOrder ?? config.columns.order,
          columnIds
        ),
        columnSizing: enabledSizing(input.columnSizing),
        displayMode: enabledDisplayMode(input.displayMode),
        kanban: input.kanban ?? {
          groupBy: config.table.kanban?.groupBy,
          titleColumn: config.table.kanban?.titleColumn,
          cardColumnIds: config.table.kanban?.cardColumnIds,
          showCardLabels: config.table.kanban?.showCardLabels,
        },
        gallery: input.gallery ?? { ...config.table.gallery },
        grouping: enabledGrouping(
          input.grouping ??
            (enabledDisplayMode(input.displayMode) === "kanban"
              ? (aliases.grouping as string[])
              : [])
        ),
        pageSize: positiveInteger(input.pageSize, config.table.defaultPageSize),
      })
    );
  };

  const applyView = (input: TableViewConfig, viewId?: string): void => {
    const view = resolveView(input);
    search.value = view.search ?? "";
    filters.value = view.filters ?? [];
    advancedFilters.value = enabledAdvancedFilters(
      normalizeFilterEnvelope(
        view.advancedFilters
      ) as unknown as AdvancedFiltersState
    );
    sorting.value = view.sorting ?? [];
    visibility.value = view.columnVisibility ?? {};
    order.value = view.columnOrder ?? [];
    sizing.value = enabledSizing(view.columnSizing);
    displayMode.value = view.displayMode ?? "table";
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
      columnSizing: {},
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
      sizing,
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
    sizing,
    grouping,
    pinning,
    pagination,
    displayMode,
    kanban,
    gallery,
    columnDragEnabled,
    activeViewId,
    initialViewId,
    hasInitialTableUrlState,
    resolveView,
    snapshot,
    applyView,
    reset,
    resetFilters,
    shareableUrl,
  };
};
