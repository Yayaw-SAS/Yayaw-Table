/**
 * Hook for managing URL state with nuqs
 * Allows sharing links to specific table states
 */
"use client";

import type {
  ColumnFiltersState,
  ColumnPinningState,
  ColumnSizingState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import { atom, useAtom, useStore } from "jotai";
import { atomFamily } from "jotai-family";
import { createParser, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { filterResetVersionAtom } from "../atoms/table-atoms";
import { useTableStateSync } from "../providers/table-state-sync-provider";
import type {
  TableDisplayMode,
  TableGalleryViewConfig,
  TableKanbanViewConfig,
} from "../types/display-types";
import type { AdvancedFiltersState } from "../types/filter-types";
import type { TableViewConfig } from "../types/view-types";
import {
  normalizeColumnSizing,
  normalizeFilterEnvelope,
} from "../utils/table-contracts";
import {
  createTableViewConfigSnapshot,
  normalizeColumnPinning,
  normalizeGroupingState,
  normalizeTableViewConfig,
} from "../utils/table-view-state";

// Simple debounce implementation to avoid lodash dependency
function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): T & { cancel: () => void } {
  let timeout: NodeJS.Timeout | null = null;
  const cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  const debounced = ((...args: unknown[]) => {
    cancel();
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
  return Object.assign(debounced, { cancel });
}

// Debug flag to help track sorting issues
const _DEBUG = false;

const parsePositiveInt = (
  value: string | null | undefined,
  fallback: number
) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_DISPLAY_MODE: TableDisplayMode = "table";

const localTableStateAtom = atomFamily((_tableId: string) =>
  atom<Record<string, unknown>>({})
);

const useStateChannel = <T,>(
  tableId: string,
  shouldSyncUrl: boolean,
  key: string,
  urlValue: T,
  urlSetter: unknown,
  defaultValue: T
): [T, (value: T | null, options?: unknown) => unknown] => {
  const [localState, setLocalState] = useAtom(localTableStateAtom(tableId));
  const setValue = useCallback(
    (value: T | null, options?: unknown) => {
      if (shouldSyncUrl) {
        return (
          urlSetter as (next: T | null, nextOptions?: unknown) => unknown
        )(value, options);
      }
      setLocalState((current) => ({ ...current, [key]: value }));
    },
    [key, setLocalState, shouldSyncUrl, urlSetter]
  );
  let value = defaultValue;
  if (shouldSyncUrl) {
    value = urlValue;
  } else if (Object.hasOwn(localState, key)) {
    value = localState[key] as T;
  }
  return [value, setValue];
};

const normalizePageSize = (value: number | undefined) =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : DEFAULT_PAGE_SIZE;

const normalizeDisplayMode = (
  value: null | string | undefined
): TableDisplayMode | undefined => {
  if (value === "gallery" || value === "kanban" || value === "table") {
    return value;
  }

  return;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const stripKanbanGrouping = (
  config: TableKanbanViewConfig | null | undefined
): TableKanbanViewConfig | undefined => {
  if (!config) {
    return;
  }

  const { groupBy: _groupBy, ...rest } = config;
  const normalized: TableKanbanViewConfig = { ...rest };
  for (const key of Object.keys(normalized) as Array<
    keyof TableKanbanViewConfig
  >) {
    if (normalized[key] === undefined) {
      delete normalized[key];
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const toValidDate = (value: unknown): Date | undefined => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
  }

  return;
};

const normalizeBetweenDateValues = (values: unknown): unknown => {
  if (!Array.isArray(values)) {
    const singleDate = toValidDate(values);
    return singleDate ? ([singleDate, singleDate] as [Date, Date]) : values;
  }

  const startDate = toValidDate(values[0]);
  const endDate = toValidDate(values[1] ?? values[0]);
  if (startDate && endDate) {
    return [startDate, endDate] as [Date, Date];
  }
  if (startDate) {
    return [startDate, startDate] as [Date, Date];
  }
  if (endDate) {
    return [endDate, endDate] as [Date, Date];
  }
  return values;
};

const normalizeSingleDateValue = (values: unknown): unknown => {
  const parsedDate = toValidDate(Array.isArray(values) ? values[0] : values);
  return parsedDate ?? values;
};

const normalizeDateFilterValues = (
  operator: unknown,
  values: unknown
): unknown => {
  const operatorKey = typeof operator === "string" ? operator : "";
  if (operatorKey === "isEmpty" || operatorKey === "isNotEmpty") {
    return values;
  }

  if (operatorKey === "between") {
    return normalizeBetweenDateValues(values);
  }

  return normalizeSingleDateValue(values);
};

const normalizeAdvancedFilter = (filter: unknown): unknown => {
  if (!isRecord(filter)) {
    return filter;
  }

  const normalizedFilter: Record<string, unknown> = { ...filter };

  const createdAt = toValidDate(normalizedFilter.createdAt);
  if (createdAt) {
    normalizedFilter.createdAt = createdAt;
  }

  const updatedAt = toValidDate(normalizedFilter.updatedAt);
  if (updatedAt) {
    normalizedFilter.updatedAt = updatedAt;
  }

  if (normalizedFilter.type === "date") {
    normalizedFilter.values = normalizeDateFilterValues(
      normalizedFilter.operator,
      normalizedFilter.values
    );
  }

  return normalizedFilter;
};

// Create parsers for different types of state
const arrayParser = createParser({
  parse: (value: string) => (value ? JSON.parse(value) : []),
  serialize: (value: unknown[]) => (value?.length ? JSON.stringify(value) : ""),
});

const objectParser = createParser({
  parse: (value: string) => (value ? JSON.parse(value) : {}),
  serialize: (value: object) =>
    Object.keys(value || {}).length ? JSON.stringify(value) : "",
});

const galleryParser = createParser({
  parse: (value: string): TableGalleryViewConfig => {
    try {
      const parsed = value ? JSON.parse(value) : {};
      return isRecord(parsed) ? (parsed as TableGalleryViewConfig) : {};
    } catch {
      return {};
    }
  },
  serialize: (value: TableGalleryViewConfig) =>
    Object.keys(value || {}).length ? JSON.stringify(value) : "",
});

const kanbanParser = createParser({
  parse: (value: string): TableKanbanViewConfig => {
    try {
      const parsed = value ? JSON.parse(value) : {};
      return isRecord(parsed) ? (parsed as TableKanbanViewConfig) : {};
    } catch {
      return {};
    }
  },
  serialize: (value: TableKanbanViewConfig) => {
    const nextValue = stripKanbanGrouping(value);
    return nextValue ? JSON.stringify(nextValue) : "";
  },
});

// Parser for advanced filters
const advancedFiltersParser = createParser({
  parse: (value: string) => {
    try {
      const parsedValue = value ? JSON.parse(value) : [];
      return normalizeFilterEnvelope(parsedValue).filters.map(
        normalizeAdvancedFilter
      ) as unknown as AdvancedFiltersState;
    } catch {
      return [];
    }
  },
  serialize: (value: AdvancedFiltersState) =>
    value?.length ? JSON.stringify(value) : "",
});

// Using URL state as the single source of truth - no Jotai atoms

/**
 * Interface for pagination parameters
 */
interface PaginationParams {
  /**
   * Current page index (0-based)
   */
  pageIndex?: number;

  /**
   * Number of items per page
   */
  pageSize?: number;
}

/**
 * Options for the useTableUrlState hook
 */
interface UseTableUrlStateOptions {
  /**
   * Display mode used when the URL does not already carry table display state.
   * @default "table"
   */
  defaultDisplayMode?: TableDisplayMode;

  /**
   * Page size used when the URL does not already carry table pagination state.
   * @default 10
   */
  defaultPageSize?: number;

  /**
   * Whether URL state management is enabled
   * @default true
   */
  enabled?: boolean;

  /**
   * Unique identifier for the table
   */
  tableId: string;
}

/**
 * Hook for managing table state through URL parameters using nuqs
 * Enables shareable table configurations and server-side processing
 *
 * @param options - Configuration options
 * @returns Object with URL state utilities and parameters
 */
export function useTableUrlState({
  defaultDisplayMode,
  defaultPageSize,
  enabled,
  tableId,
}: UseTableUrlStateOptions) {
  const store = useStore();
  const inheritedSync = useTableStateSync();
  const shouldSyncUrl = enabled ?? inheritedSync;
  const resetVersionAtom = filterResetVersionAtom(tableId);
  const resolvedDefaultPageSize = normalizePageSize(defaultPageSize);
  const defaultPageSizeParam = resolvedDefaultPageSize.toString();
  const resolvedDefaultDisplayMode =
    normalizeDisplayMode(defaultDisplayMode) ?? DEFAULT_DISPLAY_MODE;

  // Track if we're currently syncing to prevent loops
  const isSyncing = useRef(false);

  // Batch update queue
  const updateQueue = useRef<Array<() => void>>([]);
  const batchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Process batched updates
  const processBatchedUpdates = useCallback(() => {
    if (updateQueue.current.length === 0) {
      return;
    }

    isSyncing.current = true;
    try {
      // Execute all queued updates
      for (const update of updateQueue.current) {
        update();
      }
    } finally {
      updateQueue.current = [];
      isSyncing.current = false;
    }
  }, []);

  // Helper function to queue URL parameter updates
  const queueUrlUpdate = useCallback(
    <T>(setter: (value: T) => void, updateValue: T) => {
      if (isSyncing.current) {
        return;
      }

      updateQueue.current.push(() =>
        // Pass shallow replace options to avoid full navigation and keep focus
        (setter as unknown as (value: T, options?: unknown) => void)(
          updateValue,
          { shallow: true, history: "replace", scroll: false }
        )
      );

      // Clear existing timeout
      if (batchTimeout.current !== null) {
        clearTimeout(batchTimeout.current);
      }

      // Schedule batch update (SSR-safe)
      batchTimeout.current = setTimeout(processBatchedUpdates, 0);
    },
    [processBatchedUpdates]
  );

  // URL parameters using nuqs
  // View and history management
  const [urlViewParam, setUrlViewParam] = useQueryState("view");
  const [viewParam, setViewParam] = useStateChannel(
    tableId,
    shouldSyncUrl,
    "view",
    urlViewParam,
    setUrlViewParam,
    null
  );
  const [urlHistoryIndexParam, setUrlHistoryIndexParam] = useQueryState(
    "historyIndex",
    {
      defaultValue: "0",
    }
  );
  const [historyIndexParam, setHistoryIndexParam] = useStateChannel(
    tableId,
    shouldSyncUrl,
    "historyIndex",
    urlHistoryIndexParam,
    setUrlHistoryIndexParam,
    "0"
  );

  // Table state parameters
  const [urlSortParam, setUrlSortParam] = useQueryState(
    `${tableId}-sort`,
    arrayParser
  );
  const [sortParam, setSortParam] = useStateChannel(
    tableId,
    shouldSyncUrl,
    "sort",
    urlSortParam as SortingState,
    setUrlSortParam,
    [] as SortingState
  );

  const [urlFiltersParam, setUrlFiltersParam] = useQueryState(
    `${tableId}-filters`,
    arrayParser
  );
  const [filtersParam, setFiltersParam] = useStateChannel(
    tableId,
    shouldSyncUrl,
    "filters",
    urlFiltersParam as ColumnFiltersState,
    setUrlFiltersParam,
    [] as ColumnFiltersState
  );

  // Advanced filters parameter
  const [urlAdvancedFiltersParam, setUrlAdvancedFiltersParam] = useQueryState(
    `${tableId}-advancedFilters`,
    advancedFiltersParser
  );
  const [advancedFiltersParam, setAdvancedFiltersParam] = useStateChannel(
    tableId,
    shouldSyncUrl,
    "advancedFilters",
    urlAdvancedFiltersParam,
    setUrlAdvancedFiltersParam,
    [] as AdvancedFiltersState
  );

  const [urlPageParam, setUrlPageParam] = useQueryState(`${tableId}-page`, {
    defaultValue: "0",
  });
  const [pageParam, setPageParam] = useStateChannel(
    tableId,
    shouldSyncUrl,
    "page",
    urlPageParam,
    setUrlPageParam,
    "0"
  );

  const [urlPageSizeParam, setUrlPageSizeParam] = useQueryState(
    `${tableId}-pageSize`,
    {
      defaultValue: defaultPageSizeParam,
    }
  );
  const [pageSizeParam, setPageSizeParam] = useStateChannel(
    tableId,
    shouldSyncUrl,
    "pageSize",
    urlPageSizeParam,
    setUrlPageSizeParam,
    defaultPageSizeParam
  );

  const [urlVisibilityParam, setUrlVisibilityParam] = useQueryState(
    `${tableId}-visibility`,
    objectParser
  );
  const [visibilityParam, setVisibilityParam] = useStateChannel(
    tableId,
    shouldSyncUrl,
    "visibility",
    urlVisibilityParam as VisibilityState,
    setUrlVisibilityParam,
    {} as VisibilityState
  );

  const [urlOrderParam, setUrlOrderParam] = useQueryState(
    `${tableId}-order`,
    arrayParser
  );
  const [orderParam, setOrderParam] = useStateChannel(
    tableId,
    shouldSyncUrl,
    "order",
    urlOrderParam as string[],
    setUrlOrderParam,
    [] as string[]
  );

  const [urlSizingParam, setUrlSizingParam] = useQueryState(
    `${tableId}-sizing`,
    objectParser
  );
  const [sizingParam, setSizingParam] = useStateChannel(
    tableId,
    shouldSyncUrl,
    "sizing",
    normalizeColumnSizing(urlSizingParam) as ColumnSizingState,
    setUrlSizingParam,
    {} as ColumnSizingState
  );

  const [urlExpandedParam, setUrlExpandedParam] = useQueryState<object>(
    `${tableId}-expanded`,
    createParser({
      parse: (value: string) => {
        try {
          if (!value) {
            return {};
          }
          // Handle double-encoded values robustly
          const safeDecode = (input: string): string => {
            let out = input;
            for (let i = 0; i < 2; i++) {
              try {
                const dec = decodeURIComponent(out);
                if (dec === out) {
                  break;
                }
                out = dec;
              } catch {
                break;
              }
            }
            return out;
          };
          const decoded = safeDecode(value);
          const parsed = JSON.parse(decoded);
          if (typeof parsed === "object" && parsed !== null) {
            return parsed as object;
          }
          return {};
        } catch {
          return {};
        }
      },
      serialize: (value: object) => {
        const safe = value || {};
        return Object.keys(safe).length
          ? encodeURIComponent(JSON.stringify(safe))
          : "";
      },
    })
  );
  const [expandedParam, setExpandedParam] = useStateChannel(
    tableId,
    shouldSyncUrl,
    "expanded",
    urlExpandedParam,
    setUrlExpandedParam,
    {}
  );

  const [urlGroupingParam, setUrlGroupingParam] = useQueryState(
    `${tableId}-grouping`,
    arrayParser
  );
  const [groupingParam, setGroupingParam] = useStateChannel(
    tableId,
    shouldSyncUrl,
    "grouping",
    urlGroupingParam as string[],
    setUrlGroupingParam,
    [] as string[]
  );

  const [urlDisplayModeParam, setUrlDisplayModeParam] = useQueryState(
    `${tableId}-display`
  );
  const [displayModeParam, setDisplayModeParam] = useStateChannel(
    tableId,
    shouldSyncUrl,
    "displayMode",
    urlDisplayModeParam,
    setUrlDisplayModeParam,
    null
  );

  const [urlKanbanGroupByParam, setUrlKanbanGroupByParam] = useQueryState(
    `${tableId}-kanbanGroupBy`
  );
  const [kanbanGroupByParam, setKanbanGroupByParam] = useStateChannel(
    tableId,
    shouldSyncUrl,
    "kanbanGroupBy",
    urlKanbanGroupByParam,
    setUrlKanbanGroupByParam,
    null
  );

  const [urlKanbanParam, setUrlKanbanParam] = useQueryState(
    `${tableId}-kanban`,
    kanbanParser
  );
  const [kanbanParam, setKanbanParam] = useStateChannel(
    tableId,
    shouldSyncUrl,
    "kanban",
    urlKanbanParam,
    setUrlKanbanParam,
    {} as TableKanbanViewConfig
  );

  const [urlGalleryParam, setUrlGalleryParam] = useQueryState(
    `${tableId}-gallery`,
    galleryParser
  );
  const [galleryParam, setGalleryParam] = useStateChannel(
    tableId,
    shouldSyncUrl,
    "gallery",
    urlGalleryParam,
    setUrlGalleryParam,
    {} as TableGalleryViewConfig
  );

  const resolvedKanbanParam = useMemo<TableKanbanViewConfig>(() => {
    if (kanbanParam?.groupBy || !kanbanGroupByParam) {
      return (kanbanParam || {}) as TableKanbanViewConfig;
    }

    return {
      ...(kanbanParam || {}),
      groupBy: kanbanGroupByParam,
    };
  }, [kanbanGroupByParam, kanbanParam]);
  const resolvedGroupingParam = useMemo(
    () =>
      normalizeGroupingState(
        groupingParam,
        resolvedKanbanParam.groupBy || kanbanGroupByParam || undefined
      ),
    [groupingParam, kanbanGroupByParam, resolvedKanbanParam.groupBy]
  );
  const resolvedKanbanCardParam = useMemo(
    () => stripKanbanGrouping(resolvedKanbanParam) ?? {},
    [resolvedKanbanParam]
  );

  // Global search parameter (server-side global filter)
  const [urlGlobalSearchParam, setUrlGlobalSearchParam] = useQueryState(
    `${tableId}-q`
  );
  const [globalSearchParam, setGlobalSearchParam] = useStateChannel(
    tableId,
    shouldSyncUrl,
    "globalSearch",
    urlGlobalSearchParam,
    setUrlGlobalSearchParam,
    null
  );

  // Column pinning parameter
  const [urlPinningParam, setUrlPinningParam] = useQueryState(
    `${tableId}-pinning`,
    {
      defaultValue: "",
      parse: (value) =>
        value ? JSON.parse(decodeURIComponent(value)) : { left: [], right: [] },
      serialize: (value) => {
        // Only serialize if we have pinned columns
        const hasLeft = value?.left?.length > 0;
        const hasRight = value?.right?.length > 0;
        return hasLeft || hasRight
          ? encodeURIComponent(JSON.stringify(value))
          : "";
      },
    }
  );
  const [pinningParam, setPinningParam] = useStateChannel(
    tableId,
    shouldSyncUrl,
    "pinning",
    urlPinningParam,
    setUrlPinningParam,
    { left: [], right: [] }
  );

  type TableParamValue =
    | ColumnFiltersState
    | SortingState
    | Record<string, boolean>
    | Record<string, number>
    | string[]
    | AdvancedFiltersState
    | string
    | null;

  const debouncedSetParamRef = useRef<
    | ((key: string, value: TableParamValue, resetVersion?: number) => void)
    | null
  >(null);

  // Create debounced setter on mount
  useEffect(() => {
    const debouncedSetParam = debounce((...args: unknown[]) => {
      const [key, value, resetVersion] = args as [
        string,
        TableParamValue,
        number?,
      ];
      // A reset in any hook for this table supersedes pending filter edits.
      if (
        resetVersion !== undefined &&
        resetVersion !== store.get(resetVersionAtom)
      ) {
        return;
      }
      if (key.includes("filters") && !key.includes("advancedFilters")) {
        (
          setFiltersParam as unknown as (
            v: ColumnFiltersState,
            o?: unknown
          ) => void
        )(value as ColumnFiltersState, {
          shallow: true,
          history: "replace",
          scroll: false,
        });
      } else if (key.includes("advancedFilters")) {
        (
          setAdvancedFiltersParam as unknown as (
            v: AdvancedFiltersState,
            o?: unknown
          ) => void
        )(value as AdvancedFiltersState, {
          shallow: true,
          history: "replace",
          scroll: false,
        });
      } else if (key.includes("sort")) {
        (setSortParam as unknown as (v: SortingState, o?: unknown) => void)(
          value as SortingState,
          {
            shallow: true,
            history: "replace",
            scroll: false,
          }
        );
      } else if (key.endsWith("-q")) {
        (setGlobalSearchParam as unknown as (v: string, o?: unknown) => void)(
          value as unknown as string,
          {
            shallow: true,
            history: "replace",
            scroll: false,
          }
        );
      }
      // Add other param setters as needed
    }, 150);
    debouncedSetParamRef.current = debouncedSetParam;
    return () => {
      debouncedSetParam.cancel();
      debouncedSetParamRef.current = null;
    };
  }, [
    resetVersionAtom,
    store,
    setFiltersParam,
    setAdvancedFiltersParam,
    setSortParam,
    setGlobalSearchParam,
  ]);

  const setColumnFiltersFromUI = useCallback(
    (filters: ColumnFiltersState) => {
      debouncedSetParamRef.current?.(
        `${tableId}-filters`,
        filters,
        store.get(resetVersionAtom)
      );
    },
    [resetVersionAtom, store, tableId]
  );

  // Advanced filters setter
  const setAdvancedFiltersFromUI = useCallback(
    (filters: AdvancedFiltersState) => {
      // Write as-is; server/mock layer ignores inactive or empty filters
      debouncedSetParamRef.current?.(
        `${tableId}-advancedFilters`,
        filters,
        store.get(resetVersionAtom)
      );
    },
    [resetVersionAtom, store, tableId]
  );

  const setSorting = useCallback(
    (sorting: SortingState) => {
      debouncedSetParamRef.current?.(`${tableId}-sort`, sorting);
    },
    [tableId]
  );

  // Global search setter
  const setGlobalSearchFromUI = useCallback(
    (value: string) => {
      debouncedSetParamRef.current?.(
        `${tableId}-q`,
        value || "",
        store.get(resetVersionAtom)
      );
    },
    [resetVersionAtom, store, tableId]
  );

  // Clear every filtering input while preserving the table's presentation.
  const resetFilters = useCallback(() => {
    store.set(resetVersionAtom, (version) => version + 1);
    queueUrlUpdate(setFiltersParam, null);
    queueUrlUpdate(setAdvancedFiltersParam, null);
    queueUrlUpdate(setGlobalSearchParam, null);
    queueUrlUpdate(setPageParam, "0");
  }, [
    queueUrlUpdate,
    resetVersionAtom,
    setFiltersParam,
    setAdvancedFiltersParam,
    setGlobalSearchParam,
    setPageParam,
    store,
  ]);

  // Method to reset only advanced filters
  const resetAdvancedFilters = useCallback(() => {
    queueUrlUpdate(setAdvancedFiltersParam, []);
  }, [queueUrlUpdate, setAdvancedFiltersParam]);

  // Methods for other URL parameters
  const setPaginationFromUI = useCallback(
    (paginationParams: PaginationParams) => {
      // Use default values if pageIndex or pageSize are undefined
      const pageIndex = paginationParams.pageIndex ?? 0;
      const pageSize = paginationParams.pageSize ?? resolvedDefaultPageSize;
      const currentPageIndex = parsePositiveInt(pageParam, 0);
      const currentPageSize = parsePositiveInt(
        pageSizeParam,
        resolvedDefaultPageSize
      );

      // Avoid redundant URL writes (prevents replaceState flood / browser throttling)
      if (currentPageIndex !== pageIndex) {
        queueUrlUpdate(setPageParam, pageIndex.toString());
      }

      if (currentPageSize !== pageSize) {
        queueUrlUpdate(setPageSizeParam, pageSize.toString());
      }
    },
    [
      pageParam,
      pageSizeParam,
      queueUrlUpdate,
      resolvedDefaultPageSize,
      setPageParam,
      setPageSizeParam,
    ]
  );

  const setVisibilityFromUI = useCallback(
    (visibility: Record<string, boolean>) => {
      queueUrlUpdate(setVisibilityParam, visibility);
    },
    [queueUrlUpdate, setVisibilityParam]
  );

  const setOrderFromUI = useCallback(
    (order: string[]) => {
      queueUrlUpdate(setOrderParam, order);
    },
    [queueUrlUpdate, setOrderParam]
  );

  const setSizingFromUI = useCallback(
    (sizing: ColumnSizingState) => {
      queueUrlUpdate(setSizingParam, normalizeColumnSizing(sizing));
    },
    [queueUrlUpdate, setSizingParam]
  );

  const setExpandedFromUI = useCallback(
    (expanded: Record<string, boolean>) => {
      // Apply immediately to avoid race conditions with grouping/expansion
      setExpandedParam(expanded);
    },
    [setExpandedParam]
  );

  const setGroupingFromUI = useCallback(
    (grouping: string[]) => {
      const nextGrouping = normalizeGroupingState(grouping);
      // Apply immediately to keep TanStack grouping in sync with UI without batching lag
      setGroupingParam(nextGrouping);
      setKanbanGroupByParam(null);
      if (kanbanParam?.groupBy) {
        setKanbanParam(stripKanbanGrouping(kanbanParam) ?? null);
      }
    },
    [kanbanParam, setGroupingParam, setKanbanGroupByParam, setKanbanParam]
  );

  const getDisplayModeUrlValue = useCallback(
    (displayMode: TableDisplayMode): null | string => {
      return displayMode === resolvedDefaultDisplayMode ? null : displayMode;
    },
    [resolvedDefaultDisplayMode]
  );

  const setDisplayModeFromUI = useCallback(
    (displayMode: TableDisplayMode) => {
      setDisplayModeParam(getDisplayModeUrlValue(displayMode));
    },
    [getDisplayModeUrlValue, setDisplayModeParam]
  );

  const setKanbanGroupByFromUI = useCallback(
    (groupBy: string | undefined) => {
      setGroupingParam(groupBy ? [groupBy] : []);
      setKanbanParam(stripKanbanGrouping(kanbanParam) ?? null);
      setKanbanGroupByParam(null);
    },
    [kanbanParam, setGroupingParam, setKanbanGroupByParam, setKanbanParam]
  );

  const setKanbanFromUI = useCallback(
    (kanban: TableKanbanViewConfig | undefined) => {
      if (kanban?.groupBy) {
        setGroupingParam([kanban.groupBy]);
      }

      const nextKanban = stripKanbanGrouping(kanban);
      const hasKanbanValues = Boolean(
        nextKanban && Object.keys(nextKanban).length > 0
      );
      if (hasKanbanValues && nextKanban) {
        setKanbanParam(nextKanban);
        setKanbanGroupByParam(null);
        return;
      }

      setKanbanParam(null);
      setKanbanGroupByParam(null);
    },
    [setGroupingParam, setKanbanGroupByParam, setKanbanParam]
  );

  const setGalleryFromUI = useCallback(
    (gallery: TableGalleryViewConfig | undefined) => {
      const hasGalleryValues = Boolean(
        gallery && Object.keys(gallery).length > 0
      );
      if (hasGalleryValues && gallery) {
        setGalleryParam(gallery);
        return;
      }

      setGalleryParam(null);
    },
    [setGalleryParam]
  );

  // Handler for column pinning changes from UI
  const setPinningFromUI = useCallback(
    (pinning: { left: string[]; right: string[] }) => {
      queueUrlUpdate(setPinningParam, pinning);
    },
    [queueUrlUpdate, setPinningParam]
  );

  const getCurrentViewConfig = useCallback((): TableViewConfig => {
    return createTableViewConfigSnapshot({
      advancedFiltersParam: (advancedFiltersParam ||
        []) as AdvancedFiltersState,
      displayModeParam:
        normalizeDisplayMode(displayModeParam) ?? resolvedDefaultDisplayMode,
      filtersParam: (filtersParam || []) as ColumnFiltersState,
      globalSearchParam: globalSearchParam || "",
      galleryParam: (galleryParam || {}) as TableGalleryViewConfig,
      groupingParam: resolvedGroupingParam,
      kanbanParam: resolvedKanbanCardParam,
      kanbanGroupByParam: kanbanGroupByParam || "",
      orderParam: (orderParam || []) as string[],
      pageSizeParam: pageSizeParam || defaultPageSizeParam,
      pinningParam: normalizeColumnPinning(
        pinningParam as ColumnPinningState | undefined
      ),
      sizingParam: normalizeColumnSizing(sizingParam),
      sortParam: (sortParam || []) as SortingState,
      visibilityParam: (visibilityParam || {}) as VisibilityState,
    });
  }, [
    advancedFiltersParam,
    defaultPageSizeParam,
    displayModeParam,
    filtersParam,
    galleryParam,
    globalSearchParam,
    resolvedGroupingParam,
    kanbanGroupByParam,
    orderParam,
    pageSizeParam,
    pinningParam,
    sizingParam,
    resolvedDefaultDisplayMode,
    resolvedKanbanCardParam,
    sortParam,
    visibilityParam,
  ]);

  const applyViewConfig = useCallback(
    (config: TableViewConfig, options?: { viewId?: null | string }) => {
      const nextPinning = normalizeColumnPinning(config.columnPinning) ?? {
        left: [],
        right: [],
      };
      const nextPageSize = normalizePageSize(config.pageSize);
      const normalizedConfig = normalizeTableViewConfig(config);

      queueUrlUpdate(setViewParam, options?.viewId ?? null);
      queueUrlUpdate(setHistoryIndexParam, "0");
      queueUrlUpdate(setSortParam, config.sorting ?? []);
      queueUrlUpdate(setFiltersParam, config.columnFilters ?? []);
      queueUrlUpdate(setAdvancedFiltersParam, config.advancedFilters ?? []);
      queueUrlUpdate(setGlobalSearchParam, config.globalSearch || null);
      queueUrlUpdate(
        setDisplayModeParam,
        getDisplayModeUrlValue(config.displayMode ?? resolvedDefaultDisplayMode)
      );
      queueUrlUpdate(setKanbanParam, normalizedConfig.kanban || null);
      queueUrlUpdate(setKanbanGroupByParam, null);
      queueUrlUpdate(setGalleryParam, config.gallery || null);
      queueUrlUpdate(setPageParam, "0");
      queueUrlUpdate(
        setPageSizeParam,
        (nextPageSize ?? resolvedDefaultPageSize).toString()
      );
      queueUrlUpdate(setVisibilityParam, config.columnVisibility ?? {});
      queueUrlUpdate(setOrderParam, config.columnOrder ?? []);
      queueUrlUpdate(setSizingParam, normalizedConfig.columnSizing ?? {});
      queueUrlUpdate(setExpandedParam, {});
      queueUrlUpdate(setGroupingParam, normalizedConfig.grouping ?? []);
      queueUrlUpdate(setPinningParam, nextPinning);
    },
    [
      queueUrlUpdate,
      getDisplayModeUrlValue,
      resolvedDefaultDisplayMode,
      resolvedDefaultPageSize,
      setAdvancedFiltersParam,
      setDisplayModeParam,
      setExpandedParam,
      setFiltersParam,
      setGalleryParam,
      setGlobalSearchParam,
      setGroupingParam,
      setHistoryIndexParam,
      setKanbanGroupByParam,
      setKanbanParam,
      setOrderParam,
      setPageParam,
      setPageSizeParam,
      setPinningParam,
      setSizingParam,
      setSortParam,
      setViewParam,
      setVisibilityParam,
    ]
  );

  // Helper function to set URL parameter if value exists
  const setUrlParam = useCallback(
    (url: URL, paramName: string, value: unknown, condition?: boolean) => {
      if (condition === false) {
        return;
      }

      if (Array.isArray(value) && value.length > 0) {
        url.searchParams.set(
          paramName,
          encodeURIComponent(JSON.stringify(value))
        );
      } else if (
        typeof value === "object" &&
        value &&
        Object.keys(value).length > 0
      ) {
        url.searchParams.set(
          paramName,
          encodeURIComponent(JSON.stringify(value))
        );
      } else if (typeof value === "string" && value) {
        url.searchParams.set(paramName, value);
      }
    },
    []
  );

  // Helper function to set table-specific parameters
  const setTableParams = useCallback(
    (url: URL) => {
      setUrlParam(url, `${tableId}-sort`, sortParam);
      setUrlParam(url, `${tableId}-filters`, filtersParam);
      setUrlParam(url, `${tableId}-advancedFilters`, advancedFiltersParam);
      setUrlParam(url, `${tableId}-q`, globalSearchParam);
      setUrlParam(url, `${tableId}-page`, pageParam);
      setUrlParam(url, `${tableId}-pageSize`, pageSizeParam);
      setUrlParam(url, `${tableId}-visibility`, visibilityParam);
      setUrlParam(url, `${tableId}-order`, orderParam);
      setUrlParam(url, `${tableId}-sizing`, sizingParam);
      setUrlParam(url, `${tableId}-expanded`, expandedParam);
      setUrlParam(url, `${tableId}-grouping`, resolvedGroupingParam);
      setUrlParam(url, `${tableId}-display`, displayModeParam);
      url.searchParams.delete(`${tableId}-kanbanGroupBy`);
      url.searchParams.delete(`${tableId}-kanban`);
      setUrlParam(url, `${tableId}-kanban`, resolvedKanbanCardParam);
      setUrlParam(url, `${tableId}-gallery`, galleryParam);

      // Special case for pinning
      if (
        pinningParam &&
        (pinningParam.left?.length || pinningParam.right?.length)
      ) {
        setUrlParam(url, `${tableId}-pinning`, pinningParam, true);
      }
    },
    [
      tableId,
      sortParam,
      filtersParam,
      advancedFiltersParam,
      pageParam,
      pageSizeParam,
      visibilityParam,
      orderParam,
      sizingParam,
      expandedParam,
      resolvedGroupingParam,
      displayModeParam,
      resolvedKanbanCardParam,
      galleryParam,
      globalSearchParam,
      pinningParam,
      setUrlParam,
    ]
  );

  // Create shareable URL with all parameters
  const createShareableUrl = useCallback(() => {
    if (typeof window === "undefined") {
      return "";
    }
    const url = new URL(window.location.href);

    // Add view and history parameters
    setUrlParam(url, "view", viewParam);
    setUrlParam(url, "historyIndex", historyIndexParam);

    // Add all table-specific parameters
    setTableParams(url);

    return url.toString();
  }, [viewParam, historyIndexParam, setUrlParam, setTableParams]);

  // Reset all URL state parameters
  const resetUrlState = useCallback(() => {
    if (isSyncing.current) {
      return;
    }

    try {
      isSyncing.current = true;
      // Reset all URL parameters
      setViewParam(null);
      setHistoryIndexParam("0");
      setSortParam([]);
      setFiltersParam([]);
      setAdvancedFiltersParam([]);
      setPageParam("0");
      setPageSizeParam(defaultPageSizeParam);
      setVisibilityParam({});
      setOrderParam([]);
      setSizingParam({});
      setExpandedParam({});
      setGroupingParam([]);
      setDisplayModeParam(null);
      setKanbanGroupByParam(null);
      setKanbanParam(null);
      setGalleryParam(null);
      setGlobalSearchParam(null);
      setPinningParam({ left: [], right: [] });
    } finally {
      // Schedule after paint (SSR-safe)
      const schedule =
        typeof window !== "undefined" &&
        typeof window.requestAnimationFrame === "function"
          ? window.requestAnimationFrame
          : (cb: FrameRequestCallback) =>
              setTimeout(cb, 0) as unknown as number;
      schedule(() => {
        isSyncing.current = false;
      });
    }
  }, [
    setViewParam,
    setHistoryIndexParam,
    setSortParam,
    setFiltersParam,
    setAdvancedFiltersParam,
    setPageParam,
    setPageSizeParam,
    setVisibilityParam,
    setOrderParam,
    setSizingParam,
    setExpandedParam,
    setGroupingParam,
    setDisplayModeParam,
    setKanbanGroupByParam,
    setKanbanParam,
    setGalleryParam,
    setGlobalSearchParam,
    setPinningParam,
    defaultPageSizeParam,
  ]);

  // Get pagination state from URL parameters
  const pagination = useMemo(
    () => ({
      pageIndex: Number.parseInt(pageParam || "0", 10),
      pageSize: parsePositiveInt(pageSizeParam, resolvedDefaultPageSize),
    }),
    [pageParam, pageSizeParam, resolvedDefaultPageSize]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (batchTimeout.current !== null) {
        clearTimeout(batchTimeout.current);
      }
    };
  }, []);

  return {
    // Utility functions
    applyViewConfig,
    createShareableUrl,
    getCurrentViewConfig,
    // Raw URL parameters
    advancedFiltersParam: advancedFiltersParam || [],
    displayModeParam:
      normalizeDisplayMode(displayModeParam) ?? resolvedDefaultDisplayMode,
    expandedParam,
    filtersParam: filtersParam || [],
    groupingParam: resolvedGroupingParam,
    galleryParam: (galleryParam || {}) as TableGalleryViewConfig,
    historyIndexParam,
    kanbanParam: resolvedKanbanCardParam,
    kanbanGroupByParam: kanbanGroupByParam || "",
    orderParam: orderParam || [],
    pageParam: pageParam || "0",
    pageSizeParam: pageSizeParam || defaultPageSizeParam,
    // Processed state
    pagination,
    pinningParam,
    resetAdvancedFilters,
    resetFilters,

    resetUrlState,

    // Setter functions for UI components
    setAdvancedFiltersFromUI,
    setAdvancedFiltersParam,
    setColumnFiltersFromUI,
    setDisplayModeFromUI,
    setDisplayModeParam,
    setExpandedFromUI,
    setGlobalSearchFromUI,
    setGalleryFromUI,
    setKanbanFromUI,
    // Raw setters (should generally not be used directly)
    setExpandedParam,
    setFiltersParam,
    setGroupingFromUI,
    setGroupingParam,
    setHistoryIndexParam,
    setKanbanGroupByFromUI,
    setKanbanGroupByParam,
    setKanbanParam,
    setGalleryParam,
    setOrderFromUI,
    setSizingFromUI,

    setOrderParam,
    setPageParam,
    setPageSizeParam,
    setPaginationFromUI,
    setPinningFromUI,
    setPinningParam,
    setSizingParam,
    setSorting,
    setSortParam,
    setViewParam,
    setVisibilityFromUI,
    setVisibilityParam,

    sortParam: sortParam || [],
    sizingParam: normalizeColumnSizing(sizingParam),
    globalSearchParam: globalSearchParam || "",
    viewParam,
    visibilityParam: visibilityParam || {},
  };
}

// Helper function to ensure consistent property order in sorting objects
function _normalizeSortingObject(sort: { desc: boolean; id: string }) {
  // TanStack Table requires sorting objects to have 'id' property first, then 'desc'
  // eslint_disable-next-line perfectionist/sort-objects
  return { id: sort.id, desc: sort.desc };
}
