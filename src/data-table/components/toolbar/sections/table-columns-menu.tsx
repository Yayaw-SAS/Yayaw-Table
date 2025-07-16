'use client';

import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Column, VisibilityState } from '@tanstack/react-table';
import { useAtom } from 'jotai';
import type { LucideIcon } from 'lucide-react';
import {
  AtSign,
  Braces,
  Building,
  Calendar,
  Code,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  Hash,
  Tag,
  Text,
  ToggleRight,
  User,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { StackMenuContent } from '@/src/components/ui-custom/stack-menu';
import { tableIdAtom } from '../../../atoms/table-atoms';
import { useColumnDnd } from '../../../components/columns/hooks/use-column-dnd';
import { useDataTable } from '../../../hooks/use-data-table';
import { useTableUIConfig } from '../../../hooks/use-table-ui-config';
import { useTableUrlState } from '../../../hooks/use-table-url-state';
import { useTranslations } from '../../../providers/table-provider';

// Custom type for our enriched column definition
// columns: Array<{ canSort?: boolean; getCanSort: () => boolean; id: string; label: string; }>
type ExtendedColumnDef = Column<Record<string, unknown>, unknown> & {
  icon?: LucideIcon;
};

type SortableColumn = {
  canHide?: boolean;
  canSort?: boolean;
  getCanSort: () => boolean;
  id: string;
  label: string;
  type?: string;
};

// Helper functions for drag and drop (outside component to avoid dependency issues)
const determineDragSection = (
  activeId: string,
  visibleCols: SortableColumn[],
  hiddenCols: SortableColumn[]
) => {
  const isVisibleSection = visibleCols.some((col) => col.id === activeId);
  return {
    isVisibleSection,
    sourceColumns: isVisibleSection ? visibleCols : hiddenCols,
  };
};

const calculateNewColumnOrder = (
  isVisibleSection: boolean,
  newSourceCols: SortableColumn[],
  visibleCols: SortableColumn[],
  hiddenCols: SortableColumn[]
): string[] => {
  if (isVisibleSection) {
    const visibleIds = newSourceCols.map((col) => col.id);
    const hiddenIds = hiddenCols.map((col) => col.id);
    return [...visibleIds, ...hiddenIds];
  }
  const visibleIds = visibleCols.map((col) => col.id);
  const hiddenIds = newSourceCols.map((col) => col.id);
  return [...visibleIds, ...hiddenIds];
};

interface TableColumnsMenuProps {
  columns: Array<{
    canHide?: boolean;
    canSort?: boolean;
    getCanSort: () => boolean;
    id: string;
    label: string;
  }>;
  columnVisibility: VisibilityState;
  onVisibleCountChange: (count: number) => void;
  setColumnVisibility: (state: VisibilityState) => void;
  tableId?: string;
}

// Get the appropriate icon for a column based on its type or ID
const getColumnIcon = (column: {
  canSort?: boolean;
  getCanSort?: () => boolean;
  id: string;
  label?: string;
  type?: string;
}) => {
  // Get column type from the column definition
  const columnType = column.type?.toLowerCase();

  // If we have a column type, use its corresponding icon
  if (columnType) {
    switch (columnType) {
      case 'boolean':
        return <ToggleRight className="mr-2 h-4 w-4" />;
      case 'code':
        return <Code className="mr-2 h-4 w-4" />;
      case 'date':
        return <Calendar className="mr-2 h-4 w-4" />;
      case 'json':
        return <Braces className="mr-2 h-4 w-4" />;
      case 'number':
        return <Hash className="mr-2 h-4 w-4" />;
      case 'string':
      case 'text':
        return <Text className="mr-2 h-4 w-4" />;
      case 'tag':
        return <Tag className="mr-2 h-4 w-4" />;
      default:
        return <Text className="mr-2 h-4 w-4" />;
    }
  }

  // Fallback to ID-based icons for legacy or special columns
  switch (column.id.toLowerCase()) {
    case 'comment':
    case 'comments':
      return <FileText className="mr-2 h-4 w-4" />;
    case 'company':
    case 'company_name':
    case 'companyname':
      return <Building className="mr-2 h-4 w-4" />;
    case 'email':
      return <AtSign className="mr-2 h-4 w-4" />;
    case 'first_name':
    case 'firstname':
      return <User className="mr-2 h-4 w-4" />;
    case 'last_name':
    case 'lastname':
      return (
        <User className="mr-2 h-4 w-4" style={{ transform: 'scaleX(-1)' }} />
      );
    default:
      return <FileText className="mr-2 h-4 w-4" />;
  }
};

// Function to move an item in an array from one position to another
function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const newArray = [...array];
  const [removed] = newArray.splice(from, 1);
  newArray.splice(to, 0, removed);
  return newArray;
}

// Composant SortableItem pour rendre un élément triable avec dnd-kit
const SortableItem = ({
  column,
  isVisible,
  onToggle,
  tableId: _tableId,
}: {
  column: {
    canSort?: boolean;
    getCanSort?: () => boolean;
    id: string;
    label?: string;
  };
  isVisible: boolean;
  onToggle: () => void;
  tableId: string;
}) => {
  // Utiliser le hook useSortable de dnd-kit
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: column.id,
  });

  // Style pour l'animation du glisser-déposer
  const style = {
    opacity: isDragging ? 0.5 : 1,
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      className={`group flex items-center py-1.5 ${isDragging ? 'z-10 bg-muted' : ''}`}
      ref={setNodeRef}
      style={style}
    >
      {/* Grip icon rendu draggable */}
      <div
        className="cursor-grab touch-none px-2 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Column icon and name */}
      <Button
        className="h-8 flex-1 justify-start px-0 text-left"
        onClick={onToggle}
        size="sm"
        variant="ghost"
      >
        <div className="flex items-center">
          {getColumnIcon(column as ExtendedColumnDef)}
          <span>{column.label || column.id}</span>
        </div>
      </Button>

      {/* Visibility toggle */}
      <Button
        className="h-8 w-8 p-0 opacity-70 hover:opacity-100"
        onClick={onToggle}
        size="sm"
        variant="ghost"
      >
        {isVisible ? (
          <Eye className="h-4 w-4" />
        ) : (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>
    </div>
  );
};

export function TableColumnsMenu({
  columns,
  columnVisibility: _columnVisibility,
  onVisibleCountChange,
  setColumnVisibility,
  tableId,
}: TableColumnsMenuProps) {
  const { t } = useTranslations();
  const [globalTableId] = useAtom(tableIdAtom);

  // Get the table ID to use
  const effectiveTableId = tableId || globalTableId;

  // Get table configuration
  const { columnsConfig: _columnsConfig, tableConfig: _tableConfig } =
    useTableUIConfig(effectiveTableId);

  // Local state to force re-render when visibility changes
  const [visibilityVersion, setVisibilityVersion] = useState(0);

  // Local state to track active drag operation
  const [_activeDragId, setActiveDragId] = useState<null | string>(null);

  // Use the table URL state hook to access and modify URL parameters
  const { orderParam, setOrderFromUI, setVisibilityFromUI, visibilityParam } =
    useTableUrlState({
      tableId: effectiveTableId,
    });

  // Use the data table hook to get the table instance
  const {
    config,
    state: _state,
    tableInstance: table,
  } = useDataTable({
    tableId: effectiveTableId,
    tableType: effectiveTableId,
  });

  // Get columns that can be hidden (excluding special columns)
  const hideableColumns = useMemo(
    () =>
      columns
        .filter(
          (col) =>
            col.canHide !== false && col.id !== 'select' && col.id !== 'actions'
        )
        .map((col) => {
          // Get column configuration from table config
          const columnConfig = config?.columns?.definitions?.find(
            (def: { id: string; type?: string; header?: string }) =>
              def.id === col.id
          );
          return {
            ...col,
            label: columnConfig?.header || col.id,
            type: columnConfig?.type,
          };
        }),
    [columns, config?.columns?.definitions]
  );

  // Get column objects from table instance
  const _tableColumns = useMemo(() => {
    if (!table) {
      return [];
    }

    return hideableColumns
      .map((col) => {
        const column = table.getColumn(col.id);
        return column ? { column, id: col.id, label: col.label } : null;
      })
      .filter(Boolean);
  }, [table, hideableColumns]);

  // Get current visibility state with proper type
  const currentVisibility = useMemo(
    () => (visibilityParam as VisibilityState) || {},
    [visibilityParam]
  );

  // Get ordered column IDs from URL params
  const orderedColumnIds = useMemo(() => {
    // Use the order from URL params if available
    if (orderParam && orderParam.length > 0) {
      return orderParam as string[];
    }

    // Fallback to table column order if no URL order
    if (table) {
      return table.getAllLeafColumns().map((col) => col.id);
    }

    // Last resort: use original column order
    return hideableColumns.map((col) => col.id);
  }, [orderParam, table, hideableColumns]);

  // Get a map for quick column lookup
  const _columnMap = useMemo(() => {
    const map = new Map();
    for (const col of hideableColumns) {
      map.set(col.id, col);
    }
    return map;
  }, [hideableColumns]);

  // Sort columns according to the order from URL params
  const sortColumnsByOrder = useCallback(
    (columnsToSort: SortableColumn[]) => {
      // Create a map for quick position lookup
      const positionMap = new Map();
      for (const [index, id] of orderedColumnIds.entries()) {
        positionMap.set(id, index);
      }

      // Sort the columns based on their position in orderedColumnIds
      return [...columnsToSort].sort((a, b) => {
        const posA = positionMap.has(a.id)
          ? positionMap.get(a.id)
          : Number.POSITIVE_INFINITY;
        const posB = positionMap.has(b.id)
          ? positionMap.get(b.id)
          : Number.POSITIVE_INFINITY;
        return posA - posB;
      });
    },
    [orderedColumnIds]
  );

  // Split columns into visible and hidden, respecting the order
  const { hiddenColumns, visibleColumns } = useMemo(() => {
    // Filtrer d'abord les colonnes visibles et cachées
    const visible = hideableColumns.filter(
      (col) => currentVisibility[col.id] !== false
    );
    const hidden = hideableColumns.filter(
      (col) => currentVisibility[col.id] === false
    );

    // Puis trier chaque groupe selon l'ordre des colonnes
    return {
      hiddenColumns: sortColumnsByOrder(hidden),
      visibleColumns: sortColumnsByOrder(visible),
    };
  }, [hideableColumns, currentVisibility, sortColumnsByOrder]);

  // Handle direct column order change
  const handleColumnOrderChange = useCallback(
    (newOrder: string[]) => {
      // Update column order in URL state
      setOrderFromUI(newOrder);

      // Update column order directly in table
      if (table) {
        table.setColumnOrder(newOrder);
      }

      // Force re-render
      setVisibilityVersion((v) => v + 1);
    },
    [setOrderFromUI, table]
  );

  // Set up column drag and drop using the useColumnDnd hook
  const {
    DndContext,
    handleDragEnd: dndKitHandleDragEnd,
    handleDragStart: dndKitHandleDragStart,
    horizontalListSortingStrategy,
    sensors,
    SortableContext,
  } = useColumnDnd(effectiveTableId, handleColumnOrderChange);

  // Handler for drag start

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setActiveDragId(event.active.id.toString());

      // Also call the original drag start handler
      if (dndKitHandleDragStart) {
        dndKitHandleDragStart(event);
      }
    },
    [dndKitHandleDragStart]
  );

  // Handler for drag end - update column order
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      // Call the original drag end handler first, which already handles columnOrder updates
      if (dndKitHandleDragEnd) {
        dndKitHandleDragEnd(event);
      }

      if (over && active.id !== over.id) {
        // Use helper functions to simplify logic
        const { isVisibleSection, sourceColumns } = determineDragSection(
          active.id.toString(),
          visibleColumns,
          hiddenColumns
        );

        const oldIndex = sourceColumns.findIndex(
          (col) => col.id === active.id.toString()
        );
        const newIndex = sourceColumns.findIndex(
          (col) => col.id === over.id.toString()
        );

        if (oldIndex !== -1 && newIndex !== -1) {
          const newSourceColumns = arrayMove(sourceColumns, oldIndex, newIndex);
          const newOrder = calculateNewColumnOrder(
            isVisibleSection,
            newSourceColumns,
            visibleColumns,
            hiddenColumns
          );
          handleColumnOrderChange(newOrder);
        }
      }

      // Reset active drag ID
      setActiveDragId(null);
    },
    [
      visibleColumns,
      hiddenColumns,
      dndKitHandleDragEnd,
      handleColumnOrderChange,
    ]
  );

  // Log state changes for debugging - removed empty useEffect

  // Handler for toggling a single column's visibility
  const handleToggleColumnVisibility = useCallback(
    (columnId: string) => {
      // Create a new visibility state starting from the current one
      const newVisibility: VisibilityState = {
        ...((visibilityParam as VisibilityState) || {}),
      };

      // Toggle visibility for the specific column
      if (newVisibility[columnId] === false) {
        delete newVisibility[columnId];
      } else {
        newVisibility[columnId] = false;
      }

      // Update visibility in URL state
      setVisibilityFromUI(newVisibility);

      // Also update through the prop for immediate UI feedback
      setColumnVisibility(newVisibility);

      // Force a re-render of the component
      setVisibilityVersion((v) => v + 1);

      // If we have a table instance, also update it directly
      if (table) {
        table.setColumnVisibility(newVisibility);
      }
    },
    [visibilityParam, setVisibilityFromUI, setColumnVisibility, table]
  );

  // Handle showing all columns
  const handleShowAllColumns = useCallback(() => {
    // Create a new visibility state starting from the current one
    const newVisibility: VisibilityState = {
      ...((visibilityParam as VisibilityState) || {}),
    };

    // Remove hidden state for all hideable columns (making them visible)
    for (const col of hideableColumns) {
      delete newVisibility[col.id];
    }

    // Update visibility in URL state and table
    setVisibilityFromUI(newVisibility);

    // Also update through the prop for immediate UI feedback
    setColumnVisibility(newVisibility);

    // Force a re-render of the component
    setVisibilityVersion((v) => v + 1);

    // If we have a table instance, also update it directly
    if (table) {
      table.setColumnVisibility(newVisibility);
    }
  }, [
    hideableColumns,
    setVisibilityFromUI,
    setColumnVisibility,
    visibilityParam,
    table,
  ]);

  // Handle hiding all columns
  const handleHideAllColumns = useCallback(() => {
    // Create a new visibility state starting from the current one
    const newVisibility: VisibilityState = {
      ...((visibilityParam as VisibilityState) || {}),
    };

    // Set all hideable columns to hidden
    for (const col of hideableColumns) {
      newVisibility[col.id] = false;
    }

    // Preserve visibility of special columns (select, actions)
    if ('select' in newVisibility) {
      newVisibility.select = true;
    }
    if ('actions' in newVisibility) {
      newVisibility.actions = true;
    }

    // Update visibility in URL state
    setVisibilityFromUI(newVisibility);

    // Also update through the prop for immediate UI feedback
    setColumnVisibility(newVisibility);

    // Force a re-render of the component
    setVisibilityVersion((v) => v + 1);

    // If we have a table instance, also update it directly
    if (table) {
      table.setColumnVisibility(newVisibility);
    }
  }, [
    hideableColumns,
    setVisibilityFromUI,
    setColumnVisibility,
    visibilityParam,
    table,
  ]);

  // Calculate button states based on current visibility
  const hasHiddenColumns = useMemo(
    () => hiddenColumns.length > 0,
    [hiddenColumns]
  );
  const hasVisibleColumns = useMemo(
    () => visibleColumns.length > 0,
    [visibleColumns]
  );

  // Update visible count for parent component
  useEffect(() => {
    if (onVisibleCountChange) {
      onVisibleCountChange(visibleColumns.length);
    }
  }, [visibleColumns, onVisibleCountChange]);

  // Skip rendering if no columns can be hidden
  if (hideableColumns.length === 0) {
    return null;
  }

  // Créer les identifiants de colonnes pour le contexte triable
  const visibleColumnIds = visibleColumns.map((col) => col.id);
  const hiddenColumnIds = hiddenColumns.map((col) => col.id);

  return (
    <StackMenuContent className="w-full p-2">
      <DndContext
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        {/* Visible columns section */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="px-2 font-medium text-foreground text-sm">
              {t('columns.visible')}
            </div>
            <div className="relative">
              <Button
                disabled={!hasVisibleColumns}
                onClick={handleHideAllColumns}
                size="sm"
                variant="outline"
              >
                {t('columns.hideAll')}
              </Button>
            </div>
          </div>

          <SortableContext
            items={visibleColumnIds}
            strategy={horizontalListSortingStrategy}
          >
            <div className="space-y-0.5">
              {visibleColumns.map((column) => (
                <SortableItem
                  column={column}
                  isVisible={true}
                  key={`${column.id}-${visibilityVersion}-visible`}
                  onToggle={() => handleToggleColumnVisibility(column.id)}
                  tableId={effectiveTableId}
                />
              ))}
            </div>
          </SortableContext>
        </div>

        {/* Hidden columns section */}
        {hasHiddenColumns && (
          <div className="mt-4 border-gray-800 border-t pt-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="px-2 font-medium text-foreground text-sm">
                {t('columns.hidden')}
              </div>
              <div className="relative">
                <Button
                  onClick={handleShowAllColumns}
                  size="sm"
                  variant="outline"
                >
                  {t('columns.showAll')}
                </Button>
              </div>
            </div>

            <SortableContext
              items={hiddenColumnIds}
              strategy={horizontalListSortingStrategy}
            >
              <div className="space-y-0.5">
                {hiddenColumns.map((column) => (
                  <SortableItem
                    column={column}
                    isVisible={false}
                    key={`${column.id}-${visibilityVersion}-hidden`}
                    onToggle={() => handleToggleColumnVisibility(column.id)}
                    tableId={effectiveTableId}
                  />
                ))}
              </div>
            </SortableContext>
          </div>
        )}
      </DndContext>
    </StackMenuContent>
  );
}
