/**
 * Code column component for data tables
 * Displays code values with monospace font styling
 */
"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { type LucideIcon, SquareCode } from "lucide-react"

import { CodeCell } from "../cells/code-cell"

/**
 * Options for creating a code column
 */
export interface CodeColumnOptions {
    /**
     * Optional CSS class name
     */
    className?: string

    /**
     * Whether the column can be filtered
     * @default true
     */
    enableColumnFilter?: boolean

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
     * Header text for the column
     */
    header: string

    /**
     * Unique identifier for the column
     */
    id: string
}

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

/**
 * Creates a column definition for displaying code values with monospace font
 */
export function createCodeColumn<TData>({
    className = "",
    enableColumnFilter = true,
    enableHiding = true,
    enableSorting = true,
    header,
    id
}: CodeColumnOptions): ExtendedColumnDef<TData> {
    return {
        accessorFn: (row: TData) => (row as Record<string, unknown>)[id],
        cell: ({ getValue }: { getValue: () => unknown }) => (
            <CodeCell className={className} value={getValue()} />
        ),
        enableColumnFilter,
        enableHiding,
        enableSorting,
        header,
        icon: SquareCode,
        id,
        type: "code"
    }
}
