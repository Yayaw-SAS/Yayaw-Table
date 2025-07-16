/**
 * Dynamic type column component for data tables
 * Renders values differently based on a specified type column
 */
'use client'

import type { CellContext, ColumnDef } from '@tanstack/react-table'
import { type LucideIcon, Shapes } from 'lucide-react'
import { memo, type ReactNode, useMemo } from 'react'

// Import necessary components
import { useTableTranslations } from '../../hooks'
import { BooleanCell } from '../cells/boolean-cell'
import { JsonCell } from '../cells/json-cell'
import { NumberCell } from '../cells/number-cell'
import { StringCell } from '../cells/string-cell'

/**
 * Custom properties for our column definitions
 */
type CustomColumnProps = {
    icon?: LucideIcon
    type?: string
}

interface DynamicTypeColumnProps<_TData> {
    /**
     * Optional CSS class name
     */
    className?: string

    /**
     * Optional custom renderers for specific types
     */
    customRenderers?: Record<string, (value: unknown) => ReactNode>

    /**
     * Whether to enable hiding this column
     */
    enableHiding?: boolean

    /**
     * Whether to enable sorting for this column
     */
    enableSorting?: boolean

    /**
     * Optional custom header text
     */
    header?: string

    /**
     * The key for the type column that determines how to render the value
     */
    typeKey: string

    /**
     * The key for the value column
     */
    valueKey: string
}

/**
 * Combined type for our column definition
 */
type ExtendedColumnDef<TData> = ColumnDef<TData> & CustomColumnProps

/**
 * Creates a column that dynamically renders values based on a type column
 */
export function createDynamicTypeColumn<TData>({
    className = '',
    customRenderers = {},
    enableHiding = true,
    enableSorting = false,
    header,
    typeKey,
    valueKey
}: DynamicTypeColumnProps<TData>): ExtendedColumnDef<TData> {
    return {
        accessorKey: valueKey,
        cell: (info: CellContext<TData, unknown>) => {
            // Create a proper React component to use hooks
            // Define as an inner memoized component to prevent unnecessary renders
            const MemoizedDynamicCellRenderer = memo(function DynamicCellRenderer() {
                // Use hooks inside the component
                const _translations = useTableTranslations()

                // Extract values only once and memoize the calculation
                const { processedValue, valueType } = useMemo(() => {
                    let value = info.getValue()
                    const valueType = info.row.getValue(typeKey) as string

                    // Handle Prisma JSON objects with 'set' property
                    if (value && typeof value === 'object' && 'set' in value) {
                        value = (value as { set: unknown }).set
                    }

                    return { processedValue: value, valueType }
                }, [info, typeKey])

                // Handle null, undefined, or NaN values - memoize this decision
                const isEmptyValue = useMemo(() => {
                    return (
                        processedValue === null ||
                        processedValue === undefined ||
                        (typeof processedValue === 'number' && Number.isNaN(processedValue))
                    )
                }, [processedValue])

                // Memoize the content to render based on value type and empty state
                const content = useMemo(() => {
                    // First handle empty values
                    if (isEmptyValue) {
                        return <span className="text-muted-foreground">-</span>
                    }

                    // Check if there's a custom renderer for this type
                    if (customRenderers[valueType]) {
                        return <>{customRenderers[valueType](processedValue)}</>
                    }

                    // Format based on valueType
                    switch (valueType) {
                        case 'boolean':
                            // Use the boolean cell renderer
                            return <BooleanCell value={Boolean(processedValue)} />

                        case 'json':
                            // Use the JSON cell renderer
                            return <JsonCell value={processedValue} />

                        case 'number':
                            // Use the number cell renderer
                            return (
                                <NumberCell
                                    value={
                                        typeof processedValue === 'number'
                                            ? processedValue
                                            : Number(processedValue)
                                    }
                                />
                            )

                        case 'options':
                            // For options type, display the selected option
                            return <StringCell value={processedValue} />

                        case 'string':
                            // For string values, use text column with quotes
                            return <StringCell value={processedValue} />

                        default:
                            // Default fallback with safety check
                            return (
                                <span className={className}>
                                    {processedValue === null || processedValue === undefined
                                        ? ''
                                        : String(processedValue)}
                                </span>
                            )
                    }
                }, [valueType, processedValue, isEmptyValue, customRenderers, className])

                return content
            })

            // Return the memoized cell renderer component
            return <MemoizedDynamicCellRenderer />
        },
        enableHiding,
        enableSorting,
        header: header || valueKey,
        icon: Shapes,
        id: valueKey,
        type: 'dynamic'
    }
}
