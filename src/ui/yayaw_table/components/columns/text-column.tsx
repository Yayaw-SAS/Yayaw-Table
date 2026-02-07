/**
 * Text column component for data tables
 * Provides standardized display of text values
 */
"use client";

import type { CellContext, ColumnDef } from "@tanstack/react-table";
import { type LucideIcon, Text } from "lucide-react";
import { useState } from "react";
import { Button } from "@/ui/shadcn/button";
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
  className = "",
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
      return typeof value === "string" ? value : String(value ?? "");
    },
    // Show plain label in aggregated cell
    aggregatedCell: ({ getValue }) => {
      const label = String(getValue() ?? "");
      return <span className="font-medium">{label}</span>;
    },
    cell: (info: CellContext<TData, unknown>) => {
      const isGrouped = info.cell.getIsGrouped();
      const isAggregated = info.cell.getIsAggregated();
      const _isPlaceholder = info.cell.getIsPlaceholder();

      // Debug removed to stop spam

      // FORCE group header display for ANY row that has subRows (bypass TanStack detection)
      const hasSubRows = (info.row.subRows?.length ?? 0) > 0;
      if (isGrouped || hasSubRows) {
        const GroupHeader = () => {
          const [localExpanded, setLocalExpanded] = useState(true); // Start expanded
          const count = info.row.subRows?.length ?? 0;
          const label = String(info.getValue() ?? "");

          return (
            <Button
              className="flex w-full cursor-pointer items-center gap-2 border-0 bg-red-100 p-2 text-left hover:bg-red-200"
              onClick={(e) => {
                e.stopPropagation();
                setLocalExpanded(!localExpanded);
              }}
              type="button"
              variant="ghost"
            >
              <span aria-hidden className="text-lg text-muted-foreground">
                {localExpanded ? "▾" : "▸"}
              </span>
              <span className="font-medium">{label}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                {count}
              </span>
            </Button>
          );
        };

        return <GroupHeader />;
      }

      // Aggregated cells: keep minimal. For placeholder cells (e.g., grouped column on leaf rows),
      // render the actual value so columns stay aligned and data remains visible.
      if (isAggregated) {
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
    type: "text",
  };
}
