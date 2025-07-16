/**
 * Hook to centralize table logic and provide a configured instance
 */
'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { DataTableColumnDef } from '../../../types/column-types'
import { useDataTable } from '../../hooks/use-data-table'
import { useOnScreen } from '../utils/use-on-screen'

// Empty array to prevent unnecessary re-renders
const EMPTY_ARRAY: never[] = []

interface UseDataTableInstanceOptions<TData extends Record<string, unknown>> {
    columns?: (ColumnDef<TData> | DataTableColumnDef<TData>)[]
    data?: TData[]
    enableColumnFilters?: boolean
    enableMultiRowSelection?: boolean
    enablePagination?: boolean
    enableRowSelection?: boolean
    enableSorting?: boolean
    getRowId?: (row: TData) => string
    manualFiltering?: boolean
    manualPagination?: boolean
    manualSorting?: boolean
    onRowSelectionChange?: (selection: Record<string, boolean>) => void
    queryFn?: unknown
    tableId: string
    tableType?: string
}

export function useDataTableInstance<
    TData extends Record<string, unknown> = Record<string, unknown>
>({
    columns = EMPTY_ARRAY as unknown as (ColumnDef<TData> | DataTableColumnDef<TData>)[],
    data: initialData = EMPTY_ARRAY as unknown as TData[],
    enableColumnFilters = true,
    enableMultiRowSelection = true,
    enablePagination = true,
    enableRowSelection = true,
    enableSorting = true,
    getRowId: externalGetRowId,
    manualFiltering = false,
    manualPagination = false,
    manualSorting = false,
    onRowSelectionChange,
    queryFn,
    tableId,
    tableType
}: UseDataTableInstanceOptions<TData>) {
    // Optimization: Add a debounce timer ref to batch rapid state changes
    const debounceTimerRef = useRef<null | number>(null)

    // Optimization: Add a flag to track if we're in a batch update
    const isBatchingUpdatesRef = useRef(false)

    // Handler for batched updates to avoid cascading re-renders
    const batchUpdate = useCallback((updateFn: () => void) => {
        // If we're already batching, add this update to the queue
        if (isBatchingUpdatesRef.current) {
            // If we have an existing timer, clear it
            if (debounceTimerRef.current !== null) {
                window.clearTimeout(debounceTimerRef.current)
            }
        }

        // Set the batching flag
        isBatchingUpdatesRef.current = true

        // Schedule the update with a short delay to batch multiple changes
        debounceTimerRef.current = window.setTimeout(() => {
            // Execute the batched update
            updateFn()

            // Clear the batching flag
            isBatchingUpdatesRef.current = false
            debounceTimerRef.current = null
        }, 0)
    }, [])

    // Use our unified data table hook for everything
    const {
        data,
        error,
        isError,
        isLoading,
        refetch,
        state,
        tableInstance: table
    } = useDataTable({
        enabled: true,
        tableId,
        tableType: tableType || tableId
    })

    // Extract table state for ease of access
    const { columnFilters, columnOrder, columnVisibility, pagination, sorting } = state

    // Get all leaf column IDs - memoized to prevent recalculating on each render
    const leafColumnIds = useMemo(() => {
        return table.getAllLeafColumns().map((column) => column.id)
    }, [table])

    // Use intersection observer to detect when table is visible/in viewport
    const { isVisible, ref } = useOnScreen({
        rootMargin: '100px', // Load a bit before it's visible
        threshold: 0.1
    })

    // Debounce table updates to minimize expensive layout operations
    const [isTableUpdating, setIsTableUpdating] = useState(false)

    // Add debouncing for state updates to prevent rapid changes
    const debouncedBatchUpdate = useCallback((fn: () => void) => {
        // If we have an existing timer, clear it
        if (debounceTimerRef.current !== null) {
            window.clearTimeout(debounceTimerRef.current)
        }

        // Schedule the update with a longer delay to batch multiple state changes
        debounceTimerRef.current = window.setTimeout(() => {
            fn()
            debounceTimerRef.current = null
        }, 50) // 50ms delay to batch state changes
    }, [])

    // Function to set column order
    const setColumnOrder = useCallback(
        (newOrder: string[]) => {
            debouncedBatchUpdate(() => {
                table.setColumnOrder(newOrder)
            })
        },
        [table, debouncedBatchUpdate]
    )

    return {
        // Actions
        batchUpdate,
        // Data and state
        columnFilters,
        columnOrder,
        columnVisibility,
        data,
        debouncedBatchUpdate,
        error,
        isError,
        isLoading,
        isTableUpdating,
        isVisible,
        leafColumnIds,
        pagination,
        ref,
        refetch,
        setColumnOrder,
        setIsTableUpdating,
        sorting,
        table
    }
}
