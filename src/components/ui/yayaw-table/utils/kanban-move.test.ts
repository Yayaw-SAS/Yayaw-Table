import { expect, it } from "bun:test";
import { canMoveKanbanRows, canUpdateKanbanColumn, kanbanMovePatch } from "./kanban-move";

it("allows inline-only moves only on an editable grouping column", () => {
  const inline = { allowEdit: false, allowInlineEdit: true, inlineEdit: { enabled: true } };
  expect(canUpdateKanbanColumn(inline, { inlineEdit: true })).toBe(true);
  expect(canUpdateKanbanColumn(inline, { inlineEdit: false })).toBe(false);
  expect(canUpdateKanbanColumn(inline, {})).toBe(false);
  expect(canUpdateKanbanColumn(inline, { type: "multiSelect", inlineEdit: true })).toBe(false);
  expect(canUpdateKanbanColumn(inline, { inlineEdit: { readonly: true } })).toBe(false);
  expect(canUpdateKanbanColumn({ allowEdit: false }, { inlineEdit: true })).toBe(false);
  expect(canUpdateKanbanColumn({ allowEdit: true }, {})).toBe(true);
  expect(canUpdateKanbanColumn(inline, undefined)).toBe(false);
});
it("writes the accessor and typed option, including false and zero", () => {
  expect(kanbanMovePatch({ accessorKey: "status_id", options: [{ value: 0 }, { value: 2 }] }, "status", "2")).toEqual({ status_id: 2 });
  expect(kanbanMovePatch({ options: [{ value: false }] }, "published", "false")).toEqual({ published: false });
  expect(kanbanMovePatch({}, "stage", "done")).toEqual({ stage: "done" });
});

it("requires opt-in, an update action and the configured remote grouping field", () => {
  const table = { allowEdit: true, kanban: { allowDragUpdate: true, groupBy: "status", server: {} } };
  expect(canMoveKanbanRows(table, {}, "status", true)).toBe(true);
  expect(canMoveKanbanRows(table, {}, "owner", true)).toBe(false);
  expect(canMoveKanbanRows(table, {}, "status", false)).toBe(false);
  expect(canMoveKanbanRows({ ...table, kanban: { allowDragUpdate: false } }, {}, "status", true)).toBe(false);
});
