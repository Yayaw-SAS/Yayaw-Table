/**
 * Text column component for data tables
 * Provides standardized display of text values
 */
"use client"

import type { CellContext, ColumnDef } from "@tanstack/react-table"
import { type LucideIcon, Text } from "lucide-react"

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

interface TextColumnProps {
    /**
     * Key to access the text value from the row data
     */
    accessorKey: string

    /**
     * Optional CSS class for the cell
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
}

/**
 * Creates a text column definition
 * @returns Column definition for displaying text values
 */
export function createTextColumn<TData>({
    accessorKey,
    className = "",
    enableHiding = true,
    enableSorting = true,
    header
}: TextColumnProps): ExtendedColumnDef<TData> {
    return {
        accessorKey,
        cell: (info: CellContext<TData, unknown>) => {
            const value = info.getValue()
            return <StringCell className={className} value={value} />
        },
        enableHiding,
        enableSorting,
        header: header || accessorKey,
        icon: Text,
        id: accessorKey,
        type: "text"
    }
}
