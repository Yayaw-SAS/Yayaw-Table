/**
 * String column component for data tables
 * Provides standardized display of string values
 */
"use client"

import type { CellContext, ColumnDef } from "@tanstack/react-table"
import { Asterisk, type LucideIcon } from "lucide-react"

import { StringCell } from "../cells/string-cell"

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

interface StringColumnProps {
    /**
     * Key to access the string value from the row data
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
     * Whether to show quotes around the string
     * @default false
     */
    showQuotes?: boolean
}

/**
 * Creates a string column definition
 * @returns Column definition for displaying string values
 */
export function createStringColumn<TData>({
    accessorKey,
    className,
    enableHiding = true,
    enableSorting = true,
    header,
    showQuotes = false
}: StringColumnProps): ExtendedColumnDef<TData> {
    return {
        accessorKey,
        cell: (info: CellContext<TData, unknown>) => {
            const value = info.getValue()
            return <StringCell className={className} showQuotes={showQuotes} value={value} />
        },
        enableHiding,
        enableSorting,
        header: header || accessorKey,
        icon: Asterisk,
        id: accessorKey,
        type: "string"
    }
}
