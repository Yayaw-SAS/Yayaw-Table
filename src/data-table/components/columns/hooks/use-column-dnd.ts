/**
 * Hook for handling column drag and drop functionality
 * Uses dnd-kit for drag and drop operations
 * Uses URL state as source of truth for column order (shareable URLs)
 */
'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useAtom } from 'jotai';
import { useCallback, useEffect } from 'react';

import {
  activeColumnDragAtom,
  columnDragEnabledAtom,
} from '../../../atoms/table-atoms';
import { useTableUrlState } from '../../../hooks/use-table-url-state';

// Utility function to move array items
function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const newArray = [...array];
  const [removed] = newArray.splice(from, 1);
  newArray.splice(to, 0, removed);
  return newArray;
}

/**
 * Hook for managing column drag and drop
 * @param tableId - ID of the table
 * @param onColumnOrderChange - Optional callback for when column order changes
 * @param enableByDefault - Whether to enable drag & drop by default (from configuration)
 * @returns Object with column drag and drop utilities
 */
export function useColumnDnd(
  tableId: string,
  onColumnOrderChange?: (newOrder: string[]) => void,
  enableByDefault?: boolean
) {
  // **URL STATE** - source of truth for column order (shareable)
  const { orderParam, setOrderFromUI } = useTableUrlState({ tableId });

  // Helper function to enforce fixed positions
  const enforceFixedPositions = useCallback((order: string[]): string[] => {
    const selectCol = order.find((id) => id === 'select');
    const actionsCol = order.find((id) => id === 'actions');
    const otherCols = order.filter((id) => id !== 'select' && id !== 'actions');

    const finalOrder: string[] = [];
    if (selectCol) {
      finalOrder.push(selectCol);
    }
    finalOrder.push(...otherCols);
    if (actionsCol) {
      finalOrder.push(actionsCol);
    }

    return finalOrder;
  }, []);

  // **ATOMS** - only for temporary UI state (not shareable)
  const [activeDragId, setActiveDragId] = useAtom(
    activeColumnDragAtom(tableId)
  );
  const [isDragEnabled, setIsDragEnabled] = useAtom(
    columnDragEnabledAtom(tableId)
  );

  // Initialize drag enabled state based on configuration
  useEffect(() => {
    if (enableByDefault !== undefined) {
      // Check if this is the first time or if localStorage doesn't have a value
      const storageKey = `${tableId}-column-drag-enabled`;
      const currentValue = localStorage.getItem(storageKey);

      if (currentValue === null) {
        // First time - use the configuration value
        setIsDragEnabled(enableByDefault);
      } else if (enableByDefault && currentValue === 'false') {
        // Configuration says true but localStorage has false - prefer configuration for new setup
        setIsDragEnabled(enableByDefault);
      }
    }
  }, [tableId, enableByDefault, setIsDragEnabled]);

  // Get current column order from URL state
  const columnOrder = (orderParam as string[]) || [];

  // Configure sensors for drag and drop
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { distance: 8 }, // Require a minimum drag distance
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 5 }, // Add a small delay for touch
  });

  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

  // Handle drag start event
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      if (active) {
        setActiveDragId(active.id.toString());
      }
    },
    [setActiveDragId]
  );

  // Helper function to check if a column ID is fixed (non-draggable)
  const isFixedColumn = useCallback((columnId: string): boolean => {
    return columnId === 'select' || columnId === 'actions';
  }, []);

  // Helper function to validate drag operation
  const validateDragOperation = useCallback(
    (activeId: string, overId: string): boolean => {
      return !(isFixedColumn(activeId) || isFixedColumn(overId));
    },
    [isFixedColumn]
  );

  // Helper function to get column order from DOM
  const getColumnOrderFromDOM = useCallback((): string[] | null => {
    const headerElements = document.querySelectorAll('[data-column-id]');
    const idsFromDOM = Array.from(headerElements).map((el) =>
      el.getAttribute('data-column-id')
    );

    if (idsFromDOM.length > 0) {
      return idsFromDOM.filter(Boolean) as string[];
    }
    return null;
  }, []);

  // Helper function to process column reorder
  const processColumnReorder = useCallback(
    (newOrder: string[]) => {
      // Ensure fixed positions: select first, actions last
      const finalOrder = enforceFixedPositions(newOrder);

      // Update URL state
      setOrderFromUI(finalOrder);

      // Call the callback if provided
      if (onColumnOrderChange) {
        onColumnOrderChange(finalOrder);
      }
    },
    [enforceFixedPositions, setOrderFromUI, onColumnOrderChange]
  );

  // Helper function to handle the actual drag operation
  const handleValidDragOperation = useCallback(
    (activeId: string, overId: string) => {
      // Process the drag and drop event
      // If column order is empty, we need to get the columns from the DOM
      if (columnOrder.length === 0) {
        const newOrderFromDOM = getColumnOrderFromDOM();
        if (newOrderFromDOM) {
          processColumnReorder(newOrderFromDOM);
          return;
        }
      }

      // Get the current column order
      const oldIndex = columnOrder.indexOf(activeId);
      const newIndex = columnOrder.indexOf(overId);

      if (oldIndex !== -1 && newIndex !== -1) {
        // Calculate the new order by moving the item
        const newOrder = arrayMove(columnOrder, oldIndex, newIndex);
        processColumnReorder(newOrder);
      }
    },
    [columnOrder, getColumnOrderFromDOM, processColumnReorder]
  );

  // Handle drag end event
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      // Only update if we have a valid over target and it's different from the active item
      if (over && active.id !== over.id) {
        // Don't allow dragging fixed columns (select, actions)
        const activeId = active.id.toString();
        const overId = over.id.toString();

        if (validateDragOperation(activeId, overId)) {
          handleValidDragOperation(activeId, overId);
        }
      }

      // Reset active drag ID
      setActiveDragId(null);
    },
    [setActiveDragId, validateDragOperation, handleValidDragOperation]
  );

  // Toggle drag enabled
  const toggleDragEnabled = useCallback(() => {
    setIsDragEnabled((prev) => !prev);
  }, [setIsDragEnabled]);

  return {
    // State
    activeDragId,
    // DnD Kit utilities
    closestCenter,
    columnOrder,

    DndContext,
    // Event handlers
    handleDragEnd,
    handleDragStart,
    horizontalListSortingStrategy,
    isDragEnabled,
    // Modifiers
    modifiers: [restrictToHorizontalAxis],
    restrictToHorizontalAxis,

    sensors,
    SortableContext,

    // Actions
    toggleDragEnabled,
  };
}
