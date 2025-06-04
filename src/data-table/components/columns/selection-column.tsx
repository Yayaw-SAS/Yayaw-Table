/**
 * Selection column component for data tables
 * Provides checkbox for row selection with proper accessibility
 */
"use client"

import { Checkbox } from "@/components/ui/checkbox"
import type { ColumnDef, Row, Table } from "@tanstack/react-table"
import { memo } from "react"

import { SelectionCell } from "../cells/selection-cell"

import type { ReactElement } from "react"

/**
 * Options for selection column
 */
export interface SelectionColumnOptions {
    /**
     * Custom CSS class name for the column
     */
    className?: string

    /**
     * Whether the column can be hidden
     */
    enableHiding?: boolean
}

/**
 * Props for the selection header component
 */
interface SelectionHeaderProps<TData> {
    /**
     * Optional CSS class name
     */
    className?: string

    /**
     * The table instance from TanStack Table
     */
    table: Table<TData>
}

// Memoize the header component to prevent unnecessary rerenders
const SelectionHeaderMemo = memo(function SelectionHeaderBase<TData>({
    className = "",
    table
}: SelectionHeaderProps<TData>) {
    if (!table) {
        console.warn("[SelectionHeader] Table is undefined")
        return <div className="flex h-4 w-4 items-center justify-center" />
    }

    try {
        const hasRequiredMethods =
            typeof table.getIsAllRowsSelected === "function" &&
            typeof table.toggleAllRowsSelected === "function" &&
            typeof table.getIsSomeRowsSelected === "function"

        if (!hasRequiredMethods) {
            console.warn("[SelectionHeader] Missing required selection methods")
            return <div className="flex h-4 w-4 items-center justify-center" />
        }

        const isAllSelected = table.getIsAllRowsSelected()
        const isSomeSelected = table.getIsSomeRowsSelected()

        return (
            <div className="flex items-center justify-center">
                <Checkbox
                    aria-label="Select all rows"
                    checked={isAllSelected}
                    className="translate-y-[2px] data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                    onCheckedChange={(value) => {
                        table.toggleAllRowsSelected(!!value)
                    }}
                    ref={(el: HTMLButtonElement & { indeterminate?: boolean }) => {
                        if (el) {
                            el.indeterminate = isSomeSelected && !isAllSelected
                        }
                    }}
                />
            </div>
        )
    } catch (error) {
        console.error("[SelectionHeader] Error rendering selection header:", error)
        return <div className="flex h-4 w-4 items-center justify-center" />
    }
}) as <T>(props: SelectionHeaderProps<T>) => ReactElement

/**
 * Creates a selection column definition
 * @param options - Options for customizing the selection column
 * @returns Column definition for row selection with checkboxes
 */
export function createSelectionColumn<TData>(
    options: SelectionColumnOptions = {}
): ColumnDef<TData, unknown> {
    const { className = "", enableHiding = false } = options

    return {
        accessorKey: "select",
        cell: ({ row }: { row: Row<TData> }) => <SelectionCell className={className} row={row} />,
        enableHiding,
        enablePinning: false,
        enableSorting: false,
        header: ({ table }: { table: Table<TData> }) => (
            <SelectionHeaderMemo className={className} table={table} />
        ),
        id: "select",
        meta: {
            disableDrag: true,
            disableDrop: true,
            fixedPosition: "start",
            isSelectionColumn: true
        }
    }
}
