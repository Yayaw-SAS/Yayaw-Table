/**
 * Sortable row component for DataTable
 * Uses dnd-kit for drag and drop functionality
 */
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAtomValue } from "jotai";
import type * as React from "react";
import { cn } from "@/lib/utils";

import { activeRowDragAtom, rowDragEnabledAtom } from "../atoms/table-atoms";

interface SortableRowProps {
  children: React.ReactNode;
  className?: string;
  id: string;
  tableId: string;
}

/**
 * A sortable row component that can be dragged to reorder rows
 */
export function SortableRow({
  children,
  className,
  id,
  tableId,
}: SortableRowProps) {
  // Get state from atoms
  const isDragEnabled = useAtomValue(rowDragEnabledAtom(tableId));
  const activeDragId = useAtomValue(activeRowDragAtom(tableId));

  // Get sortable props from dnd-kit - always call hooks at the top level
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    // Use the provided ID directly for the DnD context
    data: {
      stableId: `row-${id}`,
    },
    disabled: !isDragEnabled, // Disable sortable functionality instead of conditionally rendering
    id,
  });

  // Create style for the draggable element
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Determine if this row is being dragged over
  const isOver = activeDragId !== null && activeDragId !== id;

  // If drag is disabled, just return the children as-is
  if (!isDragEnabled) {
    return <>{children}</>;
  }

  // Use a simpler approach to avoid hydration issues
  // Instead of trying to clone elements, we'll simply wrap the children in a div
  // with the drag-and-drop properties

  // Create an object with the drag-and-drop properties
  const dragProps = {
    ref: setNodeRef,
    style,
    ...attributes,
    ...listeners,
    "aria-label": `Drag to reorder row ${id}`,
    className: cn(
      className,
      "relative cursor-grab select-none",
      isDragging && "z-10 cursor-grabbing opacity-50 shadow-lg",
      isOver && "border-2 border-primary/50"
    ),
  };

  // Return the children wrapped in a div with the drag-and-drop properties
  return <div {...dragProps}>{children}</div>;
}
