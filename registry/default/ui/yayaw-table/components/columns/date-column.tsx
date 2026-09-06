/**
 * Date column component for data tables
 * Provides standardized display of date values with formatting options
 */
"use client";

import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "../../providers/table-provider";
import type { CellContext, ColumnDef } from "../../tanstack";
import type { DateDisplayPreset } from "../../types/date-types";
import {
  formatYearMonthGroupLabel,
  toYearMonthGroupKey,
} from "../../utils/date-display";

import { DateCell } from "../cells/date-cell";

/**
 * Custom properties for our column definitions
 */
interface CustomColumnProps {
  icon?: LucideIcon;
  type?: string;
}

interface DateColumnProps {
  /**
   * Key to access the date value from the row data
   */
  accessorKey: string;

  /**
   * Optional CSS class name for the cell
   */
  className?: string;

  /**
   * Date format string (date-fns compatible)
   * @default "PPP" (localized date with month name)
   */
  dateFormat?: string;

  /**
   * Date display preset (strict preset-based formatting)
   */
  dateDisplayPreset?: DateDisplayPreset;

  /**
   * Fallback date display preset (typically table-level default)
   */
  fallbackDateDisplayPreset?: DateDisplayPreset;

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

  /**
   * Whether to show the time
   * @default false
   */
  showTime?: boolean;
}

/**
 * Combined type for our column definition
 */
type ExtendedColumnDef<TData> = ColumnDef<TData> & CustomColumnProps;

function DateGroupLabel({ value }: { value: unknown }) {
  const locale = useLocale();
  const label = formatYearMonthGroupLabel(value, locale);
  return <span className="font-medium">{label}</span>;
}

/**
 * Creates a date column definition
 * @returns Column definition for displaying formatted date values
 */
export function createDateColumn<TData>({
  accessorKey,
  className,
  dateFormat = "PPP",
  dateDisplayPreset,
  fallbackDateDisplayPreset,
  enableColumnFilter = true,
  enableHiding = true,
  enableSorting = true,
  header,
  showTime = false,
}: DateColumnProps): ExtendedColumnDef<TData> {
  return {
    accessorKey,
    // Allow grouping by default for date columns
    enableGrouping: true,
    // Grouping value: stable chronological key (YYYY-MM)
    getGroupingValue: (row: unknown) => {
      const value = (row as Record<string, unknown>)[accessorKey] as
        | Date
        | number
        | string
        | undefined;
      return toYearMonthGroupKey(value) ?? "";
    },
    // Aggregation for grouped rows (count of rows)
    aggregationFn: "count",
    cell: (info: CellContext<TData, unknown>) => {
      const isGrouped = info.cell.getIsGrouped();
      const isAggregated = info.cell.getIsAggregated();
      const _isPlaceholder = info.cell.getIsPlaceholder();

      // Group header row: show toggle + month label + count
      if (isGrouped) {
        const rawValue = info.getValue();
        const expanded = info.row.getIsExpanded();
        const count = info.row.subRows?.length || 0;

        return (
          <div className="flex items-center gap-2">
            <Button
              aria-label={expanded ? "Collapse group" : "Expand group"}
              onClick={info.row.getToggleExpandedHandler()}
              size="sm"
              type="button"
              variant="ghost"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <DateGroupLabel value={rawValue} />
            <span className="text-muted-foreground text-xs">{count}</span>
          </div>
        );
      }

      // Aggregated cells for this column: show nothing (label is on grouped cell)
      // For placeholder cells on leaf rows, render the actual value so subgroups stay aligned.
      if (isAggregated) {
        return <span className="text-muted-foreground"> </span>;
      }

      // Regular leaf row cell
      const value = info.getValue() as
        | Date
        | null
        | number
        | string
        | undefined;
      return (
        <DateCell
          className={className}
          dateDisplayPreset={dateDisplayPreset}
          dateFormat={dateFormat}
          fallbackDateDisplayPreset={fallbackDateDisplayPreset}
          showTime={showTime}
          value={value}
        />
      );
    },
    // How to render aggregated cell for date column (show group label)
    aggregatedCell: ({ getValue }) => {
      return <DateGroupLabel value={getValue()} />;
    },
    enableColumnFilter,
    enableHiding,
    enableSorting,
    header: header || accessorKey,
    icon: CalendarDays,
    id: accessorKey,
    type: "date",
  };
}
