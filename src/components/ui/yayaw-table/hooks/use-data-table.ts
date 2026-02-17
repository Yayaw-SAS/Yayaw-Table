/**
 * Main hook for data tables - Orchestrates configuration, actions, and data fetching
 * Refactored to use extracted hooks for better maintainability
 */
"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  type ColumnDef,
  type ColumnFilter,
  type ColumnSort,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type OnChangeFn,
  type PaginationState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import type * as React from "react";
import { useCallback, useMemo } from "react";

import type { ActionsColumnProps } from "../components/columns/actions-column";
import { useColumns } from "../components/columns/hooks/use-columns";
import { useTranslations } from "../providers/table-provider";
import { invalidateTableDataQuery } from "./query-cache-utils";
import type { InlineEditColumnRuntimeConfig } from "./use-inline-edit-runtime";
import { resolveInlineEditColumnConfig } from "./use-inline-edit-runtime";
import { useTableActions } from "./use-table-actions";
import { useTableConfig } from "./use-table-config";
import { useTableUrlData } from "./use-table-url-data";
import { useTableUrlState } from "./use-table-url-state";

const DEBUG = false;

function withInlineEditMeta<TData>(
  columnDef: ColumnDef<TData>,
  inlineEditMeta: InlineEditColumnRuntimeConfig
): ColumnDef<TData> {
  const existingMeta =
    (columnDef.meta as Record<string, unknown> | undefined) ?? {};

  return {
    ...columnDef,
    meta: {
      ...existingMeta,
      inlineEdit: inlineEditMeta,
    },
  };
}

/**
 * Options for the useDataTable hook
 */
export interface UseDataTableOptions<_TData = Record<string, unknown>> {
  /**
   * Whether to enable data fetching
   * Defaults to true
   */
  enabled?: boolean;

  /**
   * Initial page size
   * Defaults to 10
   */
  initialPageSize?: number;

  /**
   * Unique identifier for this table instance
   * Defaults to tableType if not provided
   */
  tableId?: string;

  /**
   * Type of table to use (corresponds to a key in the table catalogue)
   */
  tableType: string;
}

/**
 * Main hook for data tables
 * @param options Configuration options
 * @returns Everything needed to render a data table
 */
export function useDataTable<TData extends Record<string, unknown>>(
  options: UseDataTableOptions<TData>
) {
  const {
    enabled = true,
    initialPageSize: _initialPageSize = 10,
    tableType,
    tableId = tableType,
  } = options;

  // Get QueryClient instance
  const queryClient = useQueryClient();

  // Get table configuration using extracted hook
  const { config, translations } = useTableConfig(tableType);
  const tableInlineEditConfig = useMemo(() => {
    const inlineEditConfig = config.table.inlineEdit;
    const isInlineEditAllowed = config.table.allowInlineEdit !== false;

    return {
      ...inlineEditConfig,
      enabled: (inlineEditConfig?.enabled ?? false) && isInlineEditAllowed,
    };
  }, [config.table.inlineEdit, config.table.allowInlineEdit]);

  // Debug removed
  const { t } = useTranslations();

  // Set up URL state for the table
  const tableUrlState = useTableUrlState({ tableId });

  // Create a function to invalidate table data
  const invalidateTable = useCallback(async () => {
    await invalidateTableDataQuery({ queryClient, tableId });
  }, [queryClient, tableId]);

  // Get table actions using extracted hook (before queryFn to avoid circular reference)
  const {
    actions,
    handleCreate: rawHandleCreate,
    handleEdit: rawHandleEdit,
    handleDelete: rawHandleDelete,
    handleDuplicate: rawHandleDuplicate,
    hasAction: _hasAction,
    isActionsAvailable: _isActionsAvailable,
  } = useTableActions<TData>({
    tableType,
    onSuccess: async () => {
      // This will be defined later
      tableUrlState.setPageParam("0");
      await invalidateTable();
    },
  });

  const isCreateAllowed = config.table.allowCreate !== false;
  const isEditAllowed = config.table.allowEdit !== false;
  const isDuplicateAllowed = config.table.allowDuplicate !== false;
  const isDeleteAllowed = config.table.allowDelete !== false;

  const handleCreate = useCallback(
    async (payload: Partial<TData>): Promise<boolean> => {
      if (!isCreateAllowed) {
        return false;
      }
      return await rawHandleCreate(payload);
    },
    [isCreateAllowed, rawHandleCreate]
  );

  const handleEdit = useCallback(
    async (
      row: TData & { id: string },
      payload: Partial<TData>
    ): Promise<boolean> => {
      if (!isEditAllowed) {
        return false;
      }
      return await rawHandleEdit(row, payload);
    },
    [isEditAllowed, rawHandleEdit]
  );

  const handleDelete = useCallback(
    async (row: TData & { id: string }): Promise<boolean> => {
      if (!isDeleteAllowed) {
        return false;
      }
      return await rawHandleDelete(row);
    },
    [isDeleteAllowed, rawHandleDelete]
  );

  const handleDuplicate = useCallback(
    async (row: TData & { id: string }): Promise<boolean> => {
      if (!isDuplicateAllowed) {
        return false;
      }
      return await rawHandleDuplicate(row);
    },
    [isDuplicateAllowed, rawHandleDuplicate]
  );

  // Get table state from URL parameters with proper type assertions
  const columnFilters = (tableUrlState.filtersParam || []) as ColumnFilter[];
  const { pagination } = tableUrlState;

  // Helper function to build orderBy parameter
  const buildOrderByParam = useCallback((sortingParam: unknown) => {
    if (!Array.isArray(sortingParam) || sortingParam.length === 0) {
      return;
    }

    const sortItem = sortingParam[0] as { id: string; desc?: boolean };
    const sortField = sortItem.id;
    const sortDirection = sortItem.desc ? "desc" : "asc";
    const orderBy = { [sortField]: sortDirection };
    return orderBy;
  }, []);

  // Helper function to clean column filters
  const cleanColumnFilters = useCallback((columnFiltersParam: unknown) => {
    const columnFiltersTyped = (columnFiltersParam || []) as Array<{
      id: string;
      value: unknown;
    }>;

    return Object.fromEntries(
      columnFiltersTyped
        .filter(
          (filter: { id: string; value: unknown }) =>
            !["id", "key"].includes(filter.id)
        )
        .map((filter: { id: string; value: unknown }) => [
          filter.id,
          filter.value,
        ])
    );
  }, []);

  // Helper function to build request parameters
  const buildRequestParams = useCallback(
    (
      cleanedFilters: Record<string, unknown>,
      paginationTyped: { pageSize?: number; pageIndex?: number } | undefined,
      orderByParam: Record<string, string> | undefined,
      advancedFilters?: unknown
    ) => {
      const requestParams = {
        filters: cleanedFilters,
        advancedFilters: advancedFilters || [],
        limit: paginationTyped?.pageSize || 10,
        orderBy: orderByParam,
        page: (paginationTyped?.pageIndex || 0) + 1,
      };
      return requestParams;
    },
    []
  );

  // Create query function
  const queryFn = useCallback(
    async (params: Record<string, unknown>) => {
      const {
        columnFilters: _paramsColumnFilters,
        complexFilters: _complexFilters,
        advancedFilters: paramsAdvancedFilters,
        globalSearch: paramsGlobalSearch,
        pagination: _paramsPagination,
        sorting: paramsSorting,
      } = params;

      // Type the pagination object properly
      const paginationTyped = pagination as
        | { pageSize?: number; pageIndex?: number }
        | undefined;

      try {
        const orderBy = buildOrderByParam(paramsSorting);
        const cleanedFilters = cleanColumnFilters(columnFilters);
        const requestParams = buildRequestParams(
          cleanedFilters,
          paginationTyped,
          orderBy,
          paramsAdvancedFilters
        );

        // Attach global search if present (server-side global filter)
        if (paramsGlobalSearch && typeof paramsGlobalSearch === "string") {
          (requestParams as Record<string, unknown>).search =
            paramsGlobalSearch;
          // Backward compatibility for handlers expecting q/globalSearch instead of search
          (requestParams as Record<string, unknown>).q = paramsGlobalSearch;
          (requestParams as Record<string, unknown>).globalSearch =
            paramsGlobalSearch;
        }

        // Execute the request - safely handle the list action
        if (actions.list) {
          const response = await actions.list(requestParams);
          return {
            data: (response.data || []) as TData[],
            pageCount: response.meta?.pageCount || 1,
            rowCount: response.meta?.totalCount || response.data?.length || 0,
          };
        }
        return { data: [] as TData[], pageCount: 0, rowCount: 0 };
      } catch (_error) {
        return { data: [] as TData[], pageCount: 0, rowCount: 0 };
      }
    },
    [
      actions,
      columnFilters,
      pagination,
      buildOrderByParam,
      cleanColumnFilters,
      buildRequestParams,
    ]
  );

  // Use the tableUrlData hook for proper API data fetching
  const urlDataResult = useTableUrlData<TData>({
    enabled,
    queryFn,
    tableId,
  });

  // Extract data and state from API
  const data = urlDataResult?.data || [];
  const error = urlDataResult?.error;
  const isError = urlDataResult?.isError;
  const isLoading = urlDataResult?.isLoading;
  const baseRefetch = urlDataResult?.refetch || (() => Promise.resolve());
  const rowCount = urlDataResult?.rowCount || 0;
  const rowSelection = urlDataResult?.rowSelection || {};
  const setRowSelection =
    urlDataResult?.setRowSelection ||
    (() => {
      // No-op implementation
    });

  // Get table state from URL parameters with proper type assertions
  const columnOrder = (tableUrlState.orderParam || []) as string[];
  const sorting = (tableUrlState.sortParam || []) as ColumnSort[];

  // Compute column visibility: when URL has no visibility state, derive it
  // from config.columns.visible so columns in order/definitions but NOT in
  // visible are hidden by default.
  const columnVisibility = useMemo<VisibilityState>(() => {
    const urlVisibility = (tableUrlState.visibilityParam ||
      {}) as VisibilityState;

    // If URL already has explicit visibility state, use it as-is
    if (Object.keys(urlVisibility).length > 0) {
      return urlVisibility;
    }

    const visibleList = config.columns.visible;

    // If no visible list is configured, fall back to everything visible
    if (!visibleList || visibleList.length === 0) {
      return {};
    }

    const visibleSet = new Set(visibleList);
    const visibility: VisibilityState = {};

    // Walk every defined column and mark those absent from visible as hidden
    for (const colDef of config.columns.definitions) {
      const colId = colDef.id;
      // Special columns (select, actions) are always visible
      if (colId === "select" || colId === "actions") {
        visibility[colId] = true;
        continue;
      }
      visibility[colId] = visibleSet.has(colId);
    }

    // Select column is not in definitions; ensure it is visible when row selection is enabled
    if (config.table.enableRowSelection) {
      visibility.select = true;
    }

    return visibility;
  }, [
    tableUrlState.visibilityParam,
    config.columns.visible,
    config.columns.definitions,
    config.table.enableRowSelection,
  ]);

  // Enhanced refetch function that resets pagination and invalidates queries
  const enhancedRefetch = useCallback(async () => {
    tableUrlState.setPageParam("0");
    await invalidateTable();
    await baseRefetch();
  }, [tableUrlState, invalidateTable, baseRefetch]);

  // Use our columns hook to define columns in a modular way
  const { column, createColumns } = useColumns<TData>({
    enableSelection: config.table.enableRowSelection,
    tableId,
  });

  // Create a safe translation helper
  const getTranslationSafe = useCallback(
    (key: string): string => {
      // Try to use the t function first for any translation key
      try {
        return t(key);
      } catch {
        // If that fails, return the key itself as fallback
        return key;
      }
    },
    [t]
  );

  // Create columns based on configuration
  const columns = useMemo(() => {
    const columnDefs: ColumnDef<TData>[] = [];
    const selectionInlineMeta = resolveInlineEditColumnConfig(
      {
        id: "select",
        type: "select",
      },
      tableInlineEditConfig
    );

    // Add selection column if enabled
    if (config.table.enableRowSelection) {
      // Use the selection column from the columns hook
      columnDefs.push(
        withInlineEditMeta(column.selection(), selectionInlineMeta)
      );
    }

    // Add columns from configuration
    for (const colDef of config.columns.definitions) {
      let baseColumnDef: ColumnDef<TData>;

      switch (colDef.type) {
        case "actions": {
          baseColumnDef = column.actions({
            header: "",
            includeDelete: isDeleteAllowed,
            includeDuplicate: isDuplicateAllowed && !!actions.duplicate,
            includeEdit: isEditAllowed,
            onDelete: async (row: TData) => {
              return await handleDelete(row as TData & { id: string });
            },
            onEdit: async (row: TData) => {
              return await handleEdit(row as TData & { id: string }, {});
            },
            onRefresh: async () => {
              await enhancedRefetch();
            },
            tableId,
          } as ActionsColumnProps<TData>);
          break;
        }
        case "boolean": {
          baseColumnDef = column.boolean(colDef.id as keyof TData, {
            enableColumnFilter: colDef.enableColumnFilter,
            enableSorting: colDef.enableSorting,
            header: getTranslationSafe(colDef.header),
          });
          break;
        }
        case "code": {
          baseColumnDef = column.code(colDef.id as keyof TData, {
            enableColumnFilter: colDef.enableColumnFilter,
            enableSorting: colDef.enableSorting,
            header: getTranslationSafe(colDef.header),
          });
          break;
        }
        case "date": {
          const dateMeta = (
            colDef as {
              meta?: {
                dateDisplayPreset?: import("../types/date-types").DateDisplayPreset;
                dateFormat?: string;
              };
            }
          ).meta;
          baseColumnDef = column.date(colDef.id as keyof TData, {
            dateDisplayPreset:
              colDef.dateDisplayPreset ?? dateMeta?.dateDisplayPreset,
            dateFormat: colDef.dateFormat ?? dateMeta?.dateFormat,
            enableColumnFilter: colDef.enableColumnFilter,
            enableSorting: colDef.enableSorting,
            fallbackDateDisplayPreset: config.table.dateDisplayPreset,
            header: getTranslationSafe(colDef.header),
          });
          break;
        }
        case "dynamicType": {
          // Use dynamic type column that renders based on the type in the specified typeKey
          baseColumnDef = column.dynamicType(
            colDef.id as keyof TData,
            colDef.typeKey as keyof TData,
            {
              // Pass any custom renderers if defined (with proper typing)
              customRenderers: colDef.customRenderers as
                | Record<string, (value: unknown) => React.ReactNode>
                | undefined,
              enableSorting: colDef.enableSorting,
              header: getTranslationSafe(colDef.header),
            }
          );
          break;
        }
        case "number": {
          const numberColDef = colDef as {
            numberFormat?: import("../utils/number-format").NumberFormatConfig;
          };
          baseColumnDef = column.number(colDef.id as keyof TData, {
            enableColumnFilter: colDef.enableColumnFilter,
            enableSorting: colDef.enableSorting,
            header: getTranslationSafe(colDef.header),
            numberFormat: numberColDef.numberFormat,
          });
          break;
        }
        case "select":
        case "multiSelect": {
          const displayVariant = (
            colDef as { displayVariant?: "default" | "tag" }
          ).displayVariant;

          if (displayVariant === "tag") {
            baseColumnDef = column.tag(colDef.id as keyof TData, {
              enableColumnFilter: colDef.enableColumnFilter,
              enableSorting: colDef.enableSorting,
              header: getTranslationSafe(colDef.header),
              tagColorMap: colDef.tagColorMap,
            });
            break;
          }

          baseColumnDef = column.text(colDef.id as keyof TData, {
            enableColumnFilter: colDef.enableColumnFilter,
            enableSorting: colDef.enableSorting,
            header: getTranslationSafe(colDef.header),
          });
          break;
        }
        case "text": {
          baseColumnDef = column.text(colDef.id as keyof TData, {
            enableColumnFilter: colDef.enableColumnFilter,
            enableSorting: colDef.enableSorting,
            header: getTranslationSafe(colDef.header),
          });
          break;
        }
        // Add more column types as needed
        default:
          // Default to text column
          baseColumnDef = column.text(colDef.id as keyof TData, {
            enableColumnFilter: colDef.enableColumnFilter,
            enableSorting: colDef.enableSorting,
            header: getTranslationSafe(colDef.header),
          });
      }

      columnDefs.push(
        withInlineEditMeta(
          baseColumnDef,
          resolveInlineEditColumnConfig(colDef, tableInlineEditConfig)
        )
      );
    }

    // Add actions column if not already added
    if (!columnDefs.some((col) => "id" in col && col.id === "actions")) {
      columnDefs.push(
        withInlineEditMeta(
          column.actions({
            header: "",
            includeDelete: isDeleteAllowed,
            includeDuplicate: isDuplicateAllowed && !!actions.duplicate,
            includeEdit: isEditAllowed,
            includeView: true,
            onDelete: async (row: TData) => {
              return await handleDelete(row as TData & { id: string });
            },
            onDuplicate: actions.duplicate
              ? async (row: TData) => {
                  return await handleDuplicate(row as TData & { id: string });
                }
              : undefined,
            onEdit: async (row: TData) => {
              return await handleEdit(row as TData & { id: string }, {});
            },
            onRefresh: async () => {
              await enhancedRefetch();
            },
            onView: (_row: TData) => {
              // Placeholder for view action - to be implemented later
              if (DEBUG) {
                // Debug log for view action placeholder
              }
              // We'll return true to indicate success even though we're not doing anything yet
              return Promise.resolve(true);
            },
            tableId,
          } as ActionsColumnProps<TData>),
          resolveInlineEditColumnConfig(
            {
              id: "actions",
              type: "actions",
            },
            tableInlineEditConfig
          )
        )
      );
    }

    return createColumns(columnDefs);
  }, [
    column,
    config.columns.definitions,
    config.table.dateDisplayPreset,
    config.table.enableRowSelection,
    createColumns,
    enhancedRefetch,
    getTranslationSafe,
    actions.duplicate,
    isDeleteAllowed,
    isDuplicateAllowed,
    isEditAllowed,
    handleDelete,
    handleEdit,
    handleDuplicate,
    tableId,
    tableInlineEditConfig,
  ]);

  // Helper function to determine column label
  const getColumnLabel = useCallback(
    (colDef: ColumnDef<TData>): string => {
      if (colDef.id === "select") {
        return t("common.selection");
      }
      if (colDef.id === "actions") {
        return t("actions.title");
      }
      if (typeof colDef.header === "string") {
        return getTranslationSafe(colDef.header);
      }
      // For function headers or fallback, use the column ID and try to translate it
      return getTranslationSafe(colDef.id || "Column");
    },
    [t, getTranslationSafe]
  );

  // Create formatted column metadata for the TableOptionsMenu
  const columnOptions = useMemo(() => {
    return columns.map((col) => {
      const colDef = col as ColumnDef<TData>;

      return {
        canFilter: colDef.enableColumnFilter !== false,
        canHide: colDef.enableHiding !== false,
        canSort: colDef.enableSorting !== false,
        id: colDef.id || "unknown",
        label: getColumnLabel(colDef),
      };
    });
  }, [columns, getColumnLabel]);

  // Create table instance with configuration
  const table = useReactTable({
    columns,
    data: data || [],
    enableColumnFilters: config.table.enableColumnFilters,
    enableMultiRowSelection: config.table.enableMultiRowSelection !== false,
    enableRowSelection: config.table.enableRowSelection,
    enableSorting: config.table.enableSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
    onColumnFiltersChange: tableUrlState.setColumnFiltersFromUI as OnChangeFn<
      typeof columnFilters
    >,
    onColumnOrderChange: tableUrlState.setOrderFromUI as OnChangeFn<
      typeof columnOrder
    >,
    onColumnVisibilityChange: tableUrlState.setVisibilityFromUI as OnChangeFn<
      typeof columnVisibility
    >,
    onPaginationChange:
      tableUrlState.setPaginationFromUI as OnChangeFn<PaginationState>,
    onRowSelectionChange: setRowSelection,
    onSortingChange: tableUrlState.setSorting as OnChangeFn<typeof sorting>,
    pageCount: Math.ceil(rowCount / pagination.pageSize),
    state: {
      columnFilters,
      columnOrder,
      columnVisibility,
      pagination,
      rowSelection,
      sorting,
    },
  });

  // Return everything needed to render a data table
  return {
    // Table actions
    actions: {
      create: handleCreate,
      delete: handleDelete,
      duplicate: handleDuplicate,
      edit: handleEdit,
      invalidateTable,
      refresh: enhancedRefetch,
    },

    // Column configuration
    columnOptions,

    columns,
    // Table configuration
    config,

    // URL state utilities
    createShareableUrl: tableUrlState.createShareableUrl,

    // Table data
    data,
    error,
    // Data actions
    handleCreate,
    handleDelete,
    handleDuplicate,
    handleEdit,
    isError,
    isLoading,
    pageCount: Math.ceil(rowCount / pagination.pageSize),

    refetch: enhancedRefetch,
    resetFilters: tableUrlState.resetFilters,
    resetUrlState: tableUrlState.resetUrlState,
    rowCount,
    rowSelection,
    // Table state
    setColumnFilters: tableUrlState.setColumnFiltersFromUI as OnChangeFn<
      typeof columnFilters
    >,
    setColumnVisibility: tableUrlState.setVisibilityFromUI as OnChangeFn<
      typeof columnVisibility
    >,
    setGrouping: tableUrlState.setGroupingFromUI,

    setPageIndex: (pageIndex: number) =>
      tableUrlState.setPageParam(pageIndex.toString()),
    setPageSize: (pageSize: number) =>
      tableUrlState.setPageSizeParam(pageSize.toString()),
    setRowSelection,

    setSorting: tableUrlState.setSorting as OnChangeFn<typeof sorting>,
    state: {
      columnFilters,
      columnOrder,
      columnVisibility,
      grouping: tableUrlState.groupingParam || [],
      pagination,
      sorting,
    },
    // Table instance
    tableInstance: table,

    // Translations
    translations,

    // Force re-render key when column visibility changes (until atoms are fully synced with URL state)
    visibilityKey: JSON.stringify(columnVisibility),
  };
}
