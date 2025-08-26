/**
 * Selection column component for data tables
 * Provides checkbox for row selection with proper accessibility
 */
'use client';

import type { ColumnDef, Row, Table } from '@tanstack/react-table';
import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { SelectionCell } from '../cells/selection-cell';

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
  const { className = '', enableHiding = false } = options;

  return {
    accessorKey: 'select',
    cell: ({ row }: { row: Row<TData> }) => (
      <SelectionCell className={className} row={row} />
    ),
    enableHiding,
    enablePinning: false,
    enableSorting: false,
    header: ({ table }: { table: Table<TData> }) => (
      <SelectionHeaderBase className={className} table={table} />
    ),
    id: 'select',
    meta: {
      disableDrag: true,
      disableDrop: true,
      fixedPosition: 'start',
      isSelectionColumn: true,
    },
  };
}
