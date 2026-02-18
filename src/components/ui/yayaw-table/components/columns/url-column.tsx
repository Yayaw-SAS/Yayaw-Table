"use client";

import type { CellContext, ColumnDef } from "@tanstack/react-table";
import { type LucideIcon, Link2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { UrlCell } from "../cells/url-cell";

type UrlDisplayMode = "icon" | "domain" | "full" | "row-link";

interface CustomColumnProps {
  icon?: LucideIcon;
  type?: string;
}

type ExtendedColumnDef<TData> = ColumnDef<TData> & CustomColumnProps;

interface UrlColumnProps {
  accessorKey: string;
  className?: string;
  displayMode?: UrlDisplayMode;
  enableColumnFilter?: boolean;
  enableHiding?: boolean;
  enableSorting?: boolean;
  header?: string;
}

export function createUrlColumn<TData>({
  accessorKey,
  className = "",
  displayMode = "domain",
  enableColumnFilter = true,
  enableHiding = true,
  enableSorting = true,
  header,
}: UrlColumnProps): ExtendedColumnDef<TData> {
  return {
    accessorKey,
    enableGrouping: true,
    getGroupingValue: (row: unknown) => {
      const value = (row as Record<string, unknown>)[accessorKey];
      return typeof value === "string" ? value : String(value ?? "");
    },
    aggregatedCell: ({ getValue }) => {
      const label = String(getValue() ?? "");
      return <span className="font-medium">{label}</span>;
    },
    cell: (info: CellContext<TData, unknown>) => {
      const isGrouped = info.cell.getIsGrouped();
      const isAggregated = info.cell.getIsAggregated();
      const hasSubRows = (info.row.subRows?.length ?? 0) > 0;

      if (isGrouped || hasSubRows) {
        const GroupHeader = () => {
          const [localExpanded, setLocalExpanded] = useState(true);
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

      if (isAggregated) {
        return <span className="text-muted-foreground"> </span>;
      }

      if (displayMode === "row-link") {
        return null;
      }

      const value = info.getValue();
      return (
        <UrlCell
          className={className}
          displayMode={displayMode}
          value={value}
        />
      );
    },
    enableColumnFilter,
    enableHiding: displayMode === "row-link" ? false : enableHiding,
    enableSorting,
    header: header || accessorKey,
    icon: Link2,
    id: accessorKey,
    meta: {
      isRowLink: displayMode === "row-link",
      rowLinkAccessorKey: displayMode === "row-link" ? accessorKey : undefined,
    },
    type: "url",
  };
}
