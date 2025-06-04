/**
 * Date column component for data tables
 * Provides standardized display of date values with formatting options
 */
"use client"

import type { CellContext, ColumnDef } from "@tanstack/react-table"
import { CalendarDays, type LucideIcon } from "lucide-react"

import { DateCell } from "../cells/date-cell"

/**
 * Custom properties for our column definitions
 */
type CustomColumnProps = {
    icon?: LucideIcon
    type?: string
}

interface DateColumnProps {
    /**
     * Key to access the date value from the row data
     */
    accessorKey: string

    /**
     * Optional CSS class name for the cell
     */
    className?: string

    /**
     * Date format string (date-fns compatible)
     * @default "PPP" (localized date with month name)
     */
    dateFormat?: string

    /**
     * Whether the column can be hidden
     * @default true
     */
    enableHiding?: boolean

    /**
     * Whether the column can be sorted
     * @default true
     */
    enableSorting?: boolean

    /**
     * Optional custom header text
     */
    header?: string

    /**
     * Whether to show the time
     * @default false
     */
    showTime?: boolean
}

/**
 * Combined type for our column definition
 */
type ExtendedColumnDef<TData> = ColumnDef<TData> & CustomColumnProps

/**
 * Creates a date column definition
 * @returns Column definition for displaying formatted date values
 */
export function createDateColumn<TData>({
    accessorKey,
    className,
    dateFormat = "PPP",
    enableHiding = true,
    enableSorting = true,
    header,
    showTime = false
}: DateColumnProps): ExtendedColumnDef<TData> {
    return {
        accessorKey,
        cell: (info: CellContext<TData, unknown>) => {
            // Cast the value to the appropriate type for DateCell
            const value = info.getValue() as Date | null | number | string | undefined
            return (
                <DateCell
                    className={className}
                    dateFormat={dateFormat}
                    showTime={showTime}
                    value={value}
                />
            )
        },
        enableHiding,
        enableSorting,
        header: header || accessorKey,
        icon: CalendarDays,
        id: accessorKey,
        type: "date"
    }
}
