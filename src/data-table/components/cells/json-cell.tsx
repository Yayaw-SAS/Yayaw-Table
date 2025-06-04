/**
 * JSON cell component for data tables
 * Shows formatted JSON values with appropriate styling
 */
"use client"

import { useTableTranslations } from "../../hooks"

export interface JsonCellProps {
    /**
     * Optional CSS class name
     */
    className?: string

    /**
     * Maximum number of items to display before truncating
     * @default 3
     */
    maxItems?: number

    /**
     * The value to display (can be an array, object, or primitive)
     */
    value: unknown
}

/**
 * Cell component for displaying JSON values
 * Shows arrays and objects in a compact, readable format
 */
export function JsonCell({ className = "", maxItems = 3, value }: JsonCellProps) {
    const translations = useTableTranslations()

    // Try to parse the value if it's a JSON string
    value = safelyParseJson(value)

    // Handle Prisma JSON objects with 'set' property
    if (value && typeof value === "object" && "set" in value) {
        value = (value as { set: unknown }).set
        // Try to parse the set value too if needed
        value = safelyParseJson(value)
    }

    // Handle null or undefined
    if (value === null || value === undefined) {
        return <span className="text-muted-foreground">-</span>
    }

    // Handle arrays
    if (Array.isArray(value)) {
        return (
            <div
                className={`flex max-w-[200px] flex-wrap gap-1 overflow-hidden text-ellipsis ${className}`}
            >
                {value.slice(0, maxItems).map((item, index) => {
                    // Try to parse the item if it's a JSON string
                    const parsedItem = safelyParseJson(item)

                    // Preserve JSON format for display
                    const displayValue =
                        parsedItem === null || parsedItem === undefined
                            ? "null"
                            : typeof parsedItem === "object"
                              ? JSON.stringify(parsedItem)
                              : typeof parsedItem === "string"
                                ? `&quot;${parsedItem}&quot;`
                                : String(parsedItem)

                    return (
                        <span
                            className="inline-flex items-center whitespace-nowrap rounded-md border px-2 py-1 text-xs"
                            key={index}
                            title={typeof item === "object" ? JSON.stringify(item) : String(item)}
                        >
                            {displayValue}
                        </span>
                    )
                })}
                {value.length > maxItems && (
                    <span className="inline-flex items-center rounded-md border bg-muted px-2 py-1 text-xs">
                        +{value.length - maxItems}
                    </span>
                )}
            </div>
        )
    }

    // Handle objects
    if (typeof value === "object" && value !== null) {
        const entries = Object.entries(value as Record<string, unknown>)
        return (
            <div
                className={`flex max-w-[200px] flex-wrap gap-1 overflow-hidden text-ellipsis ${className}`}
            >
                {entries.slice(0, maxItems).map(([key, val], index) => {
                    // Try to parse the value if it's a JSON string
                    const parsedVal = safelyParseJson(val)

                    // Preserve JSON format for display
                    const displayValue =
                        parsedVal === null || parsedVal === undefined
                            ? "null"
                            : typeof parsedVal === "object"
                              ? JSON.stringify(parsedVal)
                              : typeof parsedVal === "string"
                                ? `&quot;${parsedVal}&quot;`
                                : String(parsedVal)

                    // Full JSON representation for the tooltip
                    const fullValue = JSON.stringify({ [key]: val })

                    return (
                        <span
                            className="inline-flex items-center whitespace-nowrap rounded-md border px-2 py-1 text-xs"
                            key={key || index}
                            title={fullValue}
                        >
                            <span className="font-medium">&quot;{key}&quot;:</span> {displayValue}
                        </span>
                    )
                })}
                {entries.length > maxItems && (
                    <span className="inline-flex items-center rounded-md border bg-muted px-2 py-1 text-xs">
                        +{entries.length - maxItems}
                    </span>
                )}
            </div>
        )
    }

    // For strings that look like JSON but couldn't be parsed earlier
    if (
        typeof value === "string" &&
        (value.includes('\\"') ||
            value.includes("\\'") ||
            (value.includes("{") && value.includes("}"))) &&
        value.length > 2
    ) {
        try {
            // One more attempt to clean and parse the string
            const cleanValue = value.replace(/\\"/g, '"').replace(/\\'/g, "'")
            const parsedValue = JSON.parse(cleanValue)
            return (
                <span
                    className={`block max-w-[200px] truncate ${className}`}
                    title={JSON.stringify(parsedValue)}
                >
                    {JSON.stringify(parsedValue)}
                </span>
            )
        } catch (e) {
            // Fall through to default handling
        }
    }

    // Default fallback for primitive values
    const stringValue = typeof value === "string" ? value : JSON.stringify(value)
    return (
        <span className={`block max-w-[200px] truncate ${className}`} title={stringValue}>
            {stringValue}
        </span>
    )
}

/**
 * Safely parses a JSON string if it's a string that looks like JSON
 * Otherwise returns the original value
 */
function safelyParseJson(value: unknown): unknown {
    if (
        typeof value === "string" &&
        (value.startsWith("{") || value.startsWith("[")) &&
        (value.endsWith("}") || value.endsWith("]"))
    ) {
        try {
            return JSON.parse(value)
        } catch (e) {
            // If it can't be parsed as JSON, return the original
            return value
        }
    }
    return value
}
