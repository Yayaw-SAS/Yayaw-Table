/**
 * Hook for handling row drag and drop functionality
 * Uses dnd-kit for drag and drop operations
 */
"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useAtom } from "jotai";
import { useCallback, useEffect, useMemo } from "react";

import {
  activeRowDragAtom,
  rowDragEnabledAtom,
  rowOrderAtom,
} from "../atoms/table-atoms";

import { useTableTranslations } from "./use-table-translations";

/**
 * Hook for managing row drag and drop
 * @param tableId - ID of the table
 * @param data - Array of data items
 * @param getRowId - Function to get row ID from data item
 * @returns Object with row drag and drop utilities
 */
export function useRowDnd<TData>(
  tableId: string,
  data: TData[],
  getRowId: (row: TData) => string
) {
  // Get translations
  const _translations = useTableTranslations();

  // Get atoms
  const [rowOrder, setRowOrder] = useAtom(rowOrderAtom(tableId));
  const [activeDragId, setActiveDragId] = useAtom(activeRowDragAtom(tableId));
  const [isDragEnabled, setIsDragEnabled] = useAtom(
    rowDragEnabledAtom(tableId)
  );

  // Initialize row order if not already set
  useEffect(() => {
    if (!rowOrder.length && data.length) {
      setRowOrder(data.map((row) => getRowId(row)));
    }
  }, [data, rowOrder.length, getRowId, setRowOrder]);

  // Configure sensors for mouse, touch, and keyboard interactions
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end event
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        setRowOrder((items) => {
          const oldIndex = items.indexOf(active.id.toString());
          const newIndex = items.indexOf(over.id.toString());

          // Return early if indexes are invalid
          if (oldIndex === -1 || newIndex === -1) {
            return items;
          }

          // Create new order by moving the item
          return arrayMove(items, oldIndex, newIndex);
        });
      }

      // Reset active drag ID
      setActiveDragId(null);
    },
    [setRowOrder, setActiveDragId]
  );

  // Handle drag start event
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setActiveDragId(event.active.id.toString());
    },
    [setActiveDragId]
  );

  // Toggle drag enabled
  const toggleDragEnabled = useCallback(() => {
    setIsDragEnabled((prev) => !prev);
  }, [setIsDragEnabled]);

  // Get ordered data based on rowOrder
  const orderedData = useMemo(() => {
    if (!(rowOrder.length && isDragEnabled)) {
      return data;
    }

    // Create a map for faster lookups
    const dataMap = new Map(data.map((item) => [getRowId(item), item]));

    // Return data in the order specified by rowOrder, filtering out any IDs that don't exist in the data
    const result = rowOrder
      .map((id) => dataMap.get(id))
      .filter(Boolean) as TData[];

    // If we're missing any items that exist in data but not in rowOrder, add them at the end
    const existingIds = new Set(rowOrder);
    const missingItems = data.filter(
      (item) => !existingIds.has(getRowId(item))
    );

    return [...result, ...missingItems];
  }, [data, rowOrder, getRowId, isDragEnabled]);

  // Reset row order to match data order
  const resetRowOrder = useCallback(() => {
    setRowOrder(data.map((row) => getRowId(row)));
  }, [data, getRowId, setRowOrder]);

  return {
    activeDragId,
    closestCenter,
    DndContext,
    // Event handlers
    handleDragEnd,

    handleDragStart,
    isDragEnabled,
    orderedData,

    resetRowOrder,
    restrictToVerticalAxis,

    // State
    rowOrder,
    // dnd-kit utilities
    sensors,
    // Actions
    setRowOrder,
    SortableContext,
    toggleDragEnabled,
    verticalListSortingStrategy,
  };
}
