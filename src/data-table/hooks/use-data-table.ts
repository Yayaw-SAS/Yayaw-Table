/**
 * Main hook for data tables - Orchestrates configuration, actions, and data fetching
 * Refactored to use extracted hooks for better maintainability
 */
'use client'

import { useQueryClient } from '@tanstack/react-query'
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
    type VisibilityState
} from '@tanstack/react-table'
import type * as React from 'react'
import { useCallback, useMemo } from 'react'

import type { ActionsColumnProps } from '../components/columns/actions-column'
import { useColumns } from '../components/columns/hooks/use-columns'
import { useTranslations } from '../providers/table-provider'
import { useTableActions } from './use-table-actions'
import { useTableConfig } from './use-table-config'
import { useTableUrlData } from './use-table-url-data'
import { useTableUrlState } from './use-table-url-state'

const DEBUG = false

/**
 * Options for the useDataTable hook
 */
export interface UseDataTableOptions {
    /**
     * Whether to enable data fetching
     * Defaults to true
     */
    enabled?: boolean

    /**
     * Initial page size
     * Defaults to 10
     */
    initialPageSize?: number

    /**
     * Unique identifier for this table instance
     * Defaults to tableType if not provided
     */
    tableId?: string

    /**
     * Type of table to use (corresponds to a key in the table catalogue)
     */
    tableType: string
}

/**
 * Main hook for data tables
 * @param options Configuration options
 * @returns Everything needed to render a data table
 */
export function useDataTable<TData extends Record<string, unknown>>(options: UseDataTableOptions) {
    const { enabled = true, initialPageSize = 10, tableType, tableId = tableType } = options

    // Get QueryClient instance
    const queryClient = useQueryClient()

    // Get table configuration using extracted hook
    const { config, translations } = useTableConfig(tableType)
    const { t } = useTranslations()

    // Set up URL state for the table
    const tableUrlState = useTableUrlState({ tableId })

    // Create a function to invalidate table data
    const invalidateTable = useCallback(async () => {
        await queryClient.invalidateQueries({
            queryKey: ['tableData', tableId]
        })
    }, [queryClient, tableId])

    // Get table actions using extracted hook (before queryFn to avoid circular reference)
    const {
        actions,
        handleCreate,
        handleEdit,
        handleDelete,
        handleDuplicate,
        hasAction,
        isActionsAvailable
    } = useTableActions<TData>({
        tableType,
        onSuccess: async () => {
            // This will be defined later
            tableUrlState.setPageParam('0')
            await invalidateTable()
        }
    })

    // Create query function
    const queryFn = useCallback(
        async (params: Record<string, unknown>) => {
            const { columnFilters, complexFilters, pagination, sorting } = params

            // Type the pagination object properly
            const paginationTyped = pagination as
                | { pageSize?: number; pageIndex?: number }
                | undefined

            try {
                if (DEBUG) {
                }

                // Build proper orderBy parameter for Prisma
                let orderBy
                if (Array.isArray(sorting) && sorting.length > 0) {
                    const sortField = sorting[0].id
                    const sortDirection = sorting[0].desc ? 'desc' : 'asc'
                    orderBy = { [sortField]: sortDirection }
                    if (DEBUG) {
                    }
                }

                // Type the column filters properly
                const columnFiltersTyped = (columnFilters || []) as Array<{
                    id: string
                    value: unknown
                }>

                // Create a clean filters object without any key-specific filters
                const cleanedFilters = Object.fromEntries(
                    columnFiltersTyped
                        .filter(
                            (filter: { id: string; value: unknown }) =>
                                !['id', 'key'].includes(filter.id)
                        )
                        .map((filter: { id: string; value: unknown }) => [filter.id, filter.value])
                )

                // Prepare base request parameters
                const requestParams = {
                    filters: cleanedFilters,
                    limit: paginationTyped?.pageSize || 10,
                    orderBy,
                    page: (paginationTyped?.pageIndex || 0) + 1
                }

                if (DEBUG) {
                }

                // Execute the request - safely handle the list action
                if (actions.list) {
                    const response = await actions.list(requestParams)

                    if (DEBUG) {
                    }

                    return {
                        data: (response.data || []) as TData[],
                        pageCount: response.meta?.pageCount || 1,
                        rowCount: response.meta?.totalCount || response.data?.length || 0
                    }
                }
                return { data: [] as TData[], pageCount: 0, rowCount: 0 }
            } catch (_error) {
                return { data: [] as TData[], pageCount: 0, rowCount: 0 }
            }
        },
        [actions]
    )

    // Use the tableUrlData hook to manage data fetching and state
    const {
        data,
        error,
        isError,
        isLoading,
        refetch: baseRefetch,
        rowCount,
        rowSelection,
        setRowSelection
    } = useTableUrlData<TData>({
        enabled,
        initialData: [], // Provide empty array as initial data to avoid undefined issues
        queryFn,
        tableId
    })

    // Get table state from URL parameters with proper type assertions
    const columnFilters = (tableUrlState.filtersParam || []) as ColumnFilter[]
    const columnOrder = (tableUrlState.orderParam || []) as string[]
    const columnVisibility = (tableUrlState.visibilityParam || {}) as VisibilityState
    const sorting = (tableUrlState.sortParam || []) as ColumnSort[]
    const { pagination } = tableUrlState

    // Enhanced refetch function that resets pagination and invalidates queries
    const enhancedRefetch = useCallback(async () => {
        tableUrlState.setPageParam('0')
        await invalidateTable()
        await baseRefetch()
    }, [tableUrlState, invalidateTable, baseRefetch])

    // Use our columns hook to define columns in a modular way
    const { column, createColumns } = useColumns<TData>({
        enableSelection: config.table.enableRowSelection,
        tableId
    })

    // Create a safe translation helper
    const getTranslationSafe = useCallback(
        (key: string): string => {
            // Try to use the t function first for any translation key
            try {
                return t(key)
            } catch {
                // If that fails, return the key itself as fallback
                return key
            }
        },
        [t]
    )

    // Create columns based on configuration
    const columns = useMemo(() => {
        const columnDefs: ColumnDef<TData>[] = []

        // Add selection column if enabled
        if (config.table.enableRowSelection) {
            // Use the selection column from the columns hook
            columnDefs.push(column.selection())
        }

        // Add columns from configuration
        for (const colDef of config.columns.definitions) {
            switch (colDef.type) {
                case 'actions':
                    columnDefs.push(
                        column.actions({
                            header: t('actions.title'),
                            includeDelete: true,
                            includeEdit: true,
                            onDelete: async (row: TData) => {
                                return await handleDelete(row as TData & { id: string })
                            },
                            onEdit: async (row: TData) => {
                                return await handleEdit(row as TData & { id: string }, {})
                            },
                            onRefresh: async () => {
                                await enhancedRefetch()
                            },
                            tableId
                        } as ActionsColumnProps<TData>)
                    )
                    break
                case 'boolean':
                    columnDefs.push(
                        column.boolean(colDef.id as keyof TData, {
                            enableColumnFilter: colDef.enableColumnFilter,
                            enableSorting: colDef.enableSorting,
                            header: getTranslationSafe(colDef.header)
                        })
                    )
                    break
                case 'code':
                    columnDefs.push(
                        column.code(colDef.id as keyof TData, {
                            enableColumnFilter: colDef.enableColumnFilter,
                            enableSorting: colDef.enableSorting,
                            header: getTranslationSafe(colDef.header)
                        })
                    )
                    break
                case 'date':
                    columnDefs.push(
                        column.date(colDef.id as keyof TData, {
                            enableColumnFilter: colDef.enableColumnFilter,
                            enableSorting: colDef.enableSorting,
                            header: getTranslationSafe(colDef.header)
                        })
                    )
                    break
                case 'dynamicType':
                    // Use dynamic type column that renders based on the type in the specified typeKey
                    columnDefs.push(
                        column.dynamicType(
                            colDef.id as keyof TData,
                            colDef.typeKey as keyof TData,
                            {
                                // Pass any custom renderers if defined (with proper typing)
                                customRenderers: colDef.customRenderers as
                                    | Record<string, (value: unknown) => React.ReactNode>
                                    | undefined,
                                enableSorting: colDef.enableSorting,
                                header: getTranslationSafe(colDef.header)
                            }
                        )
                    )
                    break
                case 'number':
                    // Use number column for proper number formatting
                    columnDefs.push(
                        column.number(colDef.id as keyof TData, {
                            enableColumnFilter: colDef.enableColumnFilter,
                            enableSorting: colDef.enableSorting,
                            header: getTranslationSafe(colDef.header)
                        })
                    )
                    break
                case 'tag':
                    columnDefs.push(
                        column.tag(colDef.id as keyof TData, {
                            enableColumnFilter: colDef.enableColumnFilter,
                            enableSorting: colDef.enableSorting,
                            header: getTranslationSafe(colDef.header)
                        })
                    )
                    break
                case 'text':
                    columnDefs.push(
                        column.text(colDef.id as keyof TData, {
                            enableColumnFilter: colDef.enableColumnFilter,
                            enableSorting: colDef.enableSorting,
                            header: getTranslationSafe(colDef.header)
                        })
                    )
                    break
                // Add more column types as needed
                default:
                    // Default to text column
                    columnDefs.push(
                        column.text(colDef.id as keyof TData, {
                            enableColumnFilter: colDef.enableColumnFilter,
                            enableSorting: colDef.enableSorting,
                            header: getTranslationSafe(colDef.header)
                        })
                    )
            }
        }

        // Add actions column if not already added
        if (!columnDefs.some((col) => 'id' in col && col.id === 'actions')) {
            columnDefs.push(
                column.actions({
                    header: t('actions.title'),
                    includeDelete: true,
                    includeDuplicate: !!actions.duplicate,
                    includeEdit: true,
                    includeView: true,
                    onDelete: async (row: TData) => {
                        return await handleDelete(row as TData & { id: string })
                    },
                    onDuplicate: actions.duplicate
                        ? async (row: TData) => {
                              return await handleDuplicate(row as TData & { id: string })
                          }
                        : undefined,
                    onEdit: async (row: TData) => {
                        return await handleEdit(row as TData & { id: string }, {})
                    },
                    onRefresh: async () => {
                        await enhancedRefetch()
                    },
                    onView: async (_row: TData) => {
                        // Placeholder for view action - to be implemented later
                        if (DEBUG) {
                        }
                        // We'll return true to indicate success even though we're not doing anything yet
                        return true
                    },
                    tableId
                } as ActionsColumnProps<TData>)
            )
        }

        return createColumns(columnDefs)
    }, [
        column,
        config.columns.definitions,
        config.table.enableRowSelection,
        createColumns,
        enhancedRefetch,
        t,
        getTranslationSafe,
        actions.duplicate,
        handleDelete,
        handleEdit,
        handleDuplicate,
        tableId
    ])

    // Create formatted column metadata for the TableOptionsMenu
    const columnOptions = useMemo(() => {
        return columns.map((col) => {
            const colDef = col as ColumnDef<TData>
            let label: string

            // Use proper header handling with translations
            if (colDef.id === 'select') {
                label = t('common.selection')
            } else if (colDef.id === 'actions') {
                label = t('actions.title')
            } else {
                // For other columns, try to get the translated header
                if (typeof colDef.header === 'string') {
                    label = getTranslationSafe(colDef.header)
                } else if (typeof colDef.header === 'function') {
                    // For function headers, use the column ID and try to translate it
                    label = getTranslationSafe(colDef.id || 'Column')
                } else {
                    // Fallback to translated column ID
                    label = getTranslationSafe(colDef.id || 'Column')
                }
            }

            const result = {
                canFilter: colDef.enableColumnFilter !== false,
                canHide: colDef.enableHiding !== false,
                canSort: colDef.enableSorting !== false,
                id: colDef.id || 'unknown',
                label
            }
            return result
        })
    }, [columns, t, getTranslationSafe])

    // Create table instance with configuration
    const table = useReactTable({
        columns,
        data: data || [],
        enableColumnFilters: config.table.enableColumnFilters,
        enableMultiRowSelection: true,
        enableRowSelection: true,
        enableSorting: config.table.enableSorting,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        manualFiltering: config.table.manualFiltering,
        manualPagination: config.table.manualPagination,
        manualSorting: config.table.manualSorting,
        onColumnFiltersChange: tableUrlState.setColumnFiltersFromUI as OnChangeFn<
            typeof columnFilters
        >,
        onColumnOrderChange: tableUrlState.setOrderFromUI as OnChangeFn<typeof columnOrder>,
        onColumnVisibilityChange: tableUrlState.setVisibilityFromUI as OnChangeFn<
            typeof columnVisibility
        >,
        onPaginationChange: tableUrlState.setPaginationFromUI as OnChangeFn<PaginationState>,
        onRowSelectionChange: setRowSelection,
        onSortingChange: tableUrlState.setSorting as OnChangeFn<typeof sorting>,
        pageCount: Math.ceil(rowCount / pagination.pageSize),
        state: {
            columnFilters,
            columnOrder,
            columnVisibility,
            pagination,
            rowSelection,
            sorting
        }
    })

    // Return everything needed to render a data table
    return {
        // Table actions
        actions: {
            create: handleCreate,
            delete: handleDelete,
            edit: handleEdit,
            invalidateTable,
            refresh: enhancedRefetch
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
        setColumnFilters: tableUrlState.setColumnFiltersFromUI as OnChangeFn<typeof columnFilters>,
        setColumnVisibility: tableUrlState.setVisibilityFromUI as OnChangeFn<
            typeof columnVisibility
        >,
        setGrouping: tableUrlState.setGroupingFromUI,

        setPageIndex: (pageIndex: number) => tableUrlState.setPageParam(pageIndex.toString()),
        setPageSize: (pageSize: number) => tableUrlState.setPageSizeParam(pageSize.toString()),
        setRowSelection,

        setSorting: tableUrlState.setSorting as OnChangeFn<typeof sorting>,
        state: {
            columnFilters,
            columnOrder,
            columnVisibility,
            grouping: tableUrlState.groupingParam || [],
            pagination,
            sorting
        },
        // Table instance
        tableInstance: table,

        // Translations
        translations,

        // Force re-render key when column visibility changes (until atoms are fully synced with URL state)
        visibilityKey: JSON.stringify(columnVisibility)
    }
}
