"use client";

import {
  type KeyboardEvent,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useMemo,
  useState,
} from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TableCatalogueColumnConfig } from "../hooks/use-table-config";
import type { Cell, Row, Table as TanStackTable } from "../tanstack";
import { flexRender } from "../tanstack";
import { useIsMobile } from "../hooks/use-mobile";
import { useLocale } from "../providers/table-provider";
import type { TableListConfig } from "../types/display-types";
import {
  type ListViewSettings,
  resolveListSettings,
  visibleListProperties,
} from "../utils/list-view";
import {
  fieldText,
  TABLE_DENSITY_METRICS,
  type TableDensity,
} from "../utils/table-contracts";
import { TABLE_DENSITY_CLASSES } from "../utils/table-density";
import { shouldActivateCardFromKeyboard } from "../utils/card-interaction";
import {
  moveInOrder,
  REORDER_ROW_ATTRIBUTE,
  reorderRowAt,
} from "../utils/manual-order";
import {
  isSelectionModifiedClick,
  selectRowWithRange,
} from "../utils/row-selection-interaction";
import {
  createGalleryGroups,
  resolveGalleryPropertyColumnIds,
  resolveGalleryTitleColumnId,
} from "./gallery-view";

type ListCell<TData extends Record<string, unknown>> = Cell<TData, unknown>;

interface DataTableListViewProps<TData extends Record<string, unknown>> {
  className?: string;
  columnDefinitions: TableCatalogueColumnConfig[];
  config?: TableListConfig;
  emptyState: ReactNode;
  groupBy?: string;
  groupLabel?: string;
  isRowActive?: (row: Row<TData>) => boolean;
  isRowClickable?: (row: Row<TData>) => boolean;
  onRowClick?: (row: Row<TData>, event: MouseEvent<HTMLElement>) => void;
  /** Line height and padding follow the table density scale. */
  density?: TableDensity;
  /** Present when the view is sorted by its manual order and may be edited. */
  onReorder?: (row: Row<TData>, neighbours: ListNeighbours<TData>) => void;
  canReorderRow?: (row: Row<TData>) => boolean;
  reorderLabel?: string;
  table: TanStackTable<TData>;
}

export interface ListNeighbours<TData extends Record<string, unknown>> {
  previous?: Row<TData>;
  next?: Row<TData>;
}

interface ListReorder {
  draggable: boolean;
  isDragging: boolean;
  isTarget: boolean;
  label?: string;
  onPointerCancel: () => void;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: () => void;
  onMove: (offset: number) => void;
}

interface ListItemProps<TData extends Record<string, unknown>> {
  lineStyle: CSSProperties;
  isActive: boolean;
  isClickable: boolean;
  onRowClick?: (row: Row<TData>, event: MouseEvent<HTMLElement>) => void;
  propertyCells: ListCell<TData>[];
  propertyLabels: Map<string, string>;
  reorder?: ListReorder;
  row: Row<TData>;
  showLabels: boolean;
  settings: Pick<ListViewSettings, "propertyAlign" | "showActions" | "wrap">;
  table: TanStackTable<TData>;
  titleColumnId?: string;
  /** The title as the table shows it, when its column is hidden. */
  titleText?: string;
}

const renderCell = <TData extends Record<string, unknown>>(
  cell: ListCell<TData>
) => flexRender(cell.column.columnDef.cell, cell.getContext());

/** The configured properties, in configured order, without the title or the grouped column. */
export function resolveListPropertyColumnIds({
  columnDefinitions,
  config,
  groupBy,
  titleColumnId,
}: {
  columnDefinitions: TableCatalogueColumnConfig[];
  config?: TableListConfig;
  groupBy?: string;
  titleColumnId?: string;
}): string[] {
  return resolveGalleryPropertyColumnIds({
    columnDefinitions,
    config,
    titleColumnId,
  }).filter((columnId) => columnId !== groupBy);
}

const spacing = (units: number) => `calc(var(--spacing, 0.25rem) * ${units})`;

/** The same metrics as table rows, so both editions size lines identically. */
export function listLineStyle(density: TableDensity): CSSProperties {
  const metrics = TABLE_DENSITY_METRICS[density];
  return {
    minHeight: spacing(metrics.rowHeight),
    paddingBlock: spacing(metrics.paddingY),
    paddingInline: spacing(metrics.paddingX + 1),
  };
}

function ListLineTitle<TData extends Record<string, unknown>>({
  align,
  row,
  titleCell,
  titleText,
  wrap,
}: {
  align: ListViewSettings["propertyAlign"];
  row: Row<TData>;
  titleCell?: ListCell<TData>;
  titleText?: string;
  wrap?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 font-medium text-sm",
        wrap ? "whitespace-normal break-words" : "truncate",
        align === "start" ? "shrink" : "flex-1"
      )}
    >
      {titleCell ? renderCell(titleCell) : titleText || row.id}
    </div>
  );
}

function ListLineProperties<TData extends Record<string, unknown>>({
  align,
  cells,
  labels,
  showLabels,
}: {
  align: ListViewSettings["propertyAlign"];
  cells: ListCell<TData>[];
  labels: Map<string, string>;
  showLabels: boolean;
}) {
  if (cells.length === 0) {
    return null;
  }
  return (
    <dl
      className={cn(
        "flex min-w-0 items-center gap-3 overflow-hidden text-muted-foreground text-xs",
        align === "start" ? "flex-1 justify-start" : "shrink justify-end"
      )}
    >
      {cells.map((cell) => (
        <div className="flex min-w-0 items-center gap-1" key={cell.id}>
          <dt className={showLabels ? "shrink-0" : "sr-only"}>
            {labels.get(cell.column.id) ?? cell.column.id}
          </dt>
          <dd className="min-w-0 truncate">{renderCell(cell)}</dd>
        </div>
      ))}
    </dl>
  );
}

function DataTableListItem<TData extends Record<string, unknown>>({
  lineStyle,
  isActive,
  isClickable,
  onRowClick,
  propertyCells,
  propertyLabels,
  reorder,
  row,
  showLabels,
  settings,
  table,
  titleColumnId,
  titleText,
}: ListItemProps<TData>) {
  const handleReorderKey = (event: KeyboardEvent<HTMLElement>) => {
    if (!(reorder?.draggable && event.altKey)) {
      return false;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
      return false;
    }
    event.preventDefault();
    reorder.onMove(event.key === "ArrowUp" ? -1 : 1);
    return true;
  };
  const cells = row.getVisibleCells() as ListCell<TData>[];
  const selectionCell = cells.find((cell) => cell.column.id === "select");
  const actionsCell = cells.find((cell) => cell.column.id === "actions");
  const titleCell = cells.find((cell) => cell.column.id === titleColumnId);
  const shouldSelect = (event: MouseEvent<HTMLElement>) =>
    Boolean(selectionCell) &&
    row.getCanSelect() &&
    isSelectionModifiedClick(event) &&
    !(
      event.target instanceof Element &&
      event.target.closest('[data-column-id="select"]')
    );
  const handleSelectionClick = (event: MouseEvent<HTMLElement>) => {
    if (!shouldSelect(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    selectRowWithRange({
      element: event.currentTarget,
      isSelected: event.shiftKey || !row.getIsSelected(),
      row,
      shiftKey: event.shiftKey,
      table,
    });
  };

  return (
    <li
      className={cn(
        "border-b last:border-b-0",
        (isActive || row.getIsSelected()) && "bg-primary/5",
        reorder?.isDragging && "opacity-50",
        reorder?.isTarget && "shadow-[inset_0_2px_0_0_var(--primary)]"
      )}
      data-active={isActive ? "true" : undefined}
      data-row-id={row.id}
      {...(reorder ? { [REORDER_ROW_ATTRIBUTE]: row.id } : {})}
    >
      {/* biome-ignore lint/a11y: a clickable line keeps nested selection/actions valid, takes the button role and provides keyboard activation. */}
      <div
        className={cn(
          "flex items-center gap-3",
          isClickable && "cursor-pointer hover:bg-muted/40"
        )}
        onClick={isClickable ? (event) => onRowClick?.(row, event) : undefined}
        onClickCapture={handleSelectionClick}
        onKeyDown={
          isClickable || reorder?.draggable
            ? (event) => {
                if (handleReorderKey(event)) {
                  return;
                }
                if (isClickable && shouldActivateCardFromKeyboard(event)) {
                  event.preventDefault();
                  event.currentTarget.click();
                }
              }
            : undefined
        }
        onMouseDownCapture={(event) => {
          if (shouldSelect(event)) {
            event.preventDefault();
          }
        }}
        role={isClickable ? "button" : undefined}
        style={lineStyle}
        tabIndex={isClickable || reorder?.draggable ? 0 : undefined}
      >
        {reorder?.draggable ? (
          <button
            aria-label={reorder.label}
            className="-ml-1 shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
            onClick={(event) => event.stopPropagation()}
            onPointerCancel={reorder.onPointerCancel}
            onPointerDown={reorder.onPointerDown}
            onPointerMove={reorder.onPointerMove}
            onPointerUp={reorder.onPointerUp}
            title={reorder.label}
            type="button"
          >
            <GripVertical aria-hidden="true" className="size-4" />
          </button>
        ) : null}
        {selectionCell ? (
          <div className="shrink-0" data-column-id="select">
            {renderCell(selectionCell)}
          </div>
        ) : null}
        <ListLineTitle
          align={settings.propertyAlign}
          row={row}
          titleCell={titleCell}
          titleText={titleText}
          wrap={settings.wrap}
        />
        <ListLineProperties
          align={settings.propertyAlign}
          cells={propertyCells}
          labels={propertyLabels}
          showLabels={showLabels}
        />
        {actionsCell && settings.showActions ? (
          <div className="shrink-0" data-column-id="actions">
            {renderCell(actionsCell)}
          </div>
        ) : null}
      </div>
    </li>
  );
}

/** Rows as compact lines: a title, then the chosen properties. */
export function DataTableListView<TData extends Record<string, unknown>>({
  className,
  columnDefinitions,
  config,
  emptyState,
  groupBy = "",
  groupLabel,
  isRowActive,
  isRowClickable,
  onRowClick,
  onReorder,
  canReorderRow,
  reorderLabel,
  density = "medium",
  table,
}: DataTableListViewProps<TData>) {
  const lineStyle = listLineStyle(density);
  const hasTableGrouping = table.store.state.grouping.length > 0;
  const loadedRows = (
    hasTableGrouping
      ? table.getPreGroupedRowModel().rows
      : table.getRowModel().rows
  ) as Row<TData>[];
  // A move shows at once; the next server result replaces it.
  const [pending, setPending] = useState<{
    ids: string[];
    rows: Row<TData>[];
  } | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  // A pending order only applies to the rows it was made from.
  const pendingOrder = pending?.rows === loadedRows ? pending.ids : null;
  const setPendingOrder = (ids: string[]) =>
    setPending({ ids, rows: loadedRows });
  const rows = useMemo(() => {
    if (!pendingOrder) {
      return loadedRows;
    }
    const position = new Map(pendingOrder.map((id, index) => [id, index]));
    return [...loadedRows].sort(
      (left, right) =>
        (position.get(left.id) ?? 0) - (position.get(right.id) ?? 0)
    );
  }, [loadedRows, pendingOrder]);
  const titleColumnId = resolveGalleryTitleColumnId({
    columnDefinitions,
    config,
  });
  const settings = resolveListSettings(undefined, config);
  const isMobile = useIsMobile();
  const propertyColumnIds = resolveListPropertyColumnIds({
    columnDefinitions,
    config,
    groupBy,
    titleColumnId,
  });
  const shownPropertyIds = visibleListProperties(
    propertyColumnIds,
    settings,
    isMobile
  );
  const propertyLabels = useMemo(
    () =>
      new Map(
        columnDefinitions.map((definition) => [
          definition.id,
          definition.header ?? definition.id,
        ])
      ),
    [columnDefinitions]
  );
  const locale = useLocale();
  const titleColumn = columnDefinitions.find(
    (definition) => definition.id === titleColumnId
  );
  const groups = useMemo(() => {
    const groupColumn = columnDefinitions.find(
      (definition) => definition.id === groupBy
    );
    return createGalleryGroups({
      groupBy,
      labelOf: (value) => fieldText(value, groupColumn, locale),
      rows,
    });
  }, [columnDefinitions, groupBy, locale, rows]);

  if (rows.length === 0) {
    return emptyState ? (
      <div className="rounded-md border">{emptyState}</div>
    ) : null;
  }

  const groupOf = (row: Row<TData>) =>
    groups.find((group) => group.rows.some((item) => item.id === row.id));
  const moveRow = (row: Row<TData>, toIndexInGroup: number) => {
    const group = groupOf(row);
    if (!(group && onReorder)) {
      return;
    }
    const moved = moveInOrder(
      group.rows.map((item) => item.id),
      row.id,
      toIndexInGroup
    );
    if (!moved) {
      return;
    }
    const byId = new Map(rows.map((item) => [item.id, item]));
    const groupIds = new Set(moved.ids);
    const others = rows.map((item) => item.id).filter((id) => !groupIds.has(id));
    const firstIndex = rows.findIndex((item) => groupIds.has(item.id));
    others.splice(Math.max(0, firstIndex), 0, ...moved.ids);
    setPendingOrder(others);
    onReorder(row, {
      previous: moved.previousId ? byId.get(moved.previousId) : undefined,
      next: moved.nextId ? byId.get(moved.nextId) : undefined,
    });
  };
  const reorderFor = (row: Row<TData>): ListReorder | undefined => {
    if (!onReorder) {
      return;
    }
    const group = groupOf(row);
    const index = group?.rows.findIndex((item) => item.id === row.id) ?? -1;
    return {
      draggable: canReorderRow?.(row) ?? true,
      isDragging: draggedId === row.id,
      isTarget: Boolean(draggedId) && targetId === row.id && draggedId !== row.id,
      label: reorderLabel,
      onPointerDown: (event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setDraggedId(row.id);
      },
      onPointerMove: (event) => {
        if (draggedId !== row.id) {
          return;
        }
        const id = reorderRowAt(event.clientX, event.clientY);
        const target = rows.find((item) => item.id === id);
        // Moves stay within a group: the manual order never edits the grouped value.
        setTargetId(target && groupOf(target) === group ? target.id : null);
      },
      onPointerUp: () => {
        const target = group?.rows.findIndex((item) => item.id === targetId);
        setDraggedId(null);
        setTargetId(null);
        if (draggedId === row.id && target !== undefined && target >= 0) {
          moveRow(row, target);
        }
      },
      onPointerCancel: () => {
        setDraggedId(null);
        setTargetId(null);
      },
      onMove: (offset) => moveRow(row, index + offset),
    };
  };

  const renderRow = (row: Row<TData>) => {
    const cellById = new Map(
      (row.getVisibleCells() as ListCell<TData>[]).map((cell) => [
        cell.column.id,
        cell,
      ])
    );
    return (
      <DataTableListItem
        lineStyle={lineStyle}
        isActive={isRowActive?.(row) ?? false}
        isClickable={isRowClickable?.(row) ?? false}
        key={row.id}
        onRowClick={onRowClick}
        propertyCells={shownPropertyIds.flatMap((id) => {
          const cell = cellById.get(id);
          return cell ? [cell] : [];
        })}
        propertyLabels={propertyLabels}
        reorder={reorderFor(row)}
        row={row}
        settings={settings}
        showLabels={settings.showCardLabels}
        table={table}
        titleColumnId={titleColumnId}
        titleText={
          titleColumnId
            ? fieldText(
                row.original[titleColumnId],
                titleColumn,
                locale,
                row.original
              )
            : undefined
        }
      />
    );
  };

  return (
    <div
      className={cn(
        "rounded-md border bg-background",
        TABLE_DENSITY_CLASSES[density].controls,
        className
      )}
    >
      {groupBy ? (
        groups.map((group) => (
          <section className="border-b last:border-b-0" key={group.id}>
            <div className="flex items-center justify-between gap-3 bg-muted/30 px-3 py-2">
              <h3 className="min-w-0 truncate font-medium text-sm">
                {groupLabel ? (
                  <span className="text-muted-foreground">{groupLabel}: </span>
                ) : null}
                {group.label}
              </h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                {group.rows.length}
              </span>
            </div>
            <ul>{group.rows.map(renderRow)}</ul>
          </section>
        ))
      ) : (
        <ul>{rows.map(renderRow)}</ul>
      )}
    </div>
  );
}
