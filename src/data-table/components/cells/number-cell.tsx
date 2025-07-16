/**
 * Number cell component for data tables
 * Shows formatted number values with appropriate styling
 */
'use client'

export interface NumberCellProps {
    /**
     * Optional CSS class name
     */
    className?: string

    /**
     * Optional formatter function to format the number
     */
    formatter?: (value: number) => string

    /**
     * The numeric value to display
     */
    value: number | string
}

/**
 * Cell component for displaying number values
 * Handles NaN and formatting options
 */
export function NumberCell({ className = '', formatter, value }: NumberCellProps) {
    // Handle null or undefined
    if (value === null || value === undefined) {
        return <span className="text-muted-foreground">-</span>
    }

    // Convert to number if it's a string
    const numValue = typeof value === 'string' ? Number(value) : value

    // Handle NaN
    if (Number.isNaN(numValue)) {
        return <span className={`text-muted-foreground ${className}`}>-</span>
    }

    // Apply formatter if provided
    if (formatter) {
        return <span className={className}>{formatter(numValue)}</span>
    }

    // Default display
    return <span className={className}>{String(numValue)}</span>
}
