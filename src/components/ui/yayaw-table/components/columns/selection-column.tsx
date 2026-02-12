/**
 * Selection column component for data tables
 * Provides checkbox for row selection with proper accessibility
 */
"use client";

import type { ColumnDef, Row, Table } from "@tanstack/react-table";
import { useState } from "react";
import { Checkbox } from "@/src/components/ui/checkbox";
import { SelectionCell } from "../cells/selection-cell";

/**
 * Options for selection column
 */
export interface SelectionColumnOptions {
  /**
   * Custom CSS class name for the column
   */
  className?: string;

  /**
   * Whether the column can be hidden
   */
  enableHiding?: boolean;
}

/**
 * Props for the selection header component
 */
interface SelectionHeaderProps<TData> {
  /**
   * Optional CSS class name
   */
  className?: string;

  /**
   * The table instance from TanStack Table
   */
  table: Table<TData>;
}

// Selection header component with proper UI refresh
function SelectionHeaderBase<TData>({ table }: SelectionHeaderProps<TData>) {
  // Force re-render when selection changes - this is the key fix!
  const [, forceUpdate] = useState({});

  if (!table) {
    return <div className="flex h-4 w-4 items-center justify-center" />;
  }

  const rowSelection = table.getState().rowSelection;
  const allRows = table.getRowModel().rows;
  const coreRows = table.getCoreRowModel().rows;
  const selectedCount = coreRows.filter((row) => rowSelection[row.id]).length;
  // With grouping, allRows can be group rows only; count visible leaf rows by recursing
  const visibleLeafIds = allRows.flatMap((row) => getLeafRowIds(row));
  const totalCount = visibleLeafIds.length;

  const isAllSelected = selectedCount === totalCount && totalCount > 0;
  const isSomeSelected =
    selectedCount > 0 && (totalCount === 0 || selectedCount < totalCount);

  const handleToggle = (value: boolean) => {
    if (value) {
      const newSelection: Record<string, boolean> = {
        ...rowSelection,
        ...Object.fromEntries(visibleLeafIds.map((id) => [id, true])),
      };
      table.setRowSelection(newSelection);
    } else {
      table.setRowSelection({});
    }

    // Critical: Force re-render after state change
    forceUpdate({});
  };

  return (
    <div className="flex items-center justify-center">
      <Checkbox
        aria-label="Select all rows"
        checked={isAllSelected}
        className="translate-y-[2px] cursor-pointer data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
        onCheckedChange={handleToggle}
        ref={(el: HTMLButtonElement & { indeterminate?: boolean }) => {
          if (el) {
            el.indeterminate = isSomeSelected;
          }
        }}
      />
    </div>
  );
}

/** Collect all leaf row IDs under a row (for group rows, recurse into subRows) */
function getLeafRowIds<TData>(row: Row<TData>): string[] {
  if (!row.getIsGrouped?.()) {
    return [row.id];
  }
  const sub = (row.subRows ?? []) as Row<TData>[];
  return sub.flatMap((r) => getLeafRowIds(r));
}

/** Group row selection control: checkbox to select/deselect whole group (exported for use in custom table body) */
export function GroupRowSelectionCell<TData>({
  row,
  table,
}: {
  row: Row<TData>;
  table: Table<TData>;
}) {
  const leafIds = getLeafRowIds(row);
  const rowSelection = table.getState().rowSelection || {};
  const selectedInGroup = leafIds.filter((id) => rowSelection[id]).length;
  const allSelected = selectedInGroup === leafIds.length && leafIds.length > 0;
  const someSelected = selectedInGroup > 0;

  const handleGroupToggle = (value: boolean) => {
    const leafSet = new Set(leafIds);
    const next: Record<string, boolean> = value
      ? {
          ...rowSelection,
          ...Object.fromEntries(leafIds.map((id) => [id, true])),
        }
      : Object.fromEntries(
          Object.entries(rowSelection).filter(([id]) => !leafSet.has(id))
        );
    table.setRowSelection(next);
  };

  return (
    <div className="flex items-center justify-center">
      <Checkbox
        aria-label="Select group"
        checked={allSelected}
        className="translate-y-[2px] cursor-pointer data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
        onCheckedChange={handleGroupToggle}
        ref={(el: HTMLButtonElement & { indeterminate?: boolean }) => {
          if (el) {
            el.indeterminate = someSelected && !allSelected;
          }
        }}
      />
    </div>
  );
}

/**
 * Creates a selection column definition
 * @param options - Options for customizing the selection column
 * @returns Column definition for row selection with checkboxes
 */
export function createSelectionColumn<TData>(
  options: SelectionColumnOptions = {}
): ColumnDef<TData, unknown> {
  const { className = "", enableHiding = false } = options;

  return {
    accessorKey: "select",
    enableGrouping: true,
    // Custom grouping value: selected vs unselected
    getGroupingValue: (_row: TData) => {
      // This will be handled dynamically by the table
      return "unselected"; // Default fallback
    },
    cell: (info) => {
      const isGrouped = info.cell.getIsGrouped?.() ?? false;

      if (isGrouped) {
        return <GroupRowSelectionCell row={info.row} table={info.table} />;
      }

      return <SelectionCell className={className} row={info.row} />;
    },
    enableHiding,
    enablePinning: false,
    enableSorting: false,
    header: ({ table }: { table: Table<TData> }) => (
      <SelectionHeaderBase className={className} table={table} />
    ),
    id: "select",
    meta: {
      disableDrag: true,
      disableDrop: true,
      fixedPosition: "start",
      isSelectionColumn: true,
    },
  };
}
