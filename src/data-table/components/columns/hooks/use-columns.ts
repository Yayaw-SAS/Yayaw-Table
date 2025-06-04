/**
 * Hook for creating and managing column definitions
 * Provides a standardized way to define columns for any data type
 */
"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { useAtomValue } from "jotai"
import { useMemo } from "react"

import {
    createActionsColumn,
    createBooleanColumn,
    createCodeColumn,
    createDateColumn,
    createJsonColumn,
    createSelectionColumn,
    createTagColumn,
    createTextColumn
} from ".."
import { tableConfigFamilyAtom } from "../../../atoms/config-atoms"
import type { DataTableColumnDef } from "../../../../types/column-types"
import { createDynamicTypeColumn } from "../dynamic-type-column"
import { createNumberColumn } from "../number-column"
import { createStringColumn } from "../string-column"

export interface UseColumnsOptions<
    TData extends Record<string, unknown> = Record<string, unknown>
> {
    /**
     * Whether to include a selection column
     * If not specified, uses the enableRowSelection value from the table config
     */
    enableSelection?: boolean

    /**
     * Table identifier - used to scope configurations
     */
    tableId: string
}

/**
 * Hook for creating and managing column definitions
 * @param options - Configuration options
 * @returns Object with column creation utilities
 */
export function useColumns<TData extends Record<string, unknown> = Record<string, unknown>>({
    enableSelection,
    tableId
}: UseColumnsOptions<TData>) {
    // Get table configuration
    const tableConfig = useAtomValue(tableConfigFamilyAtom(tableId))

    // Determine if selection is enabled
    const isSelectionEnabled = useMemo(() => {
        return enableSelection !== undefined ? enableSelection : tableConfig.enableRowSelection
    }, [enableSelection, tableConfig.enableRowSelection])

    // Create a selection column if enabled
    const selectionColumn = useMemo(() => {
        if (!isSelectionEnabled) return null
        return createSelectionColumn<TData>()
    }, [isSelectionEnabled])

    // Create a tag column with the given options
    const createTag = useMemo(() => {
        return <K extends keyof TData>(
            accessorKey: K,
            options?: Omit<Parameters<typeof createTagColumn<TData>>[0], "header" | "id"> & {
                header?: string
            }
        ) => {
            return createTagColumn<TData>({
                header: options?.header || String(accessorKey),
                id: accessorKey as string,
                ...options
            })
        }
    }, [])

    // Create a text column with the given options
    const createText = useMemo(() => {
        return <K extends keyof TData>(
            accessorKey: K,
            options?: Omit<Parameters<typeof createTextColumn<TData>>[0], "accessorKey">
        ) => {
            return createTextColumn<TData>({
                accessorKey: accessorKey as string,
                ...options
            })
        }
    }, [])

    // Create a boolean column with the given options
    const createBoolean = useMemo(() => {
        return <K extends keyof TData>(
            accessorKey: K,
            options?: Omit<Parameters<typeof createBooleanColumn<TData>>[0], "accessorKey">
        ) => {
            return createBooleanColumn<TData>({
                accessorKey: accessorKey as string,
                ...options
            })
        }
    }, [])

    // Create a code column with the given options
    const createCode = useMemo(() => {
        return <K extends keyof TData>(
            accessorKey: K,
            options?: Omit<Parameters<typeof createCodeColumn<TData>>[0], "header" | "id"> & {
                header?: string
            }
        ) => {
            return createCodeColumn<TData>({
                header: options?.header || String(accessorKey),
                id: accessorKey as string,
                ...options
            })
        }
    }, [])

    // Create a date column with the given options
    const createDate = useMemo(() => {
        return <K extends keyof TData>(
            accessorKey: K,
            options?: Omit<Parameters<typeof createDateColumn<TData>>[0], "accessorKey">
        ) => {
            return createDateColumn<TData>({
                accessorKey: accessorKey as string,
                ...options
            })
        }
    }, [])

    // Create a JSON column with the given options
    const createJson = useMemo(() => {
        return <K extends keyof TData>(
            accessorKey: K,
            options?: Omit<Parameters<typeof createJsonColumn<TData>>[0], "accessorKey">
        ) => {
            return createJsonColumn<TData>({
                accessorKey: accessorKey as string,
                ...options
            })
        }
    }, [])

    // Create an actions column with the given options
    const createActions = useMemo(() => {
        return (options: Omit<Parameters<typeof createActionsColumn<TData>>[0], "tableId">) => {
            // Automatically pass the tableId from the hook parameters
            return createActionsColumn<TData>({
                ...options,
                tableId // Pass the tableId from the hook parameters
            })
        }
    }, [tableId])

    // Create a dynamic type column with the given options
    const createDynamicType = useMemo(() => {
        return <V extends keyof TData, T extends keyof TData>(
            valueKey: V,
            typeKey: T,
            options?: Omit<
                Parameters<typeof createDynamicTypeColumn<TData>>[0],
                "typeKey" | "valueKey"
            >
        ) => {
            return createDynamicTypeColumn<TData>({
                typeKey: typeKey as string,
                valueKey: valueKey as string,
                ...options
            })
        }
    }, [])

    // Create a number column with the given options
    const createNumber = useMemo(() => {
        return <K extends keyof TData>(
            accessorKey: K,
            options?: Omit<Parameters<typeof createNumberColumn<TData>>[0], "accessorKey">
        ) => {
            return createNumberColumn<TData>({
                accessorKey: accessorKey as string,
                ...options
            })
        }
    }, [])

    // Create a string column with the given options
    const createString = useMemo(() => {
        return <K extends keyof TData>(
            accessorKey: K,
            options?: Omit<Parameters<typeof createStringColumn<TData>>[0], "accessorKey">
        ) => {
            return createStringColumn<TData>({
                accessorKey: accessorKey as string,
                ...options
            })
        }
    }, [])

    // Create a selection column
    const createSelection = useMemo(() => {
        return () => createSelectionColumn<TData>()
    }, [])

    // Combine columns into a final array
    const createColumnHelper = useMemo(() => {
        return {
            actions: createActions,
            boolean: createBoolean,
            code: createCode,
            date: createDate,
            dynamicType: createDynamicType,
            json: createJson,
            number: createNumber,
            selection: createSelection,
            string: createString,
            tag: createTag,
            text: createText
        }
    }, [
        createActions,
        createBoolean,
        createCode,
        createDate,
        createDynamicType,
        createJson,
        createNumber,
        createSelection,
        createString,
        createTag,
        createText
    ])

    // Function to combine columns with the selection column if enabled
    const createColumns = useMemo(() => {
        return (columns: Array<ColumnDef<TData> | DataTableColumnDef<TData>>) => {
            // Check if selection column already exists in input columns
            const hasSelectionColumn = columns.some((col) => {
                const colWithId = col as ColumnDef<TData> & { id?: string }
                const colWithMeta = col as DataTableColumnDef<TData> & {
                    meta?: { isSelectionColumn?: boolean }
                }
                return colWithId.id === "select" || colWithMeta.meta?.isSelectionColumn
            })

            if (selectionColumn && !hasSelectionColumn) {
                return [selectionColumn, ...columns]
            }

            return columns
        }
    }, [selectionColumn])

    return {
        column: createColumnHelper,
        createColumns,
        selectionColumn
    }
}
