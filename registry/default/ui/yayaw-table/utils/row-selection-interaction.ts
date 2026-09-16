import type { Row, Table } from "../tanstack";
import {
  getNextRowSelectionForRange,
  getRenderedRangeRows,
} from "./row-selection-range";

interface SelectionRangeAnchor {
  rowId: string;
  rowOrderKey: string;
}

const selectionRangeAnchors = new WeakMap<object, SelectionRangeAnchor>();

/** Share the same range anchor between checkboxes and modified card clicks. */
export function selectRowWithRange<TData>({
  element,
  isSelected,
  row,
  shiftKey,
  table,
}: {
  element: HTMLElement | null;
  isSelected: boolean;
  row: Row<TData>;
  shiftKey: boolean;
  table?: Table<TData>;
}): void {
  if (!row.getCanSelect()) {
    return;
  }

  if (table) {
    const rangeRows = getRenderedRangeRows(element, table);
    const rowOrderKey = JSON.stringify(
      rangeRows.map((rangeRow) => rangeRow.id)
    );
    // React Table v9 returns a new facade on state changes; its store is stable.
    const anchor = selectionRangeAnchors.get(table.store);
    const canSelectRange =
      shiftKey &&
      row.getCanMultiSelect() &&
      anchor?.rowOrderKey === rowOrderKey &&
      rangeRows.some((rangeRow) => rangeRow.id === anchor.rowId) &&
      rangeRows.some((rangeRow) => rangeRow.id === row.id);

    if (canSelectRange) {
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

    selectionRangeAnchors.set(table.store, { rowId: row.id, rowOrderKey });
  }

  row.toggleSelected(isSelected);
}

export function isSelectionModifiedClick(event: {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}): boolean {
  return event.shiftKey || event.metaKey || event.ctrlKey;
}

/** Keep native Select All behavior in editors and inside portalled dialogs. */
export function shouldSelectAllFromKeyboard(event: {
  altKey: boolean;
  ctrlKey: boolean;
  currentTarget: HTMLElement;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
}): boolean {
  if (
    !(event.ctrlKey || event.metaKey) ||
    event.key.toLowerCase() !== "a" ||
    event.altKey ||
    event.shiftKey ||
    !(event.target instanceof Element) ||
    !event.currentTarget.contains(event.target)
  ) {
    return false;
  }

  return !event.target.closest(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="dialog"], [role="alertdialog"]'
  );
}
