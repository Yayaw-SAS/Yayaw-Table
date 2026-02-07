/**
 * Selection column component for data tables
 * Provides checkbox for row selection with proper accessibility
 */
"use client";

import type { ColumnDef, Row, Table } from "@tanstack/react-table";
import { useState } from "react";
import { Checkbox } from "@/ui/shadcn/checkbox";
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
  const selectedCount = Object.keys(rowSelection).length;
  const totalCount = allRows.length;

  const isAllSelected = selectedCount === totalCount && totalCount > 0;
  const isSomeSelected = selectedCount > 0 && selectedCount < totalCount;

  const handleToggle = (value: boolean) => {
    if (value) {
      // Select all rows on current page
      const newSelection: Record<string, boolean> = { ...rowSelection };
      for (const row of allRows) {
        newSelection[row.id] = true;
      }
      table.setRowSelection(newSelection);
    } else {
      // Deselect all rows on current page
      const newSelection: Record<string, boolean> = { ...rowSelection };
      for (const row of allRows) {
        delete newSelection[row.id];
      }
      table.setRowSelection(newSelection);
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
        const count = info.row.subRows?.length ?? 0;

        // Count selected vs unselected in subRows
        const selectedCount =
          info.row.subRows?.filter((subRow: Row<TData>) => {
            const rowSelection = info.table.getState().rowSelection;
            return rowSelection[subRow.id];
          }).length ?? 0;

        const unselectedCount = count - selectedCount;

        return (
          <div className="flex items-center gap-2">
            <span>📋</span>
            <span className="font-medium">Selection Status</span>
            <div className="flex gap-1">
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700 text-xs">
                ☑️ {selectedCount} selected
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 text-xs">
                ☐ {unselectedCount} unselected
              </span>
            </div>
          </div>
        );
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
