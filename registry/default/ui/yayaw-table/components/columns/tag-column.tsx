/**
 * Tag column component for data tables
 * Displays tag values with colored backgrounds
 */
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { type LucideIcon, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TagCell } from "../cells/tag-cell";

/**
 * Options for creating a tag column
 */
export interface TagColumnOptions {
  /**
   * Optional CSS class name
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
   * Header text for the column
   */
  header: string;

  /**
   * Unique identifier for the column
   */
  id: string;

  /**
   * Optional map of tag value → Tailwind color class (e.g. "bg-red-500/80 text-white dark:bg-red-600/90").
   * When provided, matching values use this class; others use the deterministic hash.
   */
  tagColorMap?: Record<string, string>;
}

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

/**
 * Creates a column definition for displaying tag values with colored backgrounds
 */
export function createTagColumn<TData>({
  className = "",
  enableColumnFilter = true,
  enableHiding = true,
  enableSorting = true,
  header,
  id,
  tagColorMap,
}: TagColumnOptions): ExtendedColumnDef<TData> {
  return {
    accessorFn: (row: TData) => (row as Record<string, unknown>)[id],
    enableGrouping: true,
    cell: (info) => {
      // Group header: toggle + label (pill) + count
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
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground text-xs">
              {label}
            </span>
            <span className="text-muted-foreground text-xs">{count}</span>
          </div>
        );
      }

      // Aggregated cells: keep minimal. For placeholder cells on leaf rows,
      // render the actual value to preserve alignment and visibility in subgroups.
      if (info.cell.getIsAggregated?.()) {
        return <span className="text-muted-foreground"> </span>;
      }

      return (
        <TagCell
          className={className}
          tagColorMap={tagColorMap}
          value={info.getValue()}
        />
      );
    },
    enableColumnFilter,
    enableHiding,
    enableSorting,
    header,
    icon: Tag,
    id,
    type: "tag",
  };
}
