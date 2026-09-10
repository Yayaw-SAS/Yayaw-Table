/**
 * Selection cell component for data tables
 * Shows a checkbox for row selection
 */
"use client";

import type { Row, Table } from "@tanstack/react-table";
import { type ComponentProps, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/src/components/ui/checkbox";
import {
  getNextRowSelectionForRange,
  getRangeSelectableRows,
} from "../../utils/row-selection-range";

const _DEBUG = false;
const SELECTION_SCOPE_SELECTOR = "[data-yayaw-table-selection-scope]";
const SELECTION_ROW_SELECTOR = "[data-yayaw-table-selection-row-id]";

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

const getRenderedRangeRows = <TData,>(
  checkboxElement: HTMLElement | null,
  table: Table<TData>
): Row<TData>[] => {
  const rangeRows = getRangeSelectableRows(table);
  const selectionScope = checkboxElement?.closest(SELECTION_SCOPE_SELECTOR);

  if (!selectionScope) {
    return rangeRows;
  }

  const rowById = new Map(rangeRows.map((rangeRow) => [rangeRow.id, rangeRow]));
  const renderedRows: Row<TData>[] = [];
  const seenRowIds = new Set<string>();

  for (const selectionControl of selectionScope.querySelectorAll(
    SELECTION_ROW_SELECTOR
  )) {
    if (selectionControl.hasAttribute("data-yayaw-table-selection-disabled")) {
      continue;
    }

    const rowId = selectionControl.getAttribute(
      "data-yayaw-table-selection-row-id"
    );
    const renderedRow = rowId ? rowById.get(rowId) : undefined;

    if (!(renderedRow && !seenRowIds.has(renderedRow.id))) {
      continue;
    }

    seenRowIds.add(renderedRow.id);
    renderedRows.push(renderedRow);
  }

  return renderedRows.length > 0 ? renderedRows : rangeRows;
};

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
        const isGroupedBySelection = table
          .getState()
          .grouping.includes("select");
        const rangeRows = isGroupedBySelection
          ? getRangeSelectableRows(table)
          : getRenderedRangeRows(checkboxRef.current, table);
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
