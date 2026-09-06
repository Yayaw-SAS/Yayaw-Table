"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Column, Table } from "@/components/ui/yayaw-table/tanstack";
import { useAtomValue } from "jotai";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/src/components/ui/button";

import { columnDragEnabledAtom } from "../../../atoms/table-atoms";
import { useTableConfig } from "../../../hooks/use-table-config";
import { useTableTranslations } from "../../../hooks/use-table-translations";
import { resizedColumnSizeFromKey } from "../../../utils/table-contracts";

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

function ColumnResizeHandle<TData, TValue>({
  column,
  label,
  resizeHandler,
  table,
}: {
  column: Column<TData, TValue>;
  label: string;
  resizeHandler: (event: unknown) => void;
  table: Table<TData>;
}) {
  const minSize = column.columnDef.minSize ?? 20;
  const maxSize = column.columnDef.maxSize ?? Number.MAX_SAFE_INTEGER;
  return (
    <hr
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemax={maxSize}
      aria-valuemin={minSize}
      aria-valuenow={column.getSize()}
      className={cn(
        "absolute inset-y-0 right-0 z-20 m-0 h-auto w-2 cursor-col-resize touch-none border-0 p-0 outline-none",
        "after:absolute after:inset-y-1 after:right-0 after:w-0.5 after:bg-border",
        "hover:after:bg-primary focus-visible:after:bg-primary",
        column.getIsResizing() && "after:bg-primary"
      )}
      data-column-resize-handle={column.id}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => {
        event.stopPropagation();
        column.resetSize();
      }}
      onKeyDown={(event) => {
        const nextSize = resizedColumnSizeFromKey({
          key: event.key,
          maxSize,
          minSize,
          size: column.getSize(),
        });
        if (nextSize === undefined) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        table.setColumnSizing((current) => ({
          ...current,
          [column.id]: nextSize,
        }));
      }}
      onMouseDown={(event) => {
        event.stopPropagation();
        resizeHandler(event);
      }}
      onTouchStart={(event) => {
        event.stopPropagation();
        resizeHandler(event);
      }}
      tabIndex={0}
    />
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

  /** TanStack pointer/touch resize handler from the rendered header. */
  resizeHandler?: (event: unknown) => void;

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
  resizeHandler,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const tableInstance = table;
  const _canSort = column.getCanSort();
  const isDragEnabled = useAtomValue(columnDragEnabledAtom(tableId));
  const { config } = useTableConfig(tableId);
  const translations = useTableTranslations(tableId);
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
  const def = column.columnDef as { type?: string; meta?: { columnType?: string } };
  const isNumberColumn =
    def.type === "number" || def.meta?.columnType === "number";
  const sortDirection = column.getIsSorted();

  // Memoize selectionHeader component to prevent recreating on each render
  const selectionHeaderContent = useMemo(() => {
    if (isSelectionColumn) {
      return tableInstance ? (
        <SelectionHeader<TData, TValue>
          column={column}
          table={tableInstance}
        />
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

  const resizeHandleContent =
    tableInstance && resizeHandler && column.getCanResize() ? (
      <ColumnResizeHandle
        column={column}
        label={`${translations.columnResize}: ${title}`}
        resizeHandler={resizeHandler}
        table={tableInstance}
      />
    ) : null;

  // Memoize regularHeaderContent component to prevent recreating on each render
  const regularHeaderContent = useMemo(() => {
    if (isSelectionColumn || isActionsColumn) {
      return null;
    }
    const SortIcon = sortDirection === "desc" ? ArrowDown : ArrowUp;
    const content = tableInstance ? (
      <div
        className={cn(
          "flex h-full w-full min-w-0 items-center px-2",
          isNumberColumn && "justify-end"
        )}
      >
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 self-stretch overflow-hidden",
            isNumberColumn && "justify-end"
          )}
        >
          <ColumnMenu
            column={column}
            table={tableInstance}
            tableId={tableId}
          >
            <div className="flex w-full min-w-0 cursor-pointer items-center gap-2">
              <span className="truncate">{title}</span>
              {sortDirection && (
                <span className="shrink-0">
                  <SortIcon className="h-4 w-4" />
                </span>
              )}
            </div>
          </ColumnMenu>
        </div>
        {isHydrated && dndFeatureEnabled && isDragEnabled && (
          <div
            className="ml-2 shrink-0 cursor-grab touch-none active:cursor-grabbing"
            {...listeners}
          >
            <DragHandleButton />
          </div>
        )}
      </div>
    ) : (
      <div
        className={cn(
          "flex w-full min-w-0 items-center gap-2",
          isNumberColumn && "justify-end"
        )}
      >
        <span className="truncate">{title}</span>
        {isHydrated && dndFeatureEnabled && isDragEnabled && (
          <div
            className="ml-auto shrink-0 cursor-grab touch-none active:cursor-grabbing"
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
          "absolute inset-0 flex overflow-hidden rounded-none transition-colors hover:bg-accent hover:text-accent-foreground",
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
            "relative flex h-full min-h-0 min-w-0 flex-1 items-center gap-2",
            isNumberColumn && "justify-end"
          )}
        >
          {content}
          {resizeHandleContent}
        </div>
      </div>
    );
  }, [
    isSelectionColumn,
    isActionsColumn,
    isNumberColumn,
    isDragEnabled,
    dndFeatureEnabled,
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
    resizeHandleContent,
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

export const DataTableColumnHeader = DataTableColumnHeaderBase;

export type { DataTableColumnHeaderProps };
