/**
 * Hook for creating and managing a TanStack Table instance
 * Uses URL parameters as the source of truth
 */
"use client"

import {
    type ColumnDef,
    type ColumnFiltersState,
    type ColumnOrderState,
    type ColumnPinningState,
    type ExpandedState,
    type GroupingState,
    type OnChangeFn,
    type PaginationState,
    type RowSelectionState,
    type SortingState,
    type VisibilityState,
    getCoreRowModel,
    getFilteredRowModel,
    getGroupedRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable
} from "@tanstack/react-table"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { useTableUrlState } from "./use-table-url-state"

/**
 * Options for the useTableInstance hook
 */
interface UseTableInstanceOptions<TData> {
    columns: ColumnDef<TData>[]
    data: TData[]
    enableColumnFilters?: boolean
    enableColumnPinning?: boolean
    enableGrouping?: boolean
    enableMultiRowSelection?: boolean
    enablePagination?: boolean
    enableRowSelection?: boolean
    enableSorting?: boolean
    getRowId?: (row: TData) => string
    manualFiltering?: boolean
    manualPagination?: boolean
    manualSorting?: boolean
    onRowSelectionChange?: (selection: Record<string, boolean>) => void
    pageCount?: number
    rowSelection?: Record<string, boolean>
    tableId: string
}

/**
 * Hook for creating and managing a TanStack Table instance using URL parameters
 * @param options - Configuration options for the table instance
 * @returns TanStack Table instance
 */
export function useTableInstance<TData>({
    columns,
    data,
    enableColumnFilters = true,
    enableColumnPinning = true,
    enableGrouping = false,
    enableMultiRowSelection = true,
    enablePagination = true,
    enableRowSelection = true,
    enableSorting = true,
    getRowId,
    manualFiltering = false,
    manualPagination = false,
    manualSorting = false,
    onRowSelectionChange,
    pageCount = 0,
    rowSelection: externalRowSelection,
    tableId
}: UseTableInstanceOptions<TData>) {
    // Memoize expensive computations
    const memoizedColumns = useMemo(() => columns, [columns])
    const memoizedData = useMemo(() => data, [data])

    // Cache the table options to prevent unnecessary re-renders
    const tableOptionsRef = useRef({
        enableColumnFilters,
        enableColumnPinning,
        enableGrouping,
        enableMultiRowSelection,
        enablePagination,
        enableRowSelection,
        enableSorting,
        manualFiltering,
        manualPagination,
        manualSorting
    })

    // Update ref if options change
    useEffect(() => {
        tableOptionsRef.current = {
            enableColumnFilters,
            enableColumnPinning,
            enableGrouping,
            enableMultiRowSelection,
            enablePagination,
            enableRowSelection,
            enableSorting,
            manualFiltering,
            manualPagination,
            manualSorting
        }
    }, [
        enableColumnFilters,
        enableColumnPinning,
        enableGrouping,
        enableMultiRowSelection,
        enablePagination,
        enableRowSelection,
        enableSorting,
        manualFiltering,
        manualPagination,
        manualSorting
    ])

    // Get table state from URL parameters
    const {
        expandedParam,
        filtersParam,
        groupingParam,
        orderParam,
        pagination,
        pinningParam,
        setColumnFiltersFromUI,
        setExpandedFromUI,
        setGroupingFromUI,
        setOrderFromUI,
        setPaginationFromUI,
        setPinningFromUI,
        setSorting,
        setVisibilityFromUI,
        sortParam,
        visibilityParam
    } = useTableUrlState({ tableId })

    // Use React state for row selection (doesn't need to be in URL)
    const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>({})

    // Create wrapper functions to adapt our URL state setters to TanStack's OnChangeFn pattern
    const handleColumnFiltersChange = useCallback<OnChangeFn<ColumnFiltersState>>(
        (updaterOrValue) => {
            const newValue =
                typeof updaterOrValue === "function"
                    ? updaterOrValue((filtersParam as ColumnFiltersState) || [])
                    : updaterOrValue

            setColumnFiltersFromUI(newValue)
        },
        [filtersParam, setColumnFiltersFromUI]
    )

    const handleColumnOrderChange = useCallback<OnChangeFn<ColumnOrderState>>(
        (updaterOrValue) => {
            const newValue =
                typeof updaterOrValue === "function"
                    ? updaterOrValue((orderParam as string[]) || [])
                    : updaterOrValue
            setOrderFromUI(newValue)
        },
        [orderParam, setOrderFromUI]
    )

    // Handler for column pinning changes
    const handleColumnPinningChange = useCallback<OnChangeFn<ColumnPinningState>>(
        (updaterOrValue) => {
            const newValue =
                typeof updaterOrValue === "function"
                    ? updaterOrValue(pinningParam || { left: [], right: [] })
                    : updaterOrValue

            // Ensure we have the correct structure for pinning state
            const normalizedPinning = {
                left: newValue.left || [],
                right: newValue.right || []
            }

            setPinningFromUI(normalizedPinning)
        },
        [pinningParam, setPinningFromUI]
    )

    const handleColumnVisibilityChange = useCallback<OnChangeFn<VisibilityState>>(
        (updaterOrValue) => {
            const newValue =
                typeof updaterOrValue === "function"
                    ? updaterOrValue((visibilityParam as VisibilityState) || {})
                    : updaterOrValue

            setVisibilityFromUI(newValue)
        },
        [visibilityParam, setVisibilityFromUI]
    )

    const handleExpandedChange = useCallback<OnChangeFn<ExpandedState>>(
        (updaterOrValue) => {
            const newValue =
                typeof updaterOrValue === "function"
                    ? updaterOrValue(expandedParam || {})
                    : updaterOrValue
            setExpandedFromUI(newValue as Record<string, boolean>)
        },
        [expandedParam, setExpandedFromUI]
    )

    const handleGroupingChange = useCallback<OnChangeFn<GroupingState>>(
        (updaterOrValue) => {
            const newValue =
                typeof updaterOrValue === "function"
                    ? updaterOrValue((groupingParam as string[]) || [])
                    : updaterOrValue
            setGroupingFromUI(newValue)
        },
        [groupingParam, setGroupingFromUI]
    )

    const handlePaginationChange = useCallback<OnChangeFn<PaginationState>>(
        (updaterOrValue) => {
            const newValue =
                typeof updaterOrValue === "function" ? updaterOrValue(pagination) : updaterOrValue
            setPaginationFromUI(newValue)
        },
        [pagination, setPaginationFromUI]
    )

    const handleSortingChange = useCallback<OnChangeFn<SortingState>>(
        (updaterOrValue) => {
            const newValue =
                typeof updaterOrValue === "function"
                    ? updaterOrValue((sortParam as SortingState) || [])
                    : updaterOrValue

            const normalizedSort = Array.isArray(newValue)
                ? newValue.map((item) => ({
                      desc: item.desc,
                      id: item.id
                  }))
                : newValue

            setSorting(normalizedSort)
        },
        [sortParam, setSorting]
    )

    // Create a wrapper for the row selection change handler
    const handleRowSelectionChange = useCallback<OnChangeFn<RowSelectionState>>(
        (updaterOrValue) => {
            // First update the internal state using React's state setter
            setInternalRowSelection((prev) =>
                typeof updaterOrValue === "function" ? updaterOrValue(prev) : updaterOrValue
            )

            // Then if we have an external handler, call it with the new value
            if (onRowSelectionChange) {
                // Convert the updater to a value if needed
                const newValue =
                    typeof updaterOrValue === "function"
                        ? updaterOrValue(internalRowSelection)
                        : updaterOrValue

                onRowSelectionChange(newValue as Record<string, boolean>)
            }
        },
        [onRowSelectionChange, internalRowSelection]
    )

    // Validate sorting to ensure all referenced columns exist
    const validatedSorting = useMemo(() => {
        if (!sortParam || !Array.isArray(sortParam)) return []

        const columnIds = new Set<string>()

        for (const col of columns) {
            if (col.id) {
                columnIds.add(col.id)
            }

            if ("accessorKey" in col && col.accessorKey) {
                columnIds.add(String(col.accessorKey))
            }

            if (col.header && typeof col.header === "string") {
                columnIds.add(col.header.toLowerCase())
            }
        }

        const validSorting = (sortParam as Array<{ desc: boolean; id: string }>)
            .filter((sort) => {
                const normalizedId = sort.id.toLowerCase()

                return (
                    columnIds.has(sort.id) ||
                    Array.from(columnIds).some((id) => id.toLowerCase() === normalizedId) ||
                    sort.id === "key" ||
                    sort.id === "id" ||
                    sort.id === "name" ||
                    sort.id === "createdAt" ||
                    sort.id === "updatedAt"
                )
            })
            .map((sort) => ({
                desc: sort.desc,
                id: sort.id
            }))

        return validSorting.length ? validSorting : []
    }, [columns, sortParam])

    // Initialize column visibility from columns
    const initialColumnVisibility = useMemo(() => {
        // If we have visibility in URL params, use those
        if (visibilityParam && Object.keys(visibilityParam).length > 0) {
            return visibilityParam
        }

        // Otherwise, use the column definitions
        const visibility: VisibilityState = {}
        for (const column of columns) {
            // Get a stable ID for the column
            let id: string

            // Case 1: Column has an explicit ID
            if (typeof column.id === "string") {
                id = column.id
            }
            // Case 2: Column has an accessorKey (need to check if it exists)
            else if ("accessorKey" in column && column.accessorKey !== undefined) {
                id = String(column.accessorKey)
            }
            // Case 3: Generate a fallback ID
            else {
                id = `col-${columns.indexOf(column)}`
            }

            if (id) {
                // Special cases for selection and actions columns - always visible
                if (
                    id === "select" ||
                    (column.meta as Record<string, unknown>)?.isSelectionColumn ||
                    id === "actions" ||
                    (column.meta as Record<string, unknown>)?.isActionsColumn
                ) {
                    visibility[id] = true
                } else {
                    visibility[id] = column.enableHiding !== false
                }
            }
        }
        return visibility
    }, [columns, visibilityParam])

    // Initialize column order from columns when URL order is empty
    const initialColumnOrder = useMemo(() => {
        // Get all column IDs using the same logic as the visibility function
        const allColumnIds = columns.map((column) => {
            if (typeof column.id === "string") {
                return column.id
            }
            if ("accessorKey" in column && column.accessorKey !== undefined) {
                return String(column.accessorKey)
            }
            return `col-${columns.indexOf(column)}`
        })

        // If we have order in URL params, validate and fix it to respect constraints
        if (orderParam && Array.isArray(orderParam) && orderParam.length > 0) {
            const urlOrder = orderParam as string[]
            
            // Separate fixed and moveable columns
            const selectCol = urlOrder.find(id => id === "select")
            const actionsCol = urlOrder.find(id => id === "actions") 
            const otherCols = urlOrder.filter(id => id !== "select" && id !== "actions")
            
            // Build final order: select first, others in middle, actions last
            const finalOrder: string[] = []
            if (selectCol) finalOrder.push(selectCol)
            finalOrder.push(...otherCols)
            if (actionsCol) finalOrder.push(actionsCol)
            
            return finalOrder
        }

        // Otherwise, create natural order with fixed positions
        const selectCol = allColumnIds.find(id => id === "select")
        const actionsCol = allColumnIds.find(id => id === "actions")
        const otherCols = allColumnIds.filter(id => id !== "select" && id !== "actions")
        
        // Build natural order: select first, others in middle, actions last  
        const naturalOrder: string[] = []
        if (selectCol) naturalOrder.push(selectCol)
        naturalOrder.push(...otherCols)
        if (actionsCol) naturalOrder.push(actionsCol)
        
        return naturalOrder
    }, [columns, orderParam])

    // Create the table instance with memoized values
    const tableInstance = useReactTable({
        columns: memoizedColumns,
        data: memoizedData,
        ...tableOptionsRef.current,
        getCoreRowModel: useMemo(() => getCoreRowModel(), []),
        getFilteredRowModel: useMemo(() => getFilteredRowModel(), []),
        getGroupedRowModel: useMemo(
            () => (enableGrouping ? getGroupedRowModel() : undefined),
            [enableGrouping]
        ),
        getPaginationRowModel: useMemo(
            () => (enablePagination ? getPaginationRowModel() : undefined),
            [enablePagination]
        ),
        getRowId,
        getSortedRowModel: useMemo(() => getSortedRowModel(), []),
        getSubRows: (row: TData) => (row as unknown as { subRows?: TData[] }).subRows,
        manualFiltering,
        manualPagination,
        manualSorting,
        onColumnFiltersChange: handleColumnFiltersChange,
        onColumnOrderChange: handleColumnOrderChange,
        onColumnPinningChange: handleColumnPinningChange,
        onColumnVisibilityChange: handleColumnVisibilityChange,
        onExpandedChange: handleExpandedChange,
        onGroupingChange: handleGroupingChange,
        onPaginationChange: handlePaginationChange,
        onRowSelectionChange: handleRowSelectionChange,
        onSortingChange: handleSortingChange,
        pageCount: pageCount || Math.ceil(data.length / pagination.pageSize),
        state: {
            columnFilters: Array.isArray(filtersParam) ? (filtersParam as ColumnFiltersState) : [],
            columnOrder: initialColumnOrder,
            columnPinning: pinningParam || {
                left: ["select"],
                right: ["actions"]
            },
            columnVisibility: initialColumnVisibility as VisibilityState,
            expanded: expandedParam || {},
            grouping: Array.isArray(groupingParam) ? (groupingParam as string[]) : [],
            pagination,
            rowSelection: externalRowSelection || (internalRowSelection as RowSelectionState),
            sorting: Array.isArray(validatedSorting) ? (validatedSorting as SortingState) : []
        }
    })

    // Sync table column order when URL state changes
    useEffect(() => {
        console.log("🔍 [useTableInstance] Effect triggered:", {
            hasTableInstance: !!tableInstance,
            orderParam,
            orderParamType: typeof orderParam,
            orderParamLength: Array.isArray(orderParam) ? orderParam.length : 'not array'
        })
        
        if (tableInstance && orderParam && Array.isArray(orderParam) && orderParam.length > 0) {
            const currentOrder = tableInstance.getState().columnOrder
            const urlOrder = orderParam as string[]
            
            console.log("🔍 [useTableInstance] Comparing orders:", {
                currentOrder,
                urlOrder,
                areEqual: JSON.stringify(currentOrder) === JSON.stringify(urlOrder)
            })
            
            // Only update if the order actually changed
            if (JSON.stringify(currentOrder) !== JSON.stringify(urlOrder)) {
                console.log("🔄 [useTableInstance] Syncing column order from URL state:", urlOrder)
                tableInstance.setColumnOrder(urlOrder)
                
                // Force a re-render by getting the state after update
                console.log("✅ [useTableInstance] New order set:", tableInstance.getState().columnOrder)
            }
        }
    }, [tableInstance, orderParam])

    return tableInstance
}
