/**
 * Utility functions for column pinning styles
 * Based on TanStack Table column pinning example
 */
'use client'

import type { Column } from '@tanstack/react-table'
import type { CSSProperties } from 'react'

/**
 * Get common styles for pinned columns
 * @param column - The column to get styles for
 * @returns CSS properties for the column
 */
export function getColumnPinningStyles<TData>(column: Column<TData>): CSSProperties {
    const isPinned = column.getIsPinned()
    const _isLastLeftPinnedColumn = isPinned === 'left' && column.getIsLastColumn('left')
    const _isFirstRightPinnedColumn = isPinned === 'right' && column.getIsFirstColumn('right')

    return {
        // Position the column based on its pinning
        left: isPinned === 'left' ? `${column.getStart('left')}px` : undefined,
        // Slight opacity difference for pinned columns
        opacity: isPinned ? 0.95 : 1,
        // Make pinned columns sticky
        position: isPinned ? 'sticky' : 'relative',
        right: isPinned === 'right' ? `${column.getAfter('right')}px` : undefined,
        // Set width based on column size
        width: column.getSize(),
        // Ensure pinned columns appear above other content
        zIndex: isPinned ? 1 : 0
    }
}
