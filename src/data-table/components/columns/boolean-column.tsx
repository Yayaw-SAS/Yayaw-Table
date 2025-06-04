/**
 * Boolean column component for data tables
 * Provides standardized display of boolean values using BooleanBadge
 */
"use client"

import type { CellContext } from "@tanstack/react-table"
import { ToggleRight } from "lucide-react"

import { BooleanCell } from "../cells/boolean-cell"

interface BooleanColumnProps {
    /**
     * Key to access the boolean value from the row data
     */
    accessorKey: string

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
 * Creates a boolean column definition
 * @returns Column definition for displaying boolean values with badges
 */
export function createBooleanColumn<TData>({
    accessorKey,
    enableHiding = true,
    enableSorting = true,
    header
}: BooleanColumnProps) {
    return {
        accessorKey,
        cell: (info: CellContext<TData, unknown>) => {
            const value = info.getValue()

            // Handle null or undefined values
            if (value === null || value === undefined) {
                return <span className="text-muted-foreground">-</span>
            }

            return <BooleanCell value={Boolean(value)} />
        },
        enableHiding,
        enableSorting,
        header: header || accessorKey,
        icon: ToggleRight,
        id: accessorKey,
        type: "boolean"
    }
}
