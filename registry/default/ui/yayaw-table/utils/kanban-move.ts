interface MoveTable {
  allowEdit?: boolean;
  allowInlineEdit?: boolean;
  inlineEdit?: { enabled?: boolean };
  kanban?: { allowDragUpdate?: boolean; groupBy?: string; server?: unknown };
}

interface MoveColumn {
  accessorKey?: string;
  type?: string;
  inlineEdit?: boolean | { enabled?: boolean; readonly?: boolean };
  options?: readonly { value: unknown }[];
}

/** An inline-only table may move cards only through an editable grouping column. */
export function canUpdateKanbanColumn(
  table: MoveTable,
  column: MoveColumn | undefined
): boolean {
  if (!column) {
    return false;
  }
  if (table.allowEdit !== false) {
    return true;
  }
  const inline =
    typeof column.inlineEdit === "object"
      ? column.inlineEdit
      : { enabled: column.inlineEdit };
  return Boolean(
    table.allowInlineEdit &&
      table.inlineEdit?.enabled !== false &&
      column.type !== "multiSelect" &&
      column.type !== "tag" &&
      !inline.readonly &&
      inline.enabled === true
  );
}

/** Lane keys are strings; writes retain the option's original type and accessor. */
export function kanbanMovePatch(
  column: MoveColumn,
  groupBy: string,
  target: string
) {
  const option = column.options?.find((item) => String(item.value) === target);
  return { [column.accessorKey ?? groupBy]: option ? option.value : target };
}

/** Remote sources keep their configured grouping field when writing lane moves. */
export function canMoveKanbanRows(
  table: MoveTable,
  column: MoveColumn | undefined,
  groupBy: string,
  hasUpdateAction: boolean
): boolean {
  return Boolean(
    table.kanban?.allowDragUpdate &&
      hasUpdateAction &&
      groupBy &&
      (!table.kanban.server || groupBy === table.kanban.groupBy) &&
      canUpdateKanbanColumn(table, column)
  );
}

/** Presses on interactive content never start a card move. */
export function isKanbanDragControl(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        "button,a,input,select,textarea,label,[role=button],[contenteditable=true]"
      )
    )
  );
}
