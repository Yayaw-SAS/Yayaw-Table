/**
 * Main hook for data tables - Orchestrates configuration, actions, and data fetching
 * Refactored to use extracted hooks for better maintainability
 */
"use client";

import { useQueryClient } from "@tanstack/react-query";
import type * as React from "react";
import { useCallback, useMemo } from "react";
import type { ActionsColumnProps } from "../components/columns/actions-column";
import { useColumns } from "../components/columns/hooks/use-columns";
import { useTranslations } from "../providers/table-provider";
import {
  type ColumnDef,
  type ColumnFilter,
  type ColumnSizingState,
  type ColumnSort,
  type OnChangeFn,
  type PaginationState,
  type Row,
  useYayawTable,
  type VisibilityState,
} from "../tanstack";
import { compatibleListParams } from "../utils/table-contracts";
import { invalidateTableDataQuery } from "./query-cache-utils";
import type { InlineEditColumnRuntimeConfig } from "./use-inline-edit-runtime";
import { resolveInlineEditColumnConfig } from "./use-inline-edit-runtime";
import { useTableActions } from "./use-table-actions";
import { useTableConfig } from "./use-table-config";
import { useTableUrlData } from "./use-table-url-data";
import { useTableUrlState } from "./use-table-url-state";

const DEBUG = false;

interface ColumnSizingConfig {
  maxSize?: number;
  minSize?: number;
  size?: number;
}

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

function applyColumnSizingConfig<TData>(
  columnDef: ColumnDef<TData>,
  sizingConfig: ColumnSizingConfig
): ColumnDef<TData> {
  const sizedColumnDef: ColumnDef<TData> = { ...columnDef };

  if (typeof sizingConfig.size === "number") {
    sizedColumnDef.size = sizingConfig.size;
  }

  if (typeof sizingConfig.minSize === "number") {
    sizedColumnDef.minSize = sizingConfig.minSize;
  }

  if (typeof sizingConfig.maxSize === "number") {
    sizedColumnDef.maxSize = sizingConfig.maxSize;
  }

  return sizedColumnDef;
}

function resolveRowSelectionOption<TData extends Record<string, unknown>>({
  canSelectRow,
  enableRowSelection,
}: {
  canSelectRow?: (row: Record<string, unknown>) => boolean;
  enableRowSelection: boolean;
}): boolean | ((row: Row<TData>) => boolean) {
  if (enableRowSelection === false) {
    return false;
  }

  if (!canSelectRow) {
    return true;
  }

  return (row) => canSelectRow(row.original) !== false;
}

/**
 * Options for the useDataTable hook
 */
export interface UseDataTableOptions<TData = Record<string, unknown>> {
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
   * Initial rows provided by the server for the first client render.
   */
  initialData?: TData[];
  /**
   * Total page count that matches the initial rows.
   */
  initialPageCount?: number;
  /**
   * Total row count that matches the initial rows.
   */
  initialRowCount?: number;

  /**
   * Unique identifier for this table instance
   * Defaults to tableType if not provided
   */
  tableId?: string;

  /**
   * Type of table to use (corresponds to a key in the table catalogue)
   */
  tableType: string;

  /**
   * Default form type for create/edit forms.
   * Defaults to tableType for backwards compatibility.
   */
  formType?: string;
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
    initialPageSize = 10,
    initialData,
    initialPageCount,
    initialRowCount,
    tableType,
    tableId = tableType,
    formType = tableType,
  } = options;

  // Get QueryClient instance
  const queryClient = useQueryClient();

  // Get table configuration using extracted hook
  const { config, translations } = useTableConfig(tableType);
  const isInlineEditAllowed = config.table.allowInlineEdit !== false;
  const tableInlineEditConfig = useMemo(() => {
    const inlineEditConfig = config.table.inlineEdit;

    return {
      ...inlineEditConfig,
      enabled: (inlineEditConfig?.enabled ?? false) && isInlineEditAllowed,
    };
  }, [config.table.inlineEdit, isInlineEditAllowed]);

  // Debug removed
  const { t } = useTranslations();

  // Set up URL state for the table
  const defaultPageSize = config.table.defaultPageSize ?? initialPageSize;
  const tableUrlState = useTableUrlState({
    defaultPageSize,
    enabled: config.table.syncUrl !== false,
    tableId,
  });

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

    return Object.fromEntries(
      sortingParam
        .filter((sort): sort is { id: string; desc?: boolean } =>
          Boolean(sort && typeof sort.id === "string")
        )
        .map((sort) => [sort.id, sort.desc ? "desc" : "asc"])
    );
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
          const response = await actions.list(
            compatibleListParams(requestParams)
          );
          return {
            data: (response.data || []) as TData[],
            pageCount: response.meta?.pageCount || 1,
            rowCount: response.meta?.totalCount || response.data?.length || 0,
          };
        }
        return { data: [] as TData[], pageCount: 0, rowCount: 0 };
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
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
    defaultPageSize,
    enabled,
    initialData,
    initialPageCount,
    initialRowCount,
    queryFn,
    syncUrl: config.table.syncUrl !== false,
    tableId,
  });

  // Extract data and state from API
  const data = urlDataResult?.data || [];
  const error = urlDataResult?.error;
  const isError = urlDataResult?.isError;
  const isLoading = urlDataResult?.isLoading;
  const baseRefetch = urlDataResult?.refetch || (() => Promise.resolve());
  const rowCount = urlDataResult?.rowCount ?? 0;
  const pageCount =
    urlDataResult?.pageCount ?? Math.ceil(rowCount / pagination.pageSize);
  const rowSelection = urlDataResult?.rowSelection || {};
  const setRowSelection =
    urlDataResult?.setRowSelection ||
    (() => {
      // No-op implementation
    });

  // Get table state from URL parameters with proper type assertions
  const columnOrder = (tableUrlState.orderParam || []) as string[];
  const columnSizing = tableUrlState.sizingParam as ColumnSizingState;
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
      visibility[colId] = visibleSet.has(colId);
    }

    // Select is virtual (not in column definitions). Keep compatibility with
    // configs that list `actions` but omitted `select`: in that legacy shape,
    // selection should still be visible by default.
    if (config.table.enableRowSelection) {
      const hasActionsDefinition = config.columns.definitions.some(
        (definition) =>
          definition.id === "actions" || definition.type === "actions"
      );
      const shouldShowSelectByDefault =
        visibleSet.has("actions") || !hasActionsDefinition;
      visibility.select = visibleSet.has("select") || shouldShowSelectByDefault;
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

  const buildActionsColumnDef = useCallback(
    ({
      includeView = false,
      withDuplicateHandler = false,
    }: {
      includeView?: boolean;
      withDuplicateHandler?: boolean;
    } = {}): ColumnDef<TData> => {
      const onDuplicate =
        withDuplicateHandler && actions.duplicate
          ? async (row: TData) => {
              return await handleDuplicate(row as TData & { id: string });
            }
          : undefined;

      return column.actions({
        header: "",
        includeDelete: isDeleteAllowed,
        includeDuplicate: isDuplicateAllowed && !!actions.duplicate,
        includeEdit: isEditAllowed,
        includeView,
        canDeleteRow: config.table.canDeleteRow,
        canDuplicateRow: config.table.canDuplicateRow,
        canEditRow: config.table.canEditRow,
        formType: config.form?.editFormType || formType,
        onDelete: async (row: TData) => {
          return await handleDelete(row as TData & { id: string });
        },
        onDuplicate,
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

          // Return success even though no behavior is attached yet.
          return Promise.resolve(true);
        },
        resolveEditFormType: config.form?.resolveEditFormType,
        tableId,
        tableType,
      } as ActionsColumnProps<TData>);
    },
    [
      actions.duplicate,
      column,
      config.form?.editFormType,
      config.form?.resolveEditFormType,
      config.table.canDeleteRow,
      config.table.canDuplicateRow,
      config.table.canEditRow,
      enhancedRefetch,
      formType,
      handleDelete,
      handleDuplicate,
      handleEdit,
      isDeleteAllowed,
      isDuplicateAllowed,
      isEditAllowed,
      tableId,
      tableType,
    ]
  );

  const buildBaseColumnDef = useCallback(
    (colDef: (typeof config.columns.definitions)[number]): ColumnDef<TData> => {
      switch (colDef.type) {
        case "actions": {
          return buildActionsColumnDef();
        }
        case "boolean": {
          return column.boolean(colDef.id as keyof TData, {
            enableColumnFilter: colDef.enableColumnFilter,
            enableSorting: colDef.enableSorting,
            header: getTranslationSafe(colDef.header),
          });
        }
        case "code": {
          return column.code(colDef.id as keyof TData, {
            enableColumnFilter: colDef.enableColumnFilter,
            enableSorting: colDef.enableSorting,
            header: getTranslationSafe(colDef.header),
          });
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
          return column.date(colDef.id as keyof TData, {
            dateDisplayPreset:
              colDef.dateDisplayPreset ?? dateMeta?.dateDisplayPreset,
            dateFormat: colDef.dateFormat ?? dateMeta?.dateFormat,
            enableColumnFilter: colDef.enableColumnFilter,
            enableSorting: colDef.enableSorting,
            fallbackDateDisplayPreset: config.table.dateDisplayPreset,
            header: getTranslationSafe(colDef.header),
          });
        }
        case "dynamicType": {
          return column.dynamicType(
            colDef.id as keyof TData,
            colDef.typeKey as keyof TData,
            {
              customRenderers: colDef.customRenderers as
                | Record<string, (value: unknown) => React.ReactNode>
                | undefined,
              enableSorting: colDef.enableSorting,
              header: getTranslationSafe(colDef.header),
            }
          );
        }
        case "image": {
          return column.image(colDef.id as keyof TData, {
            enableColumnFilter: colDef.enableColumnFilter,
            enableSorting: colDef.enableSorting,
            header: getTranslationSafe(colDef.header),
          });
        }
        case "json": {
          const jsonColDef = colDef as {
            maxItems?: number;
          };
          return column.json(colDef.id as keyof TData, {
            enableSorting: colDef.enableSorting,
            header: getTranslationSafe(colDef.header),
            maxItems: jsonColDef.maxItems,
          });
        }
        case "number": {
          const numberColDef = colDef as {
            numberFormat?: import("../utils/number-format").NumberFormatConfig;
          };
          return column.number(colDef.id as keyof TData, {
            enableColumnFilter: colDef.enableColumnFilter,
            enableSorting: colDef.enableSorting,
            header: getTranslationSafe(colDef.header),
            numberFormat: numberColDef.numberFormat,
          });
        }
        case "select":
        case "multiSelect": {
          if (colDef.displayVariant === "tag") {
            return column.tag(colDef.id as keyof TData, {
              enableColumnFilter: colDef.enableColumnFilter,
              enableSorting: colDef.enableSorting,
              header: getTranslationSafe(colDef.header),
              tagColorMap: colDef.tagColorMap,
            });
          }

          return column.text(colDef.id as keyof TData, {
            enableColumnFilter: colDef.enableColumnFilter,
            enableSorting: colDef.enableSorting,
            header: getTranslationSafe(colDef.header),
          });
        }
        case "text": {
          return column.text(colDef.id as keyof TData, {
            enableColumnFilter: colDef.enableColumnFilter,
            enableSorting: colDef.enableSorting,
            header: getTranslationSafe(colDef.header),
          });
        }
        case "string": {
          const stringColDef = colDef as {
            showQuotes?: boolean;
          };
          return column.string(colDef.id as keyof TData, {
            enableSorting: colDef.enableSorting,
            header: getTranslationSafe(colDef.header),
            showQuotes: stringColDef.showQuotes,
          });
        }
        case "url": {
          const urlColDef = colDef as {
            urlDisplayMode?: "domain" | "full" | "icon";
          };
          return column.url(colDef.id as keyof TData, {
            displayMode: urlColDef.urlDisplayMode,
            enableColumnFilter: colDef.enableColumnFilter,
            enableSorting: colDef.enableSorting,
            header: getTranslationSafe(colDef.header),
          });
        }
        default: {
          return column.text(colDef.id as keyof TData, {
            enableColumnFilter: colDef.enableColumnFilter,
            enableSorting: colDef.enableSorting,
            header: getTranslationSafe(colDef.header),
          });
        }
      }
    },
    [
      buildActionsColumnDef,
      column,
      config.table.dateDisplayPreset,
      getTranslationSafe,
    ]
  );

  // Create columns based on configuration
  const columns = useMemo(() => {
    const columnDefs: ColumnDef<TData>[] = [];
    const selectionInlineMeta = resolveInlineEditColumnConfig(
      {
        id: "select",
        type: "select",
      },
      tableInlineEditConfig,
      {
        featureEnabled: isInlineEditAllowed,
      }
    );

    // Add selection column if enabled
    if (config.table.enableRowSelection) {
      // Use the selection column from the columns hook
      columnDefs.push({
        ...withInlineEditMeta(column.selection(), selectionInlineMeta),
        enableResizing: false,
      });
    }

    // Add columns from configuration
    for (const colDef of config.columns.definitions) {
      const baseColumnDef = buildBaseColumnDef(colDef);
      const sizedColumnDef = applyColumnSizingConfig(
        baseColumnDef,
        colDef as ColumnSizingConfig
      );
      const configuredColumnDef = {
        ...sizedColumnDef,
        enablePinning: colDef.enablePinning !== false,
        enableResizing: colDef.enableResizing !== false,
      };

      columnDefs.push(
        withInlineEditMeta(
          configuredColumnDef,
          resolveInlineEditColumnConfig(colDef, tableInlineEditConfig, {
            featureEnabled: isInlineEditAllowed,
          })
        )
      );
    }

    // Add actions column if not already added
    if (!columnDefs.some((col) => "id" in col && col.id === "actions")) {
      columnDefs.push({
        ...withInlineEditMeta(
          buildActionsColumnDef({
            includeView: true,
            withDuplicateHandler: true,
          }),
          resolveInlineEditColumnConfig(
            {
              id: "actions",
              type: "actions",
            },
            tableInlineEditConfig,
            {
              featureEnabled: isInlineEditAllowed,
            }
          )
        ),
        enableResizing: false,
      });
    }

    return createColumns(columnDefs);
  }, [
    column,
    buildActionsColumnDef,
    buildBaseColumnDef,
    config.columns.definitions,
    config.table.enableRowSelection,
    createColumns,
    isInlineEditAllowed,
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
  const table = useYayawTable({
    columns,
    columnResizeMode: "onChange",
    data: data || [],
    enableColumnFilters: config.table.enableColumnFilters,
    enableColumnResizing: config.table.enableColumnResizing === true,
    enableMultiRowSelection: config.table.enableMultiRowSelection !== false,
    enableRowRangeSelection: false,
    enableRowSelection: resolveRowSelectionOption<TData>({
      canSelectRow: config.table.canSelectRow,
      enableRowSelection: config.table.enableRowSelection,
    }),
    enableSorting: config.table.enableSorting,
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
    onColumnFiltersChange: tableUrlState.setColumnFiltersFromUI as OnChangeFn<
      typeof columnFilters
    >,
    onColumnOrderChange: tableUrlState.setOrderFromUI as OnChangeFn<
      typeof columnOrder
    >,
    onColumnSizingChange: (updater) => {
      const nextSizing =
        typeof updater === "function" ? updater(columnSizing) : updater;
      tableUrlState.setSizingFromUI(nextSizing);
    },
    onColumnVisibilityChange: tableUrlState.setVisibilityFromUI as OnChangeFn<
      typeof columnVisibility
    >,
    onPaginationChange:
      tableUrlState.setPaginationFromUI as OnChangeFn<PaginationState>,
    onRowSelectionChange: setRowSelection,
    onSortingChange: tableUrlState.setSorting as OnChangeFn<typeof sorting>,
    pageCount,
    state: {
      columnFilters,
      columnOrder,
      columnSizing,
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
    pageCount,

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
    setColumnSizing:
      tableUrlState.setSizingFromUI as OnChangeFn<ColumnSizingState>,
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
      columnSizing,
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
