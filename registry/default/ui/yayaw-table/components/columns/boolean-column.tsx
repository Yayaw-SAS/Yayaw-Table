/**
 * Boolean column component for data tables
 * Provides standardized display of boolean values using BooleanBadge
 */
"use client";

import type { CellContext } from "@tanstack/react-table";
import { ToggleRight } from "lucide-react";
import { Button } from "@/ui/shadcn/button";
import { BooleanCell } from "../cells/boolean-cell";

// GroupHeader removed (inlined) to reduce complexity and avoid unused symbol

interface BooleanColumnProps {
  /**
   * Key to access the boolean value from the row data
   */
  accessorKey: string;

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
 * Creates a boolean column definition
 * @returns Column definition for displaying boolean values with badges
 */
export function createBooleanColumn<TData>({
  accessorKey,
  enableColumnFilter = true,
  enableHiding = true,
  enableSorting = true,
  header,
}: BooleanColumnProps) {
  return {
    accessorKey,
    enableGrouping: true,
    cell: (info: CellContext<TData, unknown>) => {
      if (info.cell.getIsGrouped?.()) {
        const expanded = info.row.getIsExpanded();
        const toggle = info.row.getToggleExpandedHandler();
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
      // Aggregated cells: keep minimal. For placeholder cells (grouped column on leaf rows),
      // render the actual boolean value to keep subgroup rows aligned.
      if (info.cell.getIsAggregated?.()) {
        return <span className="text-muted-foreground"> </span>;
      }
      const v = info.getValue();
      return v == null ? (
        <span className="text-muted-foreground">-</span>
      ) : (
        <BooleanCell value={Boolean(v)} />
      );
    },
    aggregatedCell: () => <span className="text-muted-foreground"> </span>,
    enableColumnFilter,
    enableHiding,
    enableSorting,
    header: header || accessorKey,
    icon: ToggleRight,
    id: accessorKey,
    type: "boolean",
  };
}
