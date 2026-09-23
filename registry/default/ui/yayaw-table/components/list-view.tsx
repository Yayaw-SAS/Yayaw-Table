"use client";

import { type MouseEvent, type ReactNode, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { TableCatalogueColumnConfig } from "../hooks/use-table-config";
import type { Cell, Row, Table as TanStackTable } from "../tanstack";
import { flexRender } from "../tanstack";
import type { TableListConfig } from "../types/display-types";
import { shouldActivateCardFromKeyboard } from "../utils/card-interaction";
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
  table: TanStackTable<TData>;
}

interface ListItemProps<TData extends Record<string, unknown>> {
  isActive: boolean;
  isClickable: boolean;
  onRowClick?: (row: Row<TData>, event: MouseEvent<HTMLElement>) => void;
  propertyCells: ListCell<TData>[];
  propertyLabels: Map<string, string>;
  row: Row<TData>;
  showLabels: boolean;
  table: TanStackTable<TData>;
  titleColumnId?: string;
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

function DataTableListItem<TData extends Record<string, unknown>>({
  isActive,
  isClickable,
  onRowClick,
  propertyCells,
  propertyLabels,
  row,
  showLabels,
  table,
  titleColumnId,
}: ListItemProps<TData>) {
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
        (isActive || row.getIsSelected()) && "bg-primary/5"
      )}
      data-active={isActive ? "true" : undefined}
    >
      {/* biome-ignore lint/a11y: a clickable line keeps nested selection/actions valid, takes the button role and provides keyboard activation. */}
      <div
        className={cn(
          "flex min-h-10 items-center gap-3 px-3 py-1.5",
          isClickable && "cursor-pointer hover:bg-muted/40"
        )}
        onClick={isClickable ? (event) => onRowClick?.(row, event) : undefined}
        onClickCapture={handleSelectionClick}
        onKeyDown={
          isClickable
            ? (event) => {
                if (shouldActivateCardFromKeyboard(event)) {
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
        tabIndex={isClickable ? 0 : undefined}
      >
        {selectionCell ? (
          <div className="shrink-0" data-column-id="select">
            {renderCell(selectionCell)}
          </div>
        ) : null}
        <div className="min-w-0 flex-1 truncate font-medium text-sm">
          {titleCell ? renderCell(titleCell) : row.id}
        </div>
        {propertyCells.length > 0 ? (
          <dl className="flex min-w-0 shrink items-center justify-end gap-3 overflow-hidden text-muted-foreground text-xs">
            {propertyCells.map((cell) => (
              <div className="flex min-w-0 items-center gap-1" key={cell.id}>
                <dt className={showLabels ? "shrink-0" : "sr-only"}>
                  {propertyLabels.get(cell.column.id) ?? cell.column.id}
                </dt>
                <dd className="min-w-0 truncate">{renderCell(cell)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {actionsCell ? (
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
  table,
}: DataTableListViewProps<TData>) {
  const hasTableGrouping = table.store.state.grouping.length > 0;
  const rows = (
    hasTableGrouping
      ? table.getPreGroupedRowModel().rows
      : table.getRowModel().rows
  ) as Row<TData>[];
  const titleColumnId = resolveGalleryTitleColumnId({
    columnDefinitions,
    config,
  });
  const propertyColumnIds = resolveListPropertyColumnIds({
    columnDefinitions,
    config,
    groupBy,
    titleColumnId,
  });
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
  const groups = useMemo(
    () => createGalleryGroups({ groupBy, rows }),
    [groupBy, rows]
  );

  if (rows.length === 0) {
    return emptyState ? (
      <div className="rounded-md border">{emptyState}</div>
    ) : null;
  }

  const renderRow = (row: Row<TData>) => {
    const cellById = new Map(
      (row.getVisibleCells() as ListCell<TData>[]).map((cell) => [
        cell.column.id,
        cell,
      ])
    );
    return (
      <DataTableListItem
        isActive={isRowActive?.(row) ?? false}
        isClickable={isRowClickable?.(row) ?? false}
        key={row.id}
        onRowClick={onRowClick}
        propertyCells={propertyColumnIds.flatMap((id) => {
          const cell = cellById.get(id);
          return cell ? [cell] : [];
        })}
        propertyLabels={propertyLabels}
        row={row}
        showLabels={config?.showCardLabels === true}
        table={table}
        titleColumnId={titleColumnId}
      />
    );
  };

  return (
    <div className={cn("rounded-md border bg-background", className)}>
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
