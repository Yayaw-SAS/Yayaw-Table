/**
 * Tag cell component for data tables
 * Shows tag values with different colors based on the value
 */
"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useMemo } from "react"

// Define color palette with distinct colors that work well in both light and dark modes
interface TagColor {
    className: string
    name: string
}

const TAG_COLORS: TagColor[] = [
    { className: "bg-blue-500/80 text-white dark:bg-blue-600/90", name: "Blue" },
    {
        className: "bg-green-500/80 text-white dark:bg-green-600/90",
        name: "Green"
    },
    {
        className: "bg-amber-500/80 text-white dark:bg-amber-600/90",
        name: "Amber"
    },
    { className: "bg-red-500/80 text-white dark:bg-red-600/90", name: "Red" },
    {
        className: "bg-purple-500/80 text-white dark:bg-purple-600/90",
        name: "Purple"
    },
    { className: "bg-pink-500/80 text-white dark:bg-pink-600/90", name: "Pink" },
    {
        className: "bg-indigo-500/80 text-white dark:bg-indigo-600/90",
        name: "Indigo"
    },
    { className: "bg-cyan-500/80 text-white dark:bg-cyan-600/90", name: "Cyan" },
    {
        className: "bg-emerald-500/80 text-white dark:bg-emerald-600/90",
        name: "Emerald"
    },
    {
        className: "bg-orange-500/80 text-white dark:bg-orange-600/90",
        name: "Orange"
    },
    { className: "bg-teal-500/80 text-white dark:bg-teal-600/90", name: "Teal" },
    {
        className: "bg-violet-500/80 text-white dark:bg-violet-600/90",
        name: "Violet"
    },
    { className: "bg-rose-500/80 text-white dark:bg-rose-600/90", name: "Rose" },
    { className: "bg-lime-500/80 text-white dark:bg-lime-600/90", name: "Lime" },
    {
        className: "bg-fuchsia-500/80 text-white dark:bg-fuchsia-600/90",
        name: "Fuchsia"
    },
    { className: "bg-sky-500/80 text-white dark:bg-sky-600/90", name: "Sky" }
]

// Cache of tag values to color indices
const tagColorMap = new Map<string, number>()

// Function to get a random integer between min (inclusive) and max (exclusive)
const getRandomInt = (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min)) + min
}

export interface TagCellProps {
    /**
     * Optional CSS class name
     */
    className?: string

    /**
     * The tag value to display
     */
    value: unknown
}

/**
 * Cell component for displaying tag values with colored backgrounds
 * Assigns a unique color to each unique tag value
 */
export function TagCell({ className = "", value }: TagCellProps) {
    // Handle Prisma JSON objects with 'set' property
    let processedValue = value
    if (processedValue && typeof processedValue === "object" && "set" in processedValue) {
        processedValue = (processedValue as { set: unknown }).set
    }

    // Convert to string, handling null/undefined
    const tagValue =
        processedValue === null || processedValue === undefined ? "" : String(processedValue)

    // Get or assign a color index for this tag value
    const colorIndex = useMemo(() => {
        // If empty, return a default index
        if (!tagValue) return 0

        // Check if we already assigned a color to this tag
        if (tagColorMap.has(tagValue)) {
            return tagColorMap.get(tagValue)!
        }

        // Assign a random color index and store it
        const randomIndex = getRandomInt(0, TAG_COLORS.length)
        tagColorMap.set(tagValue, randomIndex)
        return randomIndex
    }, [tagValue])

    const colorClass = TAG_COLORS[colorIndex].className

    // Handle null or undefined after computing the color (to avoid hook conditional error)
    if (processedValue === null || processedValue === undefined) {
        return <span className="text-muted-foreground">-</span>
    }

    // Display with tag styling
    return (
        <Badge
            className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs",
                colorClass,
                className
            )}
        >
            {tagValue}
        </Badge>
    )
}
