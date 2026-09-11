/**
 * Selection cell component for data tables
 * Shows a checkbox for row selection
 */
"use client";

import { type ComponentProps, useCallback, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Row, Table } from "../../tanstack";
import {
  getNextRowSelectionForRange,
  getRenderedRangeRows,
} from "../../utils/row-selection-range";

const _DEBUG = false;

type CheckboxCheckedChangeHandler = NonNullable<
  ComponentProps<typeof Checkbox>["onCheckedChange"]
>;

interface SelectionRangeAnchor {
  rowId: string;
  rowOrderKey: string;
}

const selectionRangeAnchors = new WeakMap<object, SelectionRangeAnchor>();

const getRowOrderKey = (rows: readonly { id: string }[]): string =>
  JSON.stringify(rows.map((rangeRow) => rangeRow.id));

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
      if (table) {
        const rangeRows = getRenderedRangeRows(checkboxRef.current, table);
        const rowOrderKey = getRowOrderKey(rangeRows);
        const anchor = selectionRangeAnchors.get(table);
        const isShiftClick = isShiftModifiedEvent(eventDetails.event);
        const canSelectRange =
          isShiftClick &&
          row.getCanMultiSelect() &&
          anchor?.rowOrderKey === rowOrderKey;

        if (canSelectRange) {
          const hasAnchor = rangeRows.some(
            (rangeRow) => rangeRow.id === anchor.rowId
          );
          const hasTarget = rangeRows.some(
            (rangeRow) => rangeRow.id === row.id
          );

          if (hasAnchor && hasTarget) {
            table.setRowSelection(
              (rowSelection) =>
                getNextRowSelectionForRange({
                  anchorRowId: anchor.rowId,
                  isSelected,
                  rowSelection,
                  rows: rangeRows,
                  targetRowId: row.id,
                }) ?? rowSelection
            );
            return;
          }
        }

        selectionRangeAnchors.set(table, {
          rowId: row.id,
          rowOrderKey,
        });
      }

      row.toggleSelected(isSelected);
    },
    [row, table]
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
