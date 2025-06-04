/**
 * JSON column component for data tables
 * Provides standardized display of JSON/array values
 */
"use client"

import type { CellContext, ColumnDef } from "@tanstack/react-table"
import { Braces, type LucideIcon } from "lucide-react"

import { JsonCell } from "../cells/json-cell"

/**
 * Custom properties for our column definitions
 */
type CustomColumnProps = {
    icon?: LucideIcon
    type?: string
}

/**
 * Combined type for our column definition
 */
type ExtendedColumnDef<TData> = ColumnDef<TData> & CustomColumnProps

interface JsonColumnProps {
    /**
     * Key to access the JSON value from the row data
     */
    accessorKey: string

    /**
     * Optional CSS class name for the cell
     */
    className?: string

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
     * Maximum number of items to display before truncating
     * @default 3
     */
    maxItems?: number
}

/**
 * Creates a JSON column definition
 * @returns Column definition for displaying JSON or array values
 */
export function createJsonColumn<TData>({
    accessorKey,
    className,
    enableHiding = true,
    enableSorting = true,
    header,
    maxItems = 3
}: JsonColumnProps): ExtendedColumnDef<TData> {
    return {
        accessorKey,
        cell: (info: CellContext<TData, unknown>) => {
            const value = info.getValue()
            return <JsonCell className={className} maxItems={maxItems} value={value} />
        },
        enableHiding,
        enableSorting,
        header: header || accessorKey,
        icon: Braces,
        id: accessorKey,
        type: "json"
    }
}
