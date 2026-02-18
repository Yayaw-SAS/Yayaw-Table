/**
 * Number column component for data tables
 * Provides standardized display of numeric values
 */
"use client";

import type { CellContext, ColumnDef } from "@tanstack/react-table";
import { Hash, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "../../utils/number-format";
import type { NumberFormatConfig } from "../../utils/number-format";
import { NumberCell } from "../cells/number-cell";

/**
 * Custom properties for our column definitions
 */
interface CustomColumnProps {
  icon?: LucideIcon;
  type?: string;
}

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

  /**
   * Display format: "space" (1 234 567), "dot" (1.234.567), "comma" (1,234,567), "locale" (Intl),
   * or { thousandsSeparator, decimalSeparator, decimals }.
   */
  numberFormat?: NumberFormatConfig;
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
  numberFormat,
}: NumberColumnProps): ExtendedColumnDef<TData> {
  return {
    accessorKey,
    enableGrouping: true,
    // Enable aggregation for grouped rows
    aggregationFn: "sum",
    cell: (info: CellContext<TData, unknown>) => {
      // Group header: toggle + label + count
      if (info.cell.getIsGrouped?.()) {
        const toggle = info.row.getToggleExpandedHandler();
        const expanded = info.row.getIsExpanded();
        const count = info.row.subRows?.length ?? 0;
        const label = String(info.getValue() ?? "");
        return (
          <div className="flex items-center gap-2">
            <Button
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse group" : "Expand group"}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                toggle();
              }}
              size="icon"
              type="button"
              variant="ghost"
            >
              <span aria-hidden>{expanded ? "▾" : "▸"}</span>
            </Button>
            <span className="font-medium">{label}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
              {count}
            </span>
          </div>
        );
      }
      // Aggregated cells: keep minimal. For placeholder cells (leaf rows under a grouped column),
      // render the actual numeric value to avoid shifted columns in subgroups.
      if (info.cell.getIsAggregated?.()) {
        return <span className="text-muted-foreground"> </span>;
      }
      const value = info.getValue();
      const numValue = value as number | string;
      return (
        <NumberCell
          className={className}
          formatter={formatter}
          numberFormat={numberFormat}
          value={numValue}
        />
      );
    },
    // Render subtotal values on grouped rows
    aggregatedCell: ({ getValue }) => {
      const sum = Number(getValue() as number);
      let formatted = "—";
      if (Number.isFinite(sum)) {
        if (typeof formatter === "function") {
          formatted = formatter(sum);
        } else if (numberFormat !== undefined) {
          formatted = formatNumber(sum, numberFormat);
        } else {
          formatted = sum.toLocaleString();
        }
      }
      return <span className="font-medium">{formatted}</span>;
    },
    enableColumnFilter,
    enableHiding,
    enableSorting,
    header: header || accessorKey,
    icon: Hash,
    id: accessorKey,
    meta: { columnType: "number" },
    type: "number",
  };
}
