"use client";

import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import type { Table } from "@/components/ui/yayaw-table/tanstack";
import { useCallback, useState } from "react";

interface UseColumnDragOverlayProps<TData> {
  /**
   * Original drag end handler from useColumnDnd
   */
  onDragEnd?: (event: DragEndEvent) => void;

  /**
   * Original drag start handler from useColumnDnd
   */
  onDragStart?: (event: DragStartEvent) => void;

  /**
   * Table instance from TanStack Table
   */
  table: Table<TData>;
}

interface UseColumnDragOverlayReturn {
  /**
   * Active column information (id and title)
   */
  activeColumn: null | { id: string; title: string };

  /**
   * Enhanced drag end handler that clears the active column
   */
  handleDragEnd: (event: DragEndEvent) => void;

  /**
   * Enhanced drag start handler that tracks the active column
   */
  handleDragStart: (event: DragStartEvent) => void;
}

/**
 * Hook for managing column drag overlay state and handlers
 * Enhances the existing drag handlers to track the active column
 */
export function useColumnDragOverlay<TData>({
  onDragEnd,
  onDragStart,
  table,
}: UseColumnDragOverlayProps<TData>): UseColumnDragOverlayReturn {
  // State to track the active column being dragged
  const [activeColumn, setActiveColumn] = useState<null | {
    id: string;
    title: string;
  }>(null);

  // Enhanced drag start handler
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      // Call the original handler if provided
      if (onDragStart) {
        onDragStart(event);
      }

      // Get column information for the overlay
      const { active } = event;
      const columnId = active.id.toString();
      const column = table.getAllColumns().find((col) => col.id === columnId);

      if (column) {
        // Get the column title, fallback to ID if not available
        const columnTitle =
          typeof column.columnDef.header === "string"
            ? column.columnDef.header
            : columnId;

        // Update active column state
        setActiveColumn({ id: columnId, title: columnTitle });
      }
    },
    [onDragStart, table]
  );

  // Enhanced drag end handler
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      // Call the original handler if provided
      if (onDragEnd) {
        onDragEnd(event);
      }

      // Clear the active column state
      setActiveColumn(null);
    },
    [onDragEnd]
  );

  return {
    activeColumn,
    handleDragEnd,
    handleDragStart,
  };
}
