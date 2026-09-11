/** Structural row contract shared by the independently installable editions. */
interface RangeSelectableRow {
  id: string;
  getCanMultiSelect: () => boolean;
  getCanSelect: () => boolean;
  getIsGrouped: () => boolean;
}

interface RowSelectionRangeTable<TRow> {
  getRowModel: () => { flatRows: readonly TRow[] };
}

export interface RowSelectionRangeOptions {
  anchorRowId: string;
  isSelected: boolean;
  rowSelection: Readonly<Record<string, boolean>>;
  rows: readonly { id: string }[];
  targetRowId: string;
}

/**
 * Returns rows that can participate in a multi-row selection range, excluding
 * generated grouping rows. The order matches the table's current flat model.
 */
export const getRangeSelectableRows = <TRow extends RangeSelectableRow>(
  table: RowSelectionRangeTable<TRow>
): TRow[] => {
  const rows: TRow[] = [];
  const seenRowIds = new Set<string>();

  for (const row of table.getRowModel().flatRows) {
    const isGroupedRow = row.getIsGrouped();
    const isDuplicate = seenRowIds.has(row.id);

    if (
      isGroupedRow ||
      isDuplicate ||
      !row.getCanSelect() ||
      !row.getCanMultiSelect()
    ) {
      continue;
    }

    seenRowIds.add(row.id);
    rows.push(row);
  }

  return rows;
};

/**
 * Applies an inclusive range toggle without changing selections outside it.
 * Returns undefined when either endpoint is absent from the supplied row order.
 */
export const getNextRowSelectionForRange = ({
  anchorRowId,
  isSelected,
  rowSelection,
  rows,
  targetRowId,
}: RowSelectionRangeOptions): Record<string, true> | undefined => {
  const anchorIndex = rows.findIndex((row) => row.id === anchorRowId);
  const targetIndex = rows.findIndex((row) => row.id === targetRowId);

  if (anchorIndex === -1 || targetIndex === -1) {
    return undefined;
  }

  const rangeStart = Math.min(anchorIndex, targetIndex);
  const rangeEnd = Math.max(anchorIndex, targetIndex);
  const nextRowSelection: Record<string, true> = {};
  for (const [id, selected] of Object.entries(rowSelection)) {
    if (selected) {
      nextRowSelection[id] = true;
    }
  }

  for (let index = rangeStart; index <= rangeEnd; index += 1) {
    const row = rows[index];

    if (isSelected) {
      nextRowSelection[row.id] = true;
    } else {
      delete nextRowSelection[row.id];
    }
  }

  return nextRowSelection;
};

const SELECTION_SCOPE_SELECTOR = "[data-yayaw-table-selection-scope]";
const SELECTION_ROW_SELECTOR = "[data-yayaw-table-selection-row-id]";

/** Resolve only rendered, selectable rows in their visible order. */
export const getRenderedRangeRows = <TRow extends RangeSelectableRow>(
  checkboxElement: HTMLElement | null,
  table: RowSelectionRangeTable<TRow>
): TRow[] => {
  const rangeRows = getRangeSelectableRows(table);
  const selectionScope = checkboxElement?.closest(SELECTION_SCOPE_SELECTOR);

  if (!selectionScope) {
    return rangeRows;
  }

  const rowById = new Map(rangeRows.map((rangeRow) => [rangeRow.id, rangeRow]));
  const renderedRows: TRow[] = [];
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
