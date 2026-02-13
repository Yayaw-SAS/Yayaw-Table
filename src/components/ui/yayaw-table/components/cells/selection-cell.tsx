/**
 * Selection cell component for data tables
 * Shows a checkbox for row selection
 */
"use client";

import type { Row } from "@tanstack/react-table";
import { useCallback, useEffect, useState } from "react";
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
  // Track selection state locally
  const [isSelected, setIsSelected] = useState(row.getIsSelected());

  // Update local state when row selection changes
  useEffect(() => {
    setIsSelected(row.getIsSelected());
  }, [row]);

  // Create a stable callback for selection changes
  const handleSelectionChange = useCallback(
    (value: boolean) => {
      // Update local state first for immediate feedback
      setIsSelected(value);
      // Then update the row selection
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
        disabled={disabled}
        onCheckedChange={handleSelectionChange}
      />
    </div>
  );
}
