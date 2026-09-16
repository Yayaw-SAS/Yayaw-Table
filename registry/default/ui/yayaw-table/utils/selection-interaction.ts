import { getNextRowSelectionForRange } from "./row-selection-range";

const anchors = new WeakMap<object, { id: string; order: string }>();

/** A stable table scope owns one anchor shared by every selection surface. */
export function selectionAfterClick({
  scope,
  rows,
  selection,
  id,
  selected,
  shift,
  multiple = true,
}: {
  scope: object;
  rows: readonly { id: string }[];
  selection: Readonly<Record<string, boolean>>;
  id: string;
  selected: boolean;
  shift: boolean;
  multiple?: boolean;
}): Record<string, boolean> {
  const order = JSON.stringify(rows.map((row) => row.id));
  const anchor = anchors.get(scope);
  if (multiple && shift && anchor?.order === order) {
    const result = getNextRowSelectionForRange({
      anchorRowId: anchor.id,
      targetRowId: id,
      rows,
      rowSelection: selection,
      isSelected: selected,
    });
    if (result) {
      return result;
    }
  }
  anchors.set(scope, { id, order });
  const result = multiple ? { ...selection } : {};
  if (selected) {
    result[id] = true;
  } else {
    delete result[id];
  }
  return result;
}
