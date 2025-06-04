"use client"

import { DragOverlay } from "@dnd-kit/core"
import { GripVertical } from "lucide-react"
import type { ReactNode } from "react"

interface ColumnDragOverlayProps {
    /**
     * Optional children to render in the overlay
     */
    children?: ReactNode

    /**
     * ID of the active column being dragged
     */
    id?: string

    /**
     * Whether there is an active drag operation
     */
    isDragging: boolean

    /**
     * Title of the active column being dragged
     */
    title?: string
}

/**
 * Component that renders a visual overlay when dragging a column
 * Uses dnd-kit's DragOverlay for smooth animations
 */
export function ColumnDragOverlay({ children, id, isDragging, title }: ColumnDragOverlayProps) {
    return (
        <DragOverlay>
            {isDragging ? (
                <div
                    className="flex w-40 items-center gap-2 overflow-hidden rounded-md border bg-background p-2 shadow-md"
                    style={{
                        boxShadow: "0 5px 15px rgba(0, 0, 0, 0.15)",
                        opacity: 0.85,
                        transform: "rotate(-2deg)"
                    }}
                >
                    <GripVertical className="h-4 w-4 opacity-60" strokeWidth={2} />
                    <span className="truncate font-medium">{title || id}</span>
                    {children}
                </div>
            ) : null}
        </DragOverlay>
    )
}
