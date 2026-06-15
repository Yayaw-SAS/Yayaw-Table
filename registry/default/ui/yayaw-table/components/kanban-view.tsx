"use client";

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Row, Table as TanStackTable } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { GripVertical } from "lucide-react";
import { type MouseEvent, type ReactNode, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TableCatalogueColumnConfig } from "../hooks/use-table-config";
import type {
  TableKanbanConfig,
  TableKanbanGroupConfig,
} from "../types/display-types";

const SYSTEM_COLUMN_IDS = new Set(["actions", "select"]);
const EMPTY_GROUP_VALUE = "";
const EMPTY_GROUP_LABEL = "No value";

export interface KanbanGroup {
  id: string;
  label: string;
  value: string;
}

interface DataTableKanbanViewProps<TData extends Record<string, unknown>> {
  canDragUpdate: boolean;
  cardColumnIds?: string[];
  className?: string;
  columnDefinitions: TableCatalogueColumnConfig[];
  config?: TableKanbanConfig;
  emptyState: ReactNode;
  groupBy: string;
  isRowActive?: (row: Row<TData>) => boolean;
  isRowClickable?: (row: Row<TData>) => boolean;
  onMoveRow?: (row: Row<TData>, nextValue: string) => Promise<void> | void;
  onRowClick?: (row: Row<TData>, event: MouseEvent<HTMLElement>) => void;
  table: TanStackTable<TData>;
  titleColumnId?: string;
}

interface KanbanCardProps<TData extends Record<string, unknown>> {
  canDragUpdate: boolean;
  isActive: boolean;
  isClickable: boolean;
  propertyCells: ReturnType<Row<TData>["getVisibleCells"]>;
  propertyLabels: Map<string, string>;
  row: Row<TData>;
  selectionCell?: ReturnType<Row<TData>["getVisibleCells"]>[number];
  titleCell?: ReturnType<Row<TData>["getVisibleCells"]>[number];
  actionsCell?: ReturnType<Row<TData>["getVisibleCells"]>[number];
  onRowClick?: (row: Row<TData>, event: MouseEvent<HTMLElement>) => void;
}

interface KanbanColumnProps<TData extends Record<string, unknown>> {
  canDragUpdate: boolean;
  group: KanbanGroup;
  children: ReactNode;
  rows: Row<TData>[];
}

function getStringValue(value: unknown): string {
  if (value === null || value === undefined) {
    return EMPTY_GROUP_VALUE;
  }

  return String(value);
}

function getColumnLabel(
  columnDefinitions: TableCatalogueColumnConfig[],
  columnId: string
): string {
  return (
    columnDefinitions.find((definition) => definition.id === columnId)
      ?.header ?? columnId
  );
}

export function createConfiguredGroups(
  groups: TableKanbanGroupConfig[] | undefined
): KanbanGroup[] {
  if (!groups?.length) {
    return [];
  }

  return groups.map((group) => {
    const value = getStringValue(group.value);
    return {
      id: `kanban-group-${value || "empty"}`,
      label: group.label ?? (value || EMPTY_GROUP_LABEL),
      value,
    };
  });
}

export function shouldUseConfiguredKanbanGroups({
  configuredGroupBy,
  groupBy,
}: {
  configuredGroupBy?: string;
  groupBy: string;
}): boolean {
  return Boolean(configuredGroupBy) && configuredGroupBy === groupBy;
}

export function createKanbanGroups<TData extends Record<string, unknown>>({
  configuredGroups,
  groupBy,
  rows,
}: {
  configuredGroups: KanbanGroup[];
  groupBy: string;
  rows: Row<TData>[];
}): KanbanGroup[] {
  const groups = [...configuredGroups];
  const knownValues = new Set(groups.map((group) => group.value));

  for (const row of rows) {
    const value = getStringValue(row.original[groupBy]);
    if (knownValues.has(value)) {
      continue;
    }

    knownValues.add(value);
    groups.push({
      id: `kanban-group-${value || "empty"}`,
      label: value || EMPTY_GROUP_LABEL,
      value,
    });
  }

  return groups;
}

function getDefaultTitleColumnId<TData extends Record<string, unknown>>(
  table: TanStackTable<TData>
): string | undefined {
  return table
    .getVisibleLeafColumns()
    .find((column) => !SYSTEM_COLUMN_IDS.has(column.id))?.id;
}

function getCardPropertyCells<TData extends Record<string, unknown>>({
  cardColumnIds,
  groupBy,
  row,
  titleColumnId,
}: {
  cardColumnIds?: string[];
  groupBy: string;
  row: Row<TData>;
  titleColumnId?: string;
}): ReturnType<Row<TData>["getVisibleCells"]> {
  const cells = row.getVisibleCells().filter((cell) => {
    return (
      !SYSTEM_COLUMN_IDS.has(cell.column.id) &&
      cell.column.id !== titleColumnId &&
      cell.column.id !== groupBy
    );
  });

  if (!cardColumnIds?.length) {
    return cells;
  }

  const cellByColumnId = new Map(cells.map((cell) => [cell.column.id, cell]));
  return cardColumnIds
    .map((columnId) => cellByColumnId.get(columnId))
    .filter(Boolean) as ReturnType<Row<TData>["getVisibleCells"]>;
}

function KanbanColumn<TData extends Record<string, unknown>>({
  canDragUpdate,
  children,
  group,
  rows,
}: KanbanColumnProps<TData>) {
  const { isOver, setNodeRef } = useDroppable({
    data: { value: group.value },
    disabled: !canDragUpdate,
    id: group.id,
  });

  return (
    <section className="flex min-h-[28rem] w-[18rem] shrink-0 flex-col rounded-md border bg-muted/20">
      <header className="flex h-11 items-center justify-between border-b px-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium text-sm">{group.label}</h3>
        </div>
        <span className="rounded-full bg-background px-2 py-0.5 text-muted-foreground text-xs">
          {rows.length}
        </span>
      </header>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2",
          isOver && "bg-primary/5"
        )}
        ref={setNodeRef}
      >
        {children}
      </div>
    </section>
  );
}

function KanbanCard<TData extends Record<string, unknown>>({
  actionsCell,
  canDragUpdate,
  isActive,
  isClickable,
  onRowClick,
  propertyCells,
  propertyLabels,
  row,
  selectionCell,
  titleCell,
}: KanbanCardProps<TData>) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      data: { rowId: row.id },
      disabled: !canDragUpdate,
      id: row.id,
    });
  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const cardClassName = cn(
    "group rounded-md border bg-background p-2 shadow-xs transition",
    isClickable && "hover:border-primary/40 hover:bg-muted/20",
    isActive && "border-primary/50 shadow-[inset_2px_0_0_hsl(var(--primary))]",
    isDragging && "opacity-60"
  );
  const titleContent = titleCell
    ? flexRender(titleCell.column.columnDef.cell, titleCell.getContext())
    : row.id;
  const cardContent = (
    <>
      <div className="flex items-start gap-2">
        {selectionCell ? (
          <div className="mt-0.5 shrink-0" data-column-id="select">
            {flexRender(
              selectionCell.column.columnDef.cell,
              selectionCell.getContext()
            )}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          {isClickable ? (
            <button
              className="line-clamp-2 w-full text-left font-medium text-sm"
              onClick={(event) => onRowClick?.(row, event)}
              type="button"
            >
              {titleContent}
            </button>
          ) : (
            <div className="line-clamp-2 font-medium text-sm">
              {titleContent}
            </div>
          )}
        </div>
        {actionsCell ? (
          <div className="shrink-0" data-column-id="actions">
            {flexRender(
              actionsCell.column.columnDef.cell,
              actionsCell.getContext()
            )}
          </div>
        ) : null}
        {canDragUpdate ? (
          <Button
            aria-label="Drag card"
            className="h-7 w-7 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
            size="icon-sm"
            type="button"
            variant="ghost"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>

      {propertyCells.length > 0 ? (
        <dl className="mt-3 space-y-2">
          {propertyCells.map((cell) => (
            <div
              className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2"
              key={cell.id}
            >
              <dt className="truncate text-muted-foreground text-xs">
                {propertyLabels.get(cell.column.id) ?? cell.column.id}
              </dt>
              <dd className="min-w-0 truncate text-xs">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </>
  );

  return (
    <div
      className={cardClassName}
      data-active={isActive ? "true" : undefined}
      ref={setNodeRef}
      style={style}
    >
      {cardContent}
    </div>
  );
}

export function DataTableKanbanView<TData extends Record<string, unknown>>({
  canDragUpdate,
  cardColumnIds,
  className,
  columnDefinitions,
  config,
  emptyState,
  groupBy,
  isRowActive,
  isRowClickable,
  onMoveRow,
  onRowClick,
  table,
  titleColumnId,
}: DataTableKanbanViewProps<TData>) {
  const rows = table.getRowModel().rows as Row<TData>[];
  const shouldUseConfiguredGroups = shouldUseConfiguredKanbanGroups({
    configuredGroupBy: config?.groupBy,
    groupBy,
  });
  const configuredGroups = useMemo(
    () =>
      createConfiguredGroups(
        shouldUseConfiguredGroups ? config?.groups : undefined
      ),
    [config?.groups, shouldUseConfiguredGroups]
  );
  const groups = useMemo(
    () => createKanbanGroups({ configuredGroups, groupBy, rows }),
    [configuredGroups, groupBy, rows]
  );
  const rowsByGroup = useMemo(() => {
    const next = new Map<string, Row<TData>[]>();
    for (const group of groups) {
      next.set(group.value, []);
    }
    for (const row of rows) {
      const value = getStringValue(row.original[groupBy]);
      const groupRows = next.get(value) ?? [];
      groupRows.push(row);
      next.set(value, groupRows);
    }
    return next;
  }, [groupBy, groups, rows]);
  const resolvedTitleColumnId =
    titleColumnId ?? config?.titleColumn ?? getDefaultTitleColumnId(table);
  const propertyLabels = useMemo(() => {
    return new Map(
      columnDefinitions.map((definition) => [
        definition.id,
        getColumnLabel(columnDefinitions, definition.id),
      ])
    );
  }, [columnDefinitions]);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const rowId = String(event.active.id);
    const nextValue = event.over?.data.current?.value;
    if (typeof nextValue !== "string") {
      return;
    }

    const row = rows.find((candidate) => candidate.id === rowId);
    if (!row || getStringValue(row.original[groupBy]) === nextValue) {
      return;
    }

    onMoveRow?.(row, nextValue);
  };

  if (rows.length === 0) {
    return <div className="rounded-md border">{emptyState}</div>;
  }

  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <div
        className={cn(
          "overflow-x-auto rounded-md border bg-background",
          className
        )}
      >
        <div className="flex min-h-[30rem] gap-3 p-3">
          {groups.map((group) => {
            const groupRows = rowsByGroup.get(group.value) ?? [];
            return (
              <KanbanColumn
                canDragUpdate={canDragUpdate}
                group={group}
                key={group.id}
                rows={groupRows}
              >
                {groupRows.map((row) => {
                  const cells = row.getVisibleCells();
                  const titleCell = cells.find(
                    (cell) => cell.column.id === resolvedTitleColumnId
                  );
                  const selectionCell = cells.find(
                    (cell) => cell.column.id === "select"
                  );
                  const actionsCell = cells.find(
                    (cell) => cell.column.id === "actions"
                  );

                  return (
                    <KanbanCard
                      actionsCell={actionsCell}
                      canDragUpdate={canDragUpdate}
                      isActive={isRowActive?.(row) ?? false}
                      isClickable={isRowClickable?.(row) ?? false}
                      key={row.id}
                      onRowClick={onRowClick}
                      propertyCells={getCardPropertyCells({
                        cardColumnIds,
                        groupBy,
                        row,
                        titleColumnId: resolvedTitleColumnId,
                      })}
                      propertyLabels={propertyLabels}
                      row={row}
                      selectionCell={selectionCell}
                      titleCell={titleCell}
                    />
                  );
                })}
              </KanbanColumn>
            );
          })}
        </div>
      </div>
    </DndContext>
  );
}
