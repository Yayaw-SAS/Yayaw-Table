/**
 * Selection cell component for data tables
 * Shows a checkbox for row selection
 */
"use client";

import { type ComponentProps, useCallback, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Row, Table } from "../../tanstack";
import { selectRowWithRange } from "../../utils/row-selection-interaction";

const _DEBUG = false;

type CheckboxCheckedChangeHandler = NonNullable<
  ComponentProps<typeof Checkbox>["onCheckedChange"]
>;

const isShiftModifiedEvent = (event: Event): boolean =>
  "shiftKey" in event && event.shiftKey === true;

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

  /**
   * The table instance used to resolve Shift-click selection ranges
   */
  table?: Table<TData>;
}

/**
 * Cell component for displaying a selection checkbox
 */
export function SelectionCell<TData>({
  className = "",
  disabled = false,
  row,
  table,
}: SelectionCellProps<TData>) {
  const checkboxRef = useRef<HTMLElement>(null);
  const isSelectionDisabled = disabled || !row.getCanSelect();
  const handleSelectionChange = useCallback<CheckboxCheckedChangeHandler>(
    (isSelected, eventDetails) => {
      if (!isSelectionDisabled) {
        selectRowWithRange({
          element: checkboxRef.current,
          isSelected,
          row,
          shiftKey: isShiftModifiedEvent(eventDetails.event),
          table,
        });
      }
    },
    [isSelectionDisabled, row, table]
  );

  return (
    <div className={cn("flex items-center justify-center px-2", className)}>
      <Checkbox
        aria-label="Select row"
        checked={row.getIsSelected()}
        className="hover:cursor-pointer data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
        data-yayaw-table-selection-disabled={
          isSelectionDisabled ? "" : undefined
        }
        data-yayaw-table-selection-row-id={row.id}
        disabled={isSelectionDisabled}
        onCheckedChange={handleSelectionChange}
        ref={checkboxRef}
      />
    </div>
  );
}
