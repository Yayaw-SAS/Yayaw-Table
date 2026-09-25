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
import { normalizeDateFilterRules } from "../date-filter-days";
import {
  GENERIC_MODE_CONFIG_KEYS,
  pickGenericModeSettings,
  resolveDisplayMode,
  resolveDisplayModes,
} from "../display-modes";
import { cloneFormValue } from "../form-runtime";
import { normalizeGanttView } from "../planning/engine";
import type { TableGanttViewConfig } from "../planning/types";
import {
  isTableDensity,
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
  TableDensity,
  TableDisplayMode,
  TableGalleryViewConfig,
  TableKanbanViewConfig,
  TableListViewConfig,
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
  /** Modes this table offers (configured, with their renderer or planning session). */
  offeredDisplayModes: readonly TableDisplayMode[];
  density: Ref<TableDensity>;
  footerCalculationsVisible: Ref<boolean>;
  kanban: Ref<TableKanbanViewConfig>;
  gantt: Ref<TableGanttViewConfig>;
  gallery: Ref<TableGalleryViewConfig>;
  list: Ref<TableListViewConfig>;
  /** Settings of the modes the registry handles generically, keyed by config key. */
  modeConfigs: Ref<Record<string, Record<string, unknown>>>;
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
  instanceId,
  planning = false,
  renderers,
}: {
  config: TableConfig<TData>;
  syncUrl: boolean;
  initialActiveViewId?: string;
  /** Scopes the URL keys: `<instanceId>-view`, `<instanceId>-…`. */
  instanceId?: string;
  /** Whether a planning session exists; without one, links asking for Gantt fall back. */
  planning?: boolean;
  /** Modes with an optional renderer installed, such as `calendar`. */
  renderers?: readonly string[];
}): TableStateRefs => {
  const tableId = config.id;
  const columnDragStorageKey = `${tableId}-column-drag-enabled`;
  // A scoped instance prefixes every URL key, `view` included, with its id.
  const urlPrefix = instanceId || tableId;
  const viewKey = instanceId ? `${instanceId}-view` : "view";
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
  // Keep toolbar choices local to this instance without mutating shared configuration.
  const densityOverride = ref<TableDensity>();
  const footerCalculationsVisible = ref(true);
  const density = computed({
    get: () => densityOverride.value ?? config.table.density,
    set: (value: TableDensity) => {
      densityOverride.value = value;
    },
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
  const gantt = ref<TableGanttViewConfig>(
    normalizeGanttView(config.table.gantt)
  );
  const gallery = ref<TableGalleryViewConfig>({ ...config.table.gallery });
  // Settings of the modes the registry handles generically (`list`, …).
  const modeConfigs = ref<Record<string, Record<string, unknown>>>({
    ...pickGenericModeSettings(config.table),
  } as Record<string, Record<string, unknown>>);
  const list = computed<TableListViewConfig>({
    get: () => (modeConfigs.value.list ?? {}) as TableListViewConfig,
    set: (value) => {
      modeConfigs.value = {
        ...modeConfigs.value,
        list: value as Record<string, unknown>,
      };
    },
  });
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
    key.startsWith(`${urlPrefix}-`)
  );
  const initialViewId =
    initialParams.get(viewKey) ??
    (hasInitialTableUrlState ? undefined : initialActiveViewId);
  const activeViewId = ref<string | undefined>(initialViewId);
  let hydrating = true;
  let urlTimer: ReturnType<typeof setTimeout> | undefined;
  const enabledFilters = (value: ColumnFiltersState): ColumnFiltersState =>
    config.table.enableColumnFilters ? value : [];
  const dateColumnIds = new Set(
    config.columns.definitions
      .filter((column) => column.type === "date")
      .map((column) => column.id)
  );
  // Date rules name calendar days: older links and views saved instants,
  // which read as the viewer's days.
  const enabledAdvancedFilters = (
    value: AdvancedFiltersState
  ): AdvancedFiltersState =>
    config.table.enableColumnFilters
      ? (normalizeDateFilterRules(normalizeFilterEnvelope(value), {
          isDateColumn: (columnId) => dateColumnIds.has(columnId),
        }) as unknown as AdvancedFiltersState)
      : emptyAdvancedFilters();
  const enabledGrouping = (value: string[]): string[] =>
    config.table.enableGrouping ? value : [];
  const enabledPinning = (value: ColumnPinningState): ColumnPinningState =>
    config.table.enableColumnPinning ? value : emptyPinning();
  const enabledSizing = (value: unknown): Record<string, number> =>
    config.table.enableColumnResizing
      ? normalizeColumnSizing(value, columnIds)
      : {};
  const offeredDisplayModes = resolveDisplayModes(config.table.displayModes, {
    planning,
    renderers,
  });
  const enabledDisplayMode = (requested?: TableDisplayMode): TableDisplayMode =>
    resolveDisplayMode({
      allowed: offeredDisplayModes,
      fallback: config.table.defaultDisplayMode,
      requested,
    });

  const snapshot = computed<TableViewConfig>(() => ({
    ...createTableViewSnapshot({
      density: density.value,
      footerCalculationsVisible: footerCalculationsVisible.value,
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
      gantt: gantt.value,
      gallery: gallery.value,
      ...modeConfigs.value,
      grouping: enabledGrouping(grouping.value),
      pinning: enabledPinning(pinning.value),
      pageSize: pagination.value.pageSize,
    }),
    // Empty grouping is intentional, even when a Kanban lane is configured.
    grouping: enabledGrouping(grouping.value),
  }));

  /** Per-mode settings without their own URL migrations. */
  const readModeSettings = (
    params: URLSearchParams,
    defaults: TableViewConfig
  ): void => {
    gantt.value = normalizeGanttView(
      parseJson(params.get(`${urlPrefix}-gantt`), defaults.gantt ?? {})
    );
    modeConfigs.value = Object.fromEntries(
      GENERIC_MODE_CONFIG_KEYS.map((key) => [
        key,
        parseJson(
          params.get(`${urlPrefix}-${key}`),
          (defaults[key] ?? {}) as Record<string, unknown>
        ),
      ])
    );
    gallery.value = parseJson(
      params.get(`${urlPrefix}-gallery`),
      defaults.gallery ?? {}
    );
  };

  const fromUrl = (): void => {
    if (!syncUrl || typeof window === "undefined") {
      hydrating = false;
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const defaults = resolveView({});
    search.value = params.get(`${urlPrefix}-q`) ?? "";
    filters.value = enabledFilters(
      parseJson(params.get(`${urlPrefix}-filters`), [])
    );
    advancedFilters.value = enabledAdvancedFilters(
      parseJson(
        params.get(`${urlPrefix}-advancedFilters`),
        emptyAdvancedFilters()
      )
    );
    sorting.value = parseJson(
      params.get(`${urlPrefix}-sort`),
      config.columns.sort ?? []
    );
    visibility.value = parseJson(
      params.get(`${urlPrefix}-visibility`),
      defaults.columnVisibility ?? {}
    );
    order.value = parseJson(
      params.get(`${urlPrefix}-order`),
      config.columns.order
    );
    sizing.value = enabledSizing(
      parseJson(params.get(`${urlPrefix}-sizing`), {})
    );
    grouping.value = enabledGrouping(
      parseJson(params.get(`${urlPrefix}-grouping`), [])
    );
    pinning.value = enabledPinning(
      parseJson(params.get(`${urlPrefix}-pinning`), emptyPinning())
    );
    pagination.value = {
      pageIndex: Math.max(
        0,
        positiveInteger(params.get(`${urlPrefix}-page`), 0)
      ),
      pageSize: positiveInteger(
        params.get(`${urlPrefix}-pageSize`),
        config.table.defaultPageSize
      ),
    };
    const requestedMode = params.get(
      `${urlPrefix}-display`
    ) as TableDisplayMode | null;
    displayMode.value = enabledDisplayMode(requestedMode ?? undefined);
    kanban.value = parseJson(
      params.get(`${urlPrefix}-kanban`),
      defaults.kanban ?? {}
    );
    if (!kanban.value.groupBy) {
      kanban.value = {
        ...kanban.value,
        groupBy:
          params.get(`${urlPrefix}-kanbanGroupBy`) ??
          config.table.kanban?.groupBy,
      };
    }
    if (
      displayMode.value === "kanban" &&
      !params.has(`${urlPrefix}-grouping`) &&
      (params.has(`${urlPrefix}-kanban`) ||
        params.has(`${urlPrefix}-kanbanGroupBy`)) &&
      kanban.value.groupBy
    ) {
      grouping.value = enabledGrouping([kanban.value.groupBy]);
    }
    readModeSettings(params, defaults);
    activeViewId.value =
      params.get(viewKey) ?? (hydrating ? initialViewId : undefined);
    hydrating = false;
  };

  const serializedGrouping = computed(() =>
    grouping.value.length || kanban.value.groupBy
      ? serialize(grouping.value)
      : undefined
  );
  const serializePresent = (value: object): string | undefined =>
    Object.keys(value).length ? serialize(value) : undefined;
  const commitUrl = (): void => {
    const url = new URL(window.location.href);
    const set = (key: string, value: string | undefined): void =>
      value ? url.searchParams.set(key, value) : url.searchParams.delete(key);
    set(`${urlPrefix}-q`, search.value || undefined);
    set(
      `${urlPrefix}-filters`,
      filters.value.length ? serialize(filters.value) : undefined
    );
    set(
      `${urlPrefix}-advancedFilters`,
      advancedFilters.value.filters.length
        ? serialize(advancedFilters.value)
        : undefined
    );
    set(
      `${urlPrefix}-sort`,
      sorting.value.length ? serialize(sorting.value) : undefined
    );
    set(`${urlPrefix}-visibility`, serialize(visibility.value));
    set(`${urlPrefix}-order`, serialize(order.value));
    set(
      `${urlPrefix}-sizing`,
      Object.keys(sizing.value).length ? serialize(sizing.value) : undefined
    );
    set(`${urlPrefix}-grouping`, serializedGrouping.value);
    set(`${urlPrefix}-pinning`, serializeEncoded(pinning.value));
    set(
      `${urlPrefix}-page`,
      pagination.value.pageIndex
        ? String(pagination.value.pageIndex)
        : undefined
    );
    set(
      `${urlPrefix}-pageSize`,
      pagination.value.pageSize !== config.table.defaultPageSize
        ? String(pagination.value.pageSize)
        : undefined
    );
    set(
      `${urlPrefix}-display`,
      displayMode.value !== (config.table.defaultDisplayMode ?? "table")
        ? displayMode.value
        : undefined
    );
    set(`${urlPrefix}-kanban`, serializePresent(kanban.value));
    set(`${urlPrefix}-gantt`, serializePresent(gantt.value));
    set(`${urlPrefix}-gallery`, serializePresent(gallery.value));
    for (const key of GENERIC_MODE_CONFIG_KEYS) {
      set(
        `${urlPrefix}-${key}`,
        serializePresent(modeConfigs.value[key] ?? {})
      );
    }
    set(viewKey, activeViewId.value);
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
        footerCalculationsVisible: input.footerCalculationsVisible ?? true,
        density: isTableDensity(input.density)
          ? input.density
          : config.table.density,
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
        gantt: normalizeGanttView(input.gantt ?? config.table.gantt),
        gallery: input.gallery ?? { ...config.table.gallery },
        ...Object.fromEntries(
          GENERIC_MODE_CONFIG_KEYS.map((key) => [
            key,
            input[key] ?? {
              ...(
                pickGenericModeSettings(config.table) as Record<
                  string,
                  object | undefined
                >
              )[key],
            },
          ])
        ),
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
    densityOverride.value = view.density;
    footerCalculationsVisible.value = view.footerCalculationsVisible ?? true;
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
    gantt.value = normalizeGanttView(view.gantt);
    gallery.value = view.gallery ?? {};
    modeConfigs.value = Object.fromEntries(
      GENERIC_MODE_CONFIG_KEYS.map((key) => [
        key,
        (view[key] ?? {}) as Record<string, unknown>,
      ])
    );
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
      gantt,
      gallery,
      modeConfigs,
      activeViewId,
    ],
    writeUrl,
    { deep: true }
  );
  // A new query starts on the first page. Synchronous, so it runs while the
  // URL is read: arrival keeps the link's page, and `fromUrl` sets the page
  // after the query on back and forward.
  watch(
    [search, filters, advancedFilters, sorting],
    () => {
      if (!hydrating && pagination.value.pageIndex !== 0) {
        pagination.value = { ...pagination.value, pageIndex: 0 };
      }
    },
    { deep: true, flush: "sync" }
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
    offeredDisplayModes,
    density,
    footerCalculationsVisible,
    kanban,
    gantt,
    gallery,
    list,
    modeConfigs,
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
