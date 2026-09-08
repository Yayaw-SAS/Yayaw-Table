/**
 * Selection cell component for data tables
 * Shows a checkbox for row selection
 */
"use client";

import type { Row } from "@/components/ui/yayaw-table/tanstack";
import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/src/components/ui/checkbox";

const _DEBUG = false;

export interface SelectionCellProps<TData> {
  /**
   * Optional CSS class name
   */
  className?: string;

  /**
   * Whether the row is disabled for selection
   */
  disabled?: boolean;

  /**
   * The row object from TanStack Table
   */
  row: Row<TData>;
}

/**
 * Cell component for displaying a selection checkbox
 */
export function SelectionCell<TData>({
  className = "",
  disabled = false,
  row,
}: SelectionCellProps<TData>) {
  // Rows keep their identity when selection changes; read the controlled state.
  const isSelected = row.getIsSelected();

  // Create a stable callback for selection changes
  const handleSelectionChange = useCallback(
    (value: boolean) => {
      row.toggleSelected(value);
    },
    [row]
  );
  return (
    <div className={cn("flex items-center justify-center px-2", className)}>
      <Checkbox
        aria-label="Select row"
        checked={isSelected}
        className="hover:cursor-pointer data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
        disabled={disabled || !row.getCanSelect()}
        onCheckedChange={handleSelectionChange}
      />
    </div>
  );
}
