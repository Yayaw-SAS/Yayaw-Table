/**
 * String cell component for data tables
 * Shows formatted string values with appropriate styling
 */
"use client"

export interface StringCellProps {
    /**
     * Optional CSS class name
     */
    className?: string

    /**
     * Whether to show quotes around the string
     * @default false
     */
    showQuotes?: boolean

    /**
     * The value to display as a string
     */
    value: unknown
}

/**
 * Cell component for displaying string values
 * Optionally shows quotes around the string
 */
export function StringCell({ className = "", showQuotes = false, value }: StringCellProps) {
    // Handle Prisma JSON objects with 'set' property
    if (value && typeof value === "object" && "set" in value) {
        value = (value as { set: unknown }).set
    }

    // Handle null or undefined
    if (value === null || value === undefined) {
        return <span className="text-muted-foreground">-</span>
    }

    // Convert to string
    const stringValue = String(value)

    // Display with or without quotes
    return <span className={className}>{showQuotes ? `"${stringValue}"` : stringValue}</span>
}
