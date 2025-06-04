/**
 * Code cell component for data tables
 * Shows code values with monospace font styling
 */
"use client"

import { cn } from "@/lib/utils"

export interface CodeCellProps {
    /**
     * Optional CSS class name
     */
    className?: string

    /**
     * The code value to display
     */
    value: unknown
}

/**
 * Cell component for displaying code values with monospace font
 */
export function CodeCell({ className = "", value }: CodeCellProps) {
    // Handle Prisma JSON objects with 'set' property
    if (value && typeof value === "object" && "set" in value) {
        value = (value as { set: unknown }).set
    }

    // Handle null or undefined
    if (value === null || value === undefined) {
        return <span className="text-muted-foreground">-</span>
    }

    // Convert to string
    const codeValue = String(value)

    // Display with monospace font
    return (
        <code className={cn("rounded bg-muted px-1.5 py-0.5 font-mono text-sm", className)}>
            {codeValue}
        </code>
    )
}
