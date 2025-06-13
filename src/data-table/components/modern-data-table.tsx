/**
 * Modern implementation of the DataTable component
 * A cleaner approach using modular components and hooks
 */
"use client"

import { Loader } from "@/components/ui-custom/loader"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorBlock } from "@/components/ui-custom/error-block"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { DataTableProps } from "@/types/index"
import { flexRender } from "@tanstack/react-table"
import { useAtom } from "jotai"
import type React from "react"
import { memo, useCallback, useEffect, useMemo, useRef } from "react"

import { tableIdAtom } from "../atoms/table-atoms"
import { DataTableColumnHeader } from "../components/columns/header/column-header"
import { useColumnDnd } from "../components/columns/hooks/use-column-dnd"
import { useColumnDragOverlay } from "../components/columns/hooks/use-column-drag-overlay"
import { useDataTable } from "../hooks/use-data-table"
import { useTableInstance } from "../hooks/use-table-instance"

import { ColumnDragOverlay } from "./columns"
import { DataTablePagination } from "./data-table-pagination"

import { SortableHeader } from "./index"

import type { Cell, ColumnDef, Row } from "@tanstack/react-table"

// Debug flag for logging
const DEBUG = false

type ModernDataTableProps<TData extends Record<string, unknown>, TValue = unknown> = Omit<
    DataTableProps<TData, TValue>,
    "children" | "initialActiveViewId" | "initialViews"
> & {
    className?: string
    enableColumnDragDropByDefault?: boolean
    enableColumnFilters?: boolean
    enableMultiRowSelection?: boolean
    enablePagination?: boolean
    enableRowDragDrop?: boolean
    enableRowSelection?: boolean
    enableSorting?: boolean
    getRowId?: (row: TData) => string
    manualFiltering?: boolean
    manualPagination?: boolean
    manualSorting?: boolean
    onRowSelectionChange?: (rows: Row<TData>[]) => void
    queryFn?: (
        params: Record<string, unknown>
    ) => Promise<{ data: TData[]; pageCount: number; rowCount: number }>
    rowSelection?: Record<string, boolean>
    tableType?: string
}

// Separate cell rendering into its own memoized component
const MemoizedTableCell = memo<{
    cell: Cell<Record<string, unknown>, unknown>
}>(({ cell }) => <TableCell>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)

MemoizedTableCell.displayName = "MemoizedTableCell"

// Optimize table row with better memoization
const MemoizedTableRow = memo<{
    isSelected: boolean
    row: Row<Record<string, unknown>>
}>(
    ({ isSelected, row }) => {
        // Memoize visible cells to prevent unnecessary recalculation
        const visibleCells = useMemo(() => row.getVisibleCells(), [row])

        return (
            <TableRow
                className={cn(
                    isSelected && "bg-muted/50",
                    // Add CSS containment to reduce layout recalculation scope
                    "contain-paint"
                )}
                key={row.id}
            >
                {visibleCells.map((cell) => (
                    <MemoizedTableCell cell={cell} key={cell.id} />
                ))}
            </TableRow>
        )
    },
    (prevProps, nextProps) => {
        // Custom equality check for better memoization
        if (prevProps.isSelected !== nextProps.isSelected) return false
        if (prevProps.row.id !== nextProps.row.id) return false

        // Check if any cell values have changed
        const prevCells = prevProps.row.getVisibleCells()
        const nextCells = nextProps.row.getVisibleCells()

        if (prevCells.length !== nextCells.length) return false

        for (let i = 0; i < prevCells.length; i++) {
            if (prevCells[i].getValue() !== nextCells[i].getValue()) return false
        }

        return true
    }
)

MemoizedTableRow.displayName = "MemoizedTableRow"

// Optimize skeleton row with better memoization
const MemoizedSkeletonRow = memo<{
    columns: ColumnDef<Record<string, unknown>, unknown>[]
    rowIndex: number
}>(({ columns, rowIndex }) => (
    <TableRow key={`skeleton-row-${rowIndex}`}>
        {columns.map((_, cellIndex) => (
            <TableCell key={`skeleton-cell-${rowIndex}-${cellIndex}`}>
                <Skeleton className="h-8 w-full" />
            </TableCell>
        ))}
    </TableRow>
))

MemoizedSkeletonRow.displayName = "MemoizedSkeletonRow"

/**
 * Modern implementation of DataTable using the new hooks and components
 */
function ModernDataTable<TData extends Record<string, unknown>, TValue = unknown>({
    className,
    columns = [],
    data: initialData = [],
    enableColumnDragDropByDefault = true,
    enableColumnFilters = true,
    enableMultiRowSelection = true,
    enablePagination = true,
    enableRowDragDrop = false,
    enableRowSelection = true,
    enableSorting = true,
    getRowId,
    manualFiltering = false,
    manualPagination = false,
    manualSorting = false,
    onRowSelectionChange,
    queryFn,
    rowSelection,
    tableId,
    tableType
}: ModernDataTableProps<TData, TValue>) {
    // Set global table ID - only once when component mounts or tableId changes
    const [, setGlobalTableId] = useAtom(tableIdAtom)
    useEffect(() => {
        setGlobalTableId(tableId)
        return () => setGlobalTableId("")
    }, [tableId, setGlobalTableId])

    // State for optimization - use refs instead of state where possible
    const isTableUpdatingRef = useRef(false)
    const isVisibleRef = useRef(true)
    const tableRef = useRef<HTMLDivElement>(null)
    const previousRowsRef = useRef<Row<TData>[]>([])

    // Use stable references for callbacks
    const stableOnRowSelectionChange = useRef(onRowSelectionChange)
    useEffect(() => {
        stableOnRowSelectionChange.current = onRowSelectionChange
    }, [onRowSelectionChange])

    // Use our data table hook to get everything we need - with stable config
    const tableConfig = useMemo(
        () => ({
            enabled: true,
            enableMultiRowSelection: true,
            enableRowSelection: true,
            getRowId: (originalRow: TData) =>
                (originalRow as Record<string, unknown>).id?.toString() || "",
            tableId,
            tableType: tableType || tableId
        }),
        [tableId, tableType]
    )

    const {
        data: fetchedData,
        error,
        isError,
        isLoading,
        refetch,
        state,
        tableInstance: originalTable
    } = useDataTable(tableConfig)

    // Use provided data (potentially filtered) or fallback to fetched data
    const data = initialData.length > 0 ? initialData : fetchedData

    // Create a table instance with the actual data to be used (filtered or not)
    const table = useTableInstance({
        columns: columns as ColumnDef<TData>[],
        data: data as TData[],
        enableColumnFilters,
        enableMultiRowSelection,
        enablePagination,
        enableRowSelection,
        enableSorting,
        getRowId,
        manualFiltering,
        manualPagination,
        manualSorting,
        tableId: tableId || ""
    })

    // Handle row selection changes
    useEffect(() => {
        if (onRowSelectionChange && table) {
            const currentSelection = table.getState().rowSelection
            const selectedRows = table
                .getRowModel()
                .rows.filter((row) => currentSelection[row.id]) as Row<TData>[]

            onRowSelectionChange(selectedRows)

            console.log("[ModernDataTable] Selection changed:", {
                selectedRows,
                selection: currentSelection
            })
        }
    }, [table, onRowSelectionChange])

    // Extract important state from the table - memoize derived values
    const { columnOrder, pagination } = state

    // Get leaf column IDs for column ordering - memoized
    const leafColumnIds = useMemo(
        () => table.getAllLeafColumns().map((column) => column.id),
        [table]
    )

    // Function to set column order - stable reference
    const setColumnOrder = useCallback(
        (newOrder: string[]) => {
            if (!isTableUpdatingRef.current) {
                table.setColumnOrder(newOrder)
            }
        },
        [table]
    )

    // Update column order effect - simplified
    useEffect(() => {
        if (leafColumnIds.length > 0 && (!columnOrder || columnOrder.length === 0)) {
            setColumnOrder(leafColumnIds)
        }
    }, [leafColumnIds, columnOrder, setColumnOrder])

    // Update loading state - use ref instead of state
    useEffect(() => {
        isTableUpdatingRef.current = isLoading
    }, [isLoading])

    // Set up column drag and drop - stable reference
    const handleColumnOrderChange = useCallback(
        (newOrder: string[]) => {
            setColumnOrder(newOrder)
        },
        [setColumnOrder]
    )

    const {
        activeDragId: activeColumnDragId,
        closestCenter: columnClosestCenter,
        DndContext: ColumnDndContext,
        handleDragEnd: handleColumnDragEnd,
        handleDragStart: handleColumnDragStart,
        horizontalListSortingStrategy,
        isDragEnabled,
        modifiers,
        sensors: columnSensors,
        SortableContext: ColumnSortableContext
    } = useColumnDnd(tableId, handleColumnOrderChange, enableColumnDragDropByDefault)

    // Use hook to manage overlay during drag and drop
    const {
        activeColumn,
        handleDragEnd: handleDragEndWithOverlay,
        handleDragStart: handleDragStartWithOverlay
    } = useColumnDragOverlay({
        onDragEnd: handleColumnDragEnd,
        onDragStart: handleColumnDragStart,
        table
    })

    // Create a loading overlay component
    const LoadingOverlay = useMemo(() => {
        const Component: React.FC = () => (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80">
                <div className="flex flex-col items-center">
                    <Loader size="xl" />
                    <div className="mt-4 text-muted-foreground text-sm">Loading...</div>
                </div>
            </div>
        )
        Component.displayName = "LoadingOverlay"
        return Component
    }, [])

    // Optimize table body content with better memoization
    const tableBodyContent = useMemo(() => {
        if (isTableUpdatingRef.current || (isLoading && (!data || data.length === 0))) {
            const skeletonRows = Array.from({ length: 5 }).map((_, rowIndex) => (
                <MemoizedSkeletonRow
                    columns={table.getAllColumns()}
                    key={`skeleton-row-${rowIndex}`}
                    rowIndex={rowIndex}
                />
            ))
            return <TableBody>{skeletonRows}</TableBody>
        }

        const rows = table.getRowModel().rows as Row<TData>[]

        const rowElements = rows.map((row) => {
            const visibleCells = row.getVisibleCells()
            return (
                <TableRow
                    className={cn(
                        "data-[state=selected]:bg-muted/50",
                        row.getIsSelected() && "bg-muted/50"
                    )}
                    data-state={row.getIsSelected() ? "selected" : ""}
                    key={row.id}
                >
                    {visibleCells.map((cell) => (
                        <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                    ))}
                </TableRow>
            )
        })

        return <TableBody>{rowElements}</TableBody>
    }, [isLoading, data, table])

    // Optimize table header with better memoization
    const tableHeader = useMemo(
        () => {
            console.log("🔄 [ModernDataTable] Re-rendering tableHeader, columnOrder:", columnOrder)
            return (
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            <ColumnSortableContext
                                items={leafColumnIds}
                                strategy={horizontalListSortingStrategy}
                            >
                                {headerGroup.headers.map((header) => {
                                    const isFixedPosition =
                                        header.id === "select" || header.id === "actions"
                                    return (
                                        <SortableHeader
                                            className={cn(
                                                "relative whitespace-nowrap px-0",
                                                header.id === "select" && "select-column",
                                                header.id === "actions" &&
                                                    "sticky right-0 z-10 shadow-md"
                                            )}
                                            column={header.column as any}
                                            id={header.id}
                                            isDragEnabled={isDragEnabled && !isFixedPosition}
                                            key={header.id}
                                        >
                                            {!header.isPlaceholder && (
                                                <DataTableColumnHeader
                                                    column={header.column}
                                                    table={table}
                                                    tableId={tableId}
                                                    title={header.column.columnDef.header as string}
                                                />
                                            )}
                                        </SortableHeader>
                                    )
                                })}
                            </ColumnSortableContext>
                        </TableRow>
                    ))}
                </TableHeader>
            )
        },
        [
            table,
            leafColumnIds,
            isDragEnabled,
            tableId,
            horizontalListSortingStrategy,
            ColumnSortableContext,
            columnOrder
        ]
    )

    // Only show empty state if we have no data AND we shouldn't show table UI
    // This ensures we always show the table UI when using server-side operations
    const shouldShowTableUI = manualFiltering || manualPagination || manualSorting
    const showEmptyState = (!data || data.length === 0) && !shouldShowTableUI

    // Create empty state content
    const emptyStateContent = useMemo(
        () => (
            <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
                <p className="font-semibold text-lg">No results found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
            </div>
        ),
        []
    )

    // Render the content based on state
    const renderContent = () => {
        // Render error state using the ErrorBlock component
        if (isError) {
            return (
                <div className="h-64">
                    <ErrorBlock
                        action={{
                            href: "#",
                            label: "Reset"
                        }}
                        description={error?.message || "There was an error loading the data."}
                        reset={refetch}
                        title="Error"
                    />
                </div>
            )
        }

        // Show empty state if applicable
        if (showEmptyState) {
            return emptyStateContent
        }

        // Otherwise render the full table
        return (
            <ColumnDndContext
                collisionDetection={columnClosestCenter}
                modifiers={modifiers}
                onDragEnd={handleDragEndWithOverlay}
                onDragStart={handleDragStartWithOverlay}
                sensors={columnSensors}
            >
                <div className="space-y-4">
                    <div className="relative rounded-md border">
                        {/* Show loading overlay during data fetches when we already have data */}
                        {isLoading && data && data.length > 0 && <LoadingOverlay />}

                        {/* Container for the table */}
                        <div
                            className={cn("relative w-full overflow-auto", "contain-paint")}
                            ref={tableRef}
                        >
                            <Table className={cn("w-full", className)}>
                                {tableHeader}
                                {tableBodyContent}
                            </Table>
                        </div>
                    </div>

                    {/* Pagination is outside the table container to avoid focus issues */}
                    {enablePagination && <DataTablePagination table={table} tableId={tableId} />}
                </div>

                {/* Column drag overlay is rendered at the context level */}
                <ColumnDragOverlay
                    id={activeColumn?.id}
                    isDragging={!!activeColumn}
                    title={activeColumn?.title}
                />
            </ColumnDndContext>
        )
    }

    // Render the component
    return <div className="space-y-4">{renderContent()}</div>
}

/**
 * Helper function to batch DOM updates and minimize layout thrashing
 */
function useDebouncedLayoutEffect(callback: () => void, dependencies: React.DependencyList) {
    useEffect(() => {
        // Use requestAnimationFrame to batch multiple DOM updates
        // This prevents layout thrashing by ensuring all measurements
        // are done before any DOM updates
        let rafId: number
        const update = () => {
            // Cancel any pending update
            if (rafId) {
                cancelAnimationFrame(rafId)
            }

            // Schedule the update for the next animation frame
            rafId = requestAnimationFrame(() => {
                callback()
            })
        }

        update()

        // Cleanup on unmount or dependency change
        return () => {
            if (rafId) {
                cancelAnimationFrame(rafId)
            }
        }
    }, [callback, ...dependencies])
}

// Memoize the component to avoid unnecessary rerenders
const MemoizedModernDataTable = memo(ModernDataTable) as typeof ModernDataTable

// Export the component with proper typing
export function DataTable<TData extends Record<string, unknown>, TValue = unknown>(
    props: ModernDataTableProps<TData, TValue>
) {
    return <MemoizedModernDataTable {...props} />
}
