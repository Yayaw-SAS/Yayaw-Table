/**
 * Utility functions for column pinning styles
 * Based on TanStack Table column pinning example
 */
"use client";

import type { CSSProperties } from "react";
import type { Column } from "../tanstack";

/**
 * Get common styles for pinned columns
 * @param column - The column to get styles for
 * @returns CSS properties for the column
 */
export function getColumnPinningStyles<TData>(
  column: Column<TData>
): CSSProperties {
  const isPinned = column.getIsPinned();
  const _isLastStartPinnedColumn =
    isPinned === "start" && column.getIsLastColumn("start");
  const _isFirstEndPinnedColumn =
    isPinned === "end" && column.getIsFirstColumn("end");

  return {
    // Position the column based on its pinning
    insetInlineStart:
      isPinned === "start" ? `${column.getStart("start")}px` : undefined,
    // Slight opacity difference for pinned columns
    opacity: isPinned ? 0.95 : 1,
    // Make pinned columns sticky
    position: isPinned ? "sticky" : "relative",
    insetInlineEnd:
      isPinned === "end" ? `${column.getAfter("end")}px` : undefined,
    // Set width based on column size
    width: column.getSize(),
    // Ensure pinned columns appear above other content
    zIndex: isPinned ? 1 : 0,
  };
}
