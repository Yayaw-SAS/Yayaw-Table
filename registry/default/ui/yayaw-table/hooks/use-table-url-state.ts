/**
 * Hook for managing URL state with nuqs
 * Allows sharing links to specific table states
 */
"use client";

import type {
  ColumnFiltersState,
  ColumnPinningState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import { createParser, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type {
  TableDisplayMode,
  TableGalleryViewConfig,
} from "../types/display-types";
import type { AdvancedFiltersState } from "../types/filter-types";
import type { TableViewConfig } from "../types/view-types";
import {
  createTableViewConfigSnapshot,
  normalizeColumnPinning,
} from "../utils/table-view-state";

// Simple debounce implementation to avoid lodash dependency
function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): T {
  let timeout: NodeJS.Timeout | null = null;
  return ((...args: unknown[]) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
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

// Parser for advanced filters
const advancedFiltersParser = createParser({
  parse: (value: string) => {
    try {
      const parsedValue = value ? JSON.parse(value) : [];
      if (!Array.isArray(parsedValue)) {
        return [];
      }

      return parsedValue.map(normalizeAdvancedFilter) as AdvancedFiltersState;
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
  enabled: _enabled = true,
  tableId,
}: UseTableUrlStateOptions) {
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
  const [viewParam, setViewParam] = useQueryState("view");
  const [historyIndexParam, setHistoryIndexParam] = useQueryState(
    "historyIndex",
    {
      defaultValue: "0",
    }
  );

  // Table state parameters
  const [sortParam, setSortParam] = useQueryState(
    `${tableId}-sort`,
    arrayParser
  );

  const [filtersParam, setFiltersParam] = useQueryState(
    `${tableId}-filters`,
    arrayParser
  );

  // Advanced filters parameter
  const [advancedFiltersParam, setAdvancedFiltersParam] = useQueryState(
    `${tableId}-advancedFilters`,
    advancedFiltersParser
  );

  const [pageParam, setPageParam] = useQueryState(`${tableId}-page`, {
    defaultValue: "0",
  });

  const [pageSizeParam, setPageSizeParam] = useQueryState(
    `${tableId}-pageSize`,
    {
      defaultValue: defaultPageSizeParam,
    }
  );

  const [visibilityParam, setVisibilityParam] = useQueryState(
    `${tableId}-visibility`,
    objectParser
  );

  const [orderParam, setOrderParam] = useQueryState(
    `${tableId}-order`,
    arrayParser
  );

  const [expandedParam, setExpandedParam] = useQueryState<object>(
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

  const [groupingParam, setGroupingParam] = useQueryState(
    `${tableId}-grouping`,
    arrayParser
  );

  const [displayModeParam, setDisplayModeParam] = useQueryState(
    `${tableId}-display`
  );

  const [kanbanGroupByParam, setKanbanGroupByParam] = useQueryState(
    `${tableId}-kanbanGroupBy`
  );

  const [galleryParam, setGalleryParam] = useQueryState(
    `${tableId}-gallery`,
    galleryParser
  );

  // Global search parameter (server-side global filter)
  const [globalSearchParam, setGlobalSearchParam] = useQueryState(
    `${tableId}-q`
  );

  // Column pinning parameter
  const [pinningParam, setPinningParam] = useQueryState(`${tableId}-pinning`, {
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
  });

  type TableParamValue =
    | ColumnFiltersState
    | SortingState
    | Record<string, boolean>
    | string[]
    | AdvancedFiltersState
    | string
    | null;

  const debouncedSetParamRef = useRef<
    ((key: string, value: TableParamValue) => void) | null
  >(null);

  // Create debounced setter on mount
  useEffect(() => {
    if (!debouncedSetParamRef.current) {
      debouncedSetParamRef.current = debounce((...args: unknown[]) => {
        const [key, value] = args as [string, TableParamValue];
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
    }
  }, [
    setFiltersParam,
    setAdvancedFiltersParam,
    setSortParam,
    setGlobalSearchParam,
  ]);

  const setColumnFiltersFromUI = useCallback(
    (filters: ColumnFiltersState) => {
      debouncedSetParamRef.current?.(`${tableId}-filters`, filters);
    },
    [tableId]
  );

  // Advanced filters setter
  const setAdvancedFiltersFromUI = useCallback(
    (filters: AdvancedFiltersState) => {
      // Write as-is; server/mock layer ignores inactive or empty filters
      debouncedSetParamRef.current?.(`${tableId}-advancedFilters`, filters);
    },
    [tableId]
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
      debouncedSetParamRef.current?.(`${tableId}-q`, value || "");
    },
    [tableId]
  );

  // Method to reset all filters
  const resetFilters = useCallback(() => {
    queueUrlUpdate(setFiltersParam, []);
    queueUrlUpdate(setAdvancedFiltersParam, []);
  }, [queueUrlUpdate, setFiltersParam, setAdvancedFiltersParam]);

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

  const setExpandedFromUI = useCallback(
    (expanded: Record<string, boolean>) => {
      // Apply immediately to avoid race conditions with grouping/expansion
      setExpandedParam(expanded);
    },
    [setExpandedParam]
  );

  const setGroupingFromUI = useCallback(
    (grouping: string[]) => {
      // Apply immediately to keep TanStack grouping in sync with UI without batching lag
      setGroupingParam(grouping);
    },
    [setGroupingParam]
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
      setKanbanGroupByParam(groupBy || null);
    },
    [setKanbanGroupByParam]
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
      groupingParam: (groupingParam || []) as string[],
      kanbanGroupByParam: kanbanGroupByParam || "",
      orderParam: (orderParam || []) as string[],
      pageSizeParam: pageSizeParam || defaultPageSizeParam,
      pinningParam: normalizeColumnPinning(
        pinningParam as ColumnPinningState | undefined
      ),
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
    groupingParam,
    kanbanGroupByParam,
    orderParam,
    pageSizeParam,
    pinningParam,
    resolvedDefaultDisplayMode,
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
      queueUrlUpdate(setKanbanGroupByParam, config.kanban?.groupBy || null);
      queueUrlUpdate(setGalleryParam, config.gallery || null);
      queueUrlUpdate(setPageParam, "0");
      queueUrlUpdate(
        setPageSizeParam,
        (nextPageSize ?? resolvedDefaultPageSize).toString()
      );
      queueUrlUpdate(setVisibilityParam, config.columnVisibility ?? {});
      queueUrlUpdate(setOrderParam, config.columnOrder ?? []);
      queueUrlUpdate(setExpandedParam, {});
      queueUrlUpdate(setGroupingParam, config.grouping ?? []);
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
      setOrderParam,
      setPageParam,
      setPageSizeParam,
      setPinningParam,
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
      setUrlParam(url, `${tableId}-expanded`, expandedParam);
      setUrlParam(url, `${tableId}-grouping`, groupingParam);
      setUrlParam(url, `${tableId}-display`, displayModeParam);
      setUrlParam(url, `${tableId}-kanbanGroupBy`, kanbanGroupByParam);
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
      expandedParam,
      groupingParam,
      displayModeParam,
      kanbanGroupByParam,
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
      setExpandedParam({});
      setGroupingParam([]);
      setDisplayModeParam(null);
      setKanbanGroupByParam(null);
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
    setExpandedParam,
    setGroupingParam,
    setDisplayModeParam,
    setKanbanGroupByParam,
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
    groupingParam: groupingParam || [],
    galleryParam: (galleryParam || {}) as TableGalleryViewConfig,
    historyIndexParam,
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
    // Raw setters (should generally not be used directly)
    setExpandedParam,
    setFiltersParam,
    setGroupingFromUI,
    setGroupingParam,
    setHistoryIndexParam,
    setKanbanGroupByFromUI,
    setKanbanGroupByParam,
    setGalleryParam,
    setOrderFromUI,

    setOrderParam,
    setPageParam,
    setPageSizeParam,
    setPaginationFromUI,
    setPinningFromUI,
    setPinningParam,
    setSorting,
    setSortParam,
    setViewParam,
    setVisibilityFromUI,
    setVisibilityParam,

    sortParam: sortParam || [],
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
