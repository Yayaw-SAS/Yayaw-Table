/**
 * String column component for data tables
 * Provides standardized display of string values
 */
"use client";

import type { CellContext, ColumnDef } from "@/components/ui/yayaw-table/tanstack";
import { Asterisk, type LucideIcon } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { StringCell } from "../cells/string-cell";

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

interface StringColumnProps {
  /**
   * Key to access the string value from the row data
   */
  accessorKey: string;

  /**
   * Optional CSS class name for the cell
   */
  className?: string;

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
   * Whether to show quotes around the string
   * @default false
   */
  showQuotes?: boolean;
}

/**
 * Creates a string column definition
 * @returns Column definition for displaying string values
 */
export function createStringColumn<TData>({
  accessorKey,
  className,
  enableHiding = true,
  enableSorting = true,
  header,
  showQuotes = false,
}: StringColumnProps): ExtendedColumnDef<TData> {
  return {
    accessorKey,
    enableGrouping: true,
    cell: (info: CellContext<TData, unknown>) => {
      // Debug removed to stop spam

      // Fast path: grouped header with toggle
      if (info.cell.getIsGrouped?.()) {
        const toggle = info.row.getToggleExpandedHandler();
        const expanded = info.row.getIsExpanded();
        const count = info.row.subRows?.length ?? 0;
        const label = String(info.getValue() ?? "");
        return (
          <Button
            className="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left"
            onClick={(e) => {
              e.stopPropagation();
              const _result = toggle();
            }}
            type="button"
            variant="ghost"
          >
            <span aria-hidden className="text-muted-foreground">
              {expanded ? "▾" : "▸"}
            </span>
            <span className="font-medium">{label}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
              {count}
            </span>
          </Button>
        );
      }

      // Minimal output for aggregate cells. For placeholder cells (grouped column on leaf rows),
      // render the actual value so grouped layouts keep their visible data and alignment.
      if (info.cell.getIsAggregated?.()) {
        return <span className="text-muted-foreground"> </span>;
      }

      const value = info.getValue();
      return (
        <StringCell
          className={className}
          showQuotes={showQuotes}
          value={value}
        />
      );
    },
    enableHiding,
    enableSorting,
    header: header || accessorKey,
    icon: Asterisk,
    id: accessorKey,
    type: "string",
  };
}
