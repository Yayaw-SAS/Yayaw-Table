/**
 * Number column component for data tables
 * Provides standardized display of numeric values
 */
'use client';

import type { CellContext, ColumnDef } from '@tanstack/react-table';
import { Hash, type LucideIcon } from 'lucide-react';

import { NumberCell } from '../cells/number-cell';

/**
 * Custom properties for our column definitions
 */
type CustomColumnProps = {
  icon?: LucideIcon;
  type?: string;
};

/**
 * Combined type for our column definition
 */
type ExtendedColumnDef<TData> = ColumnDef<TData> & CustomColumnProps;

interface NumberColumnProps {
  /**
   * Key to access the numeric value from the row data
   */
  accessorKey: string;

  /**
   * Optional CSS class name for the cell
   */
  className?: string;

  /**
   * Whether the column can be filtered
   * @default true
   */
  enableColumnFilter?: boolean;

  /**
   * Whether the column can be hidden
   * @default true
   */
  enableHiding?: boolean;

  /**
   * Whether the column can be sorted
   * @default true
   */
  enableSorting?: boolean;

  /**
   * Optional formatter function to format the number
   */
  formatter?: (value: number) => string;

  /**
   * Optional custom header text
   */
  header?: string;
}

/**
 * Creates a number column definition
 * @returns Column definition for displaying numeric values
 */
export function createNumberColumn<TData>({
  accessorKey,
  className,
  enableColumnFilter = true,
  enableHiding = true,
  enableSorting = true,
  formatter,
  header,
}: NumberColumnProps): ExtendedColumnDef<TData> {
  return {
    accessorKey,
    // Enable aggregation for grouped rows
    aggregationFn: 'sum',
    cell: (info: CellContext<TData, unknown>) => {
      const value = info.getValue();
      // Cast to number or string to satisfy NumberCell props
      const numValue = value as number | string;
      return (
        <NumberCell
          className={className}
          formatter={formatter}
          value={numValue}
        />
      );
    },
    // Render subtotal values on grouped rows
    aggregatedCell: ({ getValue }) => {
      const sum = Number(getValue() as number);
      let formatted = '—';
      if (Number.isFinite(sum)) {
        formatted =
          typeof formatter === 'function'
            ? formatter(sum)
            : sum.toLocaleString();
      }
      return <span className="font-medium">{formatted}</span>;
    },
    enableColumnFilter,
    enableHiding,
    enableSorting,
    header: header || accessorKey,
    icon: Hash,
    id: accessorKey,
    type: 'number',
  };
}
