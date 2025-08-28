/**
 * Text column component for data tables
 * Provides standardized display of text values
 */
'use client';

import type { CellContext, ColumnDef } from '@tanstack/react-table';
import { type LucideIcon, Text } from 'lucide-react';

import { StringCell } from '../cells/string-cell';

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

interface TextColumnProps {
  /**
   * Key to access the text value from the row data
   */
  accessorKey: string;

  /**
   * Optional CSS class for the cell
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
   * Optional custom header text
   */
  header?: string;
}

/**
 * Creates a text column definition
 * @returns Column definition for displaying text values
 */
export function createTextColumn<TData>({
  accessorKey,
  className = '',
  enableColumnFilter = true,
  enableHiding = true,
  enableSorting = true,
  header,
}: TextColumnProps): ExtendedColumnDef<TData> {
  return {
    accessorKey,
    // Enable grouping by default for textual columns
    enableGrouping: true,
    // When grouped, use the raw value for grouping label
    getGroupingValue: (row: unknown) => {
      const value = (row as Record<string, unknown>)[accessorKey];
      return typeof value === 'string' ? value : String(value ?? '');
    },
    // Show plain label in aggregated cell
    aggregatedCell: ({ getValue }) => {
      const label = String(getValue() ?? '');
      return <span className="font-medium">{label}</span>;
    },
    cell: (info: CellContext<TData, unknown>) => {
      const isGrouped = info.cell.getIsGrouped();
      const isAggregated = info.cell.getIsAggregated();
      const isPlaceholder = info.cell.getIsPlaceholder();

      // Group header cell: toggle + label + count
      if (isGrouped) {
        const toggle = info.row.getToggleExpandedHandler();
        const expanded = info.row.getIsExpanded();
        const count = info.row.subRows?.length ?? 0;
        const label = String(info.getValue() ?? '');
        return (
          <div className="flex items-center gap-2">
            <button
              aria-label={expanded ? 'Collapse group' : 'Expand group'}
              className="text-muted-foreground hover:text-foreground"
              onClick={toggle}
              type="button"
            >
              <span aria-hidden>{expanded ? '▾' : '▸'}</span>
            </button>
            <span className="font-medium">{label}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
              {count}
            </span>
          </div>
        );
      }

      // Aggregated/placeholder cells: keep minimal
      if (isAggregated || isPlaceholder) {
        return <span className="text-muted-foreground"> </span>;
      }

      // Regular cell
      const value = info.getValue();
      return <StringCell className={className} value={value} />;
    },
    enableColumnFilter,
    enableHiding,
    enableSorting,
    header: header || accessorKey,
    icon: Text,
    id: accessorKey,
    type: 'text',
  };
}
