import type { Row, RowSelectionState, Table } from "@tanstack/react-table";

type RowSelectionRangeTable<TData> = Pick<Table<TData>, "getRowModel">;

export interface RowSelectionRangeOptions {
  anchorRowId: string;
  isSelected: boolean;
  rowSelection: Readonly<RowSelectionState>;
  rows: readonly { id: string }[];
  targetRowId: string;
}

/**
 * Returns rows that can participate in a multi-row selection range, excluding
 * generated grouping rows. The order matches the table's current flat model.
 */
export const getRangeSelectableRows = <TData>(
  table: RowSelectionRangeTable<TData>
): Row<TData>[] => {
  const rows: Row<TData>[] = [];
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
}: RowSelectionRangeOptions): RowSelectionState | undefined => {
  const anchorIndex = rows.findIndex((row) => row.id === anchorRowId);
  const targetIndex = rows.findIndex((row) => row.id === targetRowId);

  if (anchorIndex === -1 || targetIndex === -1) {
    return undefined;
  }

  const rangeStart = Math.min(anchorIndex, targetIndex);
  const rangeEnd = Math.max(anchorIndex, targetIndex);
  const nextRowSelection: RowSelectionState = { ...rowSelection };

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
