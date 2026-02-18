"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Column, Table } from "@tanstack/react-table";
import { useAtomValue } from "jotai";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { columnDragEnabledAtom } from "../../../atoms/table-atoms";
import { useTableConfig } from "../../../hooks/use-table-config";

import { ActionsHeader } from "./actions-header";
import { ColumnMenu } from "./column-menu";
import { SelectionHeader } from "./selection-header";

// Set to true to enable debug logging
const _DEBUG = false;

function DragHandleButton() {
  return (
    <Button
      aria-label="Drag to reorder column"
      className="size-7 cursor-grab border-0 bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground active:cursor-grabbing"
      size="icon"
      type="button"
      variant="ghost"
    >
      <GripVertical
        className="h-4 w-4 opacity-60 hover:opacity-100"
        strokeWidth={2}
      />
    </Button>
  );
}

interface DataTableColumnHeaderProps<TData, TValue> {
  /**
   * Additional CSS classes for the header
   */
  className?: string;

  /**
   * The column to render the header for
   */
  column: Column<TData, TValue>;

  /**
   * The table instance
   */
  table?: Table<TData>;

  /**
   * The ID of the table this column belongs to
   */
  tableId?: string;

  /**
   * The title to display in the header
   */
  title: string;
}

/**
 * Component for rendering a column header with sorting and filtering controls
 */
function DataTableColumnHeaderBase<TData, TValue>({
  className,
  column,
  table,
  tableId = "default-table", // Default value if not provided
  title,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const tableInstance = table;
  const _canSort = column.getCanSort();
  const isDragEnabled = useAtomValue(columnDragEnabledAtom(tableId));
  const { config } = useTableConfig(tableId);
  const dndFeatureEnabled = config?.table?.enableColumnDnd !== false;

  const {
    attributes,
    isDragging,
    isOver,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    disabled: !(isDragEnabled && dndFeatureEnabled),
    id: column.id,
  });

  // Ensure DnD attributes are attached only after hydration to avoid mismatches
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const style = useMemo(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
      // Force header cell to follow its column when pinned/reordered
      willChange: "transform",
    }),
    [transform, transition]
  );

  const isSelectionColumn = column.id === "select";
  const isActionsColumn = column.id === "actions";
  const def = column.columnDef as {
    type?: string;
    meta?: { columnType?: string };
  };
  const isNumberColumn =
    def.type === "number" || def.meta?.columnType === "number";
  const sortDirection = column.getIsSorted();

  // Memoize selectionHeader component to prevent recreating on each render
  const selectionHeaderContent = useMemo(() => {
    if (isSelectionColumn) {
      return tableInstance ? (
        <SelectionHeader<TData> column={column} table={tableInstance} />
      ) : (
        <div className="flex h-4 w-4 items-center justify-center" />
      );
    }
    return null;
  }, [isSelectionColumn, tableInstance, column]);

  // Memoize actionsHeader component to prevent recreating on each render
  const actionsHeaderContent = useMemo(() => {
    if (isActionsColumn) {
      return <ActionsHeader title={title} />;
    }
    return null;
  }, [isActionsColumn, title]);

  // Memoize regularHeaderContent component to prevent recreating on each render
  const regularHeaderContent = useMemo(() => {
    if (isSelectionColumn || isActionsColumn) {
      return null;
    }
    const SortIcon = sortDirection === "desc" ? ArrowDown : ArrowUp;
    const content = tableInstance ? (
      <div
        className={cn(
          "flex h-full w-full items-center",
          isNumberColumn && "justify-end"
        )}
      >
        <div
          className={cn(
            "flex min-h-0 flex-1 self-stretch",
            isNumberColumn && "justify-end"
          )}
        >
          <ColumnMenu column={column} table={tableInstance} tableId={tableId}>
            <div className="flex w-full cursor-pointer items-center gap-2">
              <span>{title}</span>
              {sortDirection && (
                <span className="ml-2">
                  <SortIcon className="h-4 w-4" />
                </span>
              )}
            </div>
          </ColumnMenu>
        </div>
        {isHydrated && isDragEnabled && (
          <div
            className="ml-2 cursor-grab touch-none active:cursor-grabbing"
            {...listeners}
          >
            <DragHandleButton />
          </div>
        )}
      </div>
    ) : (
      <div
        className={cn(
          "flex w-full items-center gap-2",
          isNumberColumn && "justify-end"
        )}
      >
        <span>{title}</span>
        {isHydrated && isDragEnabled && (
          <div
            className="ml-auto cursor-grab touch-none active:cursor-grabbing"
            {...listeners}
          >
            <DragHandleButton />
          </div>
        )}
      </div>
    );
    return (
      <div
        className={cn(
          "absolute inset-0 flex rounded-none transition-colors hover:bg-accent hover:text-accent-foreground",
          isOver && "bg-accent",
          isDragging && "opacity-50",
          className
        )}
        ref={isHydrated ? setNodeRef : undefined}
        style={style}
        suppressHydrationWarning
        {...(isHydrated ? attributes : {})}
      >
        <div
          className={cn(
            "relative flex h-full min-h-0 flex-1 items-center gap-2",
            isNumberColumn && "justify-end"
          )}
        >
          {content}
        </div>
      </div>
    );
  }, [
    isSelectionColumn,
    isActionsColumn,
    isNumberColumn,
    isDragEnabled,
    isDragging,
    isOver,
    setNodeRef,
    attributes,
    listeners,
    style,
    column,
    tableInstance,
    tableId,
    title,
    className,
    sortDirection,
    isHydrated,
  ]);

  // Create the header content without using TableHead
  // This allows the component to be used inside other header cells without nesting issues
  if (isSelectionColumn) {
    return selectionHeaderContent;
  }

  if (isActionsColumn) {
    return actionsHeaderContent;
  }

  return regularHeaderContent;
}

// Create a memoized version with a more effective memo implementation
export const DataTableColumnHeader = memo(
  DataTableColumnHeaderBase,
  (prevProps, nextProps) => {
    // Only re-render if these props change
    return (
      prevProps.column === nextProps.column &&
      prevProps.tableId === nextProps.tableId &&
      prevProps.title === nextProps.title &&
      prevProps.className === nextProps.className &&
      prevProps.table === nextProps.table
    );
  }
) as typeof DataTableColumnHeaderBase;

export type { DataTableColumnHeaderProps };
