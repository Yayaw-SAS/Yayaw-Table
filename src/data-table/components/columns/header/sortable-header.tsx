'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Column } from '@tanstack/react-table';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

import { getColumnPinningStyles } from '../../../utils/column-pinning-styles';

interface SortableHeaderProps {
  /**
   * Column content
   */
  children: ReactNode;

  /**
   * Additional className to apply to the header
   */
  className?: string;

  /**
   * The column object from TanStack Table
   */
  column?: Column<Record<string, unknown>, unknown>;

  /**
   * Unique ID for the column
   */
  id: string;

  /**
   * Whether drag and drop is enabled
   */
  isDragEnabled?: boolean;

  /**
   * Column width style
   */
  style?: CSSProperties;
}

/**
 * Sortable header component for data table columns
 * Uses dnd-kit's useSortable hook to enable drag and drop
 */
export function SortableHeader({
  children,
  className,
  column,
  id,
  isDragEnabled = false,
  style,
}: SortableHeaderProps) {
  // Get sortable attributes and listeners from dnd-kit
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id,
  });

  // Avoid SSR/CSR hydration mismatches: attach DnD attrs only after hydration
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Get pinning styles if column is provided
  const pinningStyles = column ? getColumnPinningStyles(column) : {};

  // Combine styles for the sortable header with improved visual feedback
  const sortableStyles: CSSProperties = {
    boxShadow: isDragging
      ? '0 2px 10px rgba(0, 0, 0, 0.1)'
      : pinningStyles.boxShadow || 'none',
    left: pinningStyles.left,
    opacity: isDragging ? 0.8 : pinningStyles.opacity || 1,
    position: isDragging
      ? 'relative'
      : (pinningStyles.position as 'relative' | 'sticky') || 'relative',
    right: pinningStyles.right,
    transform: CSS.Translate.toString(transform), // Using Translate for smoother performance
    transition,
    zIndex: isDragging ? 50 : pinningStyles.zIndex || 0,
    ...style,
  };

  // Create props to pass to the children
  const dragProps = isHydrated && isDragEnabled ? { ...listeners } : {};

  return (
    <TableHead
      className={cn(
        'group relative border-border border-r [&:has([role=checkbox])]:pr-2 [&:has([role=checkbox])]:pl-4',
        isDragging && 'z-10 bg-muted opacity-50',
        className
      )}
      data-column-id={id} // Add data-column-id attribute for DOM-based fallback
      ref={isHydrated ? setNodeRef : undefined}
      style={sortableStyles}
      {...(isHydrated ? attributes : {})}
      {...dragProps}
    >
      {children}
    </TableHead>
  );
}
