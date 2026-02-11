"use client";

import type { Column } from "@tanstack/react-table";
import type { CSSProperties, ReactNode } from "react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { getColumnPinningStyles } from "../../../utils/column-pinning-styles";

interface SortableHeaderProps {
  children: ReactNode;
  className?: string;
  column?: Column<Record<string, unknown>, unknown>;
  id: string;
  // DnD is handled by DataTableColumnHeader; keep only visual/pinning props here
  style?: CSSProperties;
}

// Simplified header wrapper; DnD is attached inside DataTableColumnHeader
export function SortableHeader({
  children,
  className,
  column,
  id,
  style,
}: SortableHeaderProps) {
  const pinningStyles = column ? getColumnPinningStyles(column) : {};

  const headerStyles: CSSProperties = {
    boxShadow: pinningStyles.boxShadow || "none",
    left: pinningStyles.left,
    opacity: pinningStyles.opacity || 1,
    position: (pinningStyles.position as "relative" | "sticky") || "relative",
    right: pinningStyles.right,
    zIndex: pinningStyles.zIndex || 0,
    ...style,
  };

  return (
    <TableHead
      className={cn(
        "group relative border-border border-r text-sm [&:has([role=checkbox])]:pr-2 [&:has([role=checkbox])]:pl-4",
        className
      )}
      data-column-id={id}
      style={headerStyles}
    >
      {children}
    </TableHead>
  );
}
