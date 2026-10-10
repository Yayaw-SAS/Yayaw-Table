import assert from "node:assert/strict";
import { describe, it } from "bun:test";
import {
  COPY_CELL_ACTION_ID,
  cellCopyText,
  resolveCellActions,
} from "./cell-actions";

const row = { id: "1", notes: 3, url: "" };

describe("resolveCellActions", () => {
  it("keeps declaration order, skips hidden actions and links without a URL", () => {
    const actions = resolveCellActions(
      {
        cellActions: [
          { id: "note", label: "Add a note", count: (record) => Number(record.notes) },
          { id: "hidden", label: "Hidden", visible: () => false },
          { id: "open", label: "Open", href: (record) => String(record.url) || undefined },
          { id: "edit", label: "Edit", disabled: () => true, reveal: "hover" },
        ],
      },
      row,
      "value",
      "Copy"
    );

    assert.deepEqual(
      actions.map(({ id, count, disabled, reveal }) => ({ id, count, disabled, reveal })),
      [
        { id: "note", count: 3, disabled: false, reveal: "always" },
        { id: "edit", count: undefined, disabled: true, reveal: "hover" },
      ]
    );
  });

  it("hides a zero count and runs onClick with the row and the value", () => {
    const calls: unknown[] = [];
    const [action] = resolveCellActions(
      {
        cellActions: [
          {
            id: "note",
            label: "Add a note",
            count: () => 0,
            onClick: (record, value) => calls.push([record.id, value]),
          },
        ],
      },
      row,
      "last note",
      "Copy"
    );

    assert.equal(action?.count, undefined);
    action?.run?.();
    assert.deepEqual(calls, [["1", "last note"]]);
  });

  it("adds the copy action last, revealed on hover, only with a value", () => {
    const actions = resolveCellActions(
      { copyable: true, cellActions: [{ id: "edit", label: "Edit" }] },
      row,
      ["a@b.c", null, "d@e.f"],
      "Copy"
    );
    assert.deepEqual(
      actions.map(({ id, copyText, reveal }) => ({ id, copyText, reveal })),
      [
        { id: "edit", copyText: undefined, reveal: "always" },
        { id: COPY_CELL_ACTION_ID, copyText: "a@b.c, d@e.f", reveal: "hover" },
      ]
    );
    assert.deepEqual(resolveCellActions({ copyable: true }, row, "", "Copy"), []);
  });

  it("links never run onClick", () => {
    const [action] = resolveCellActions(
      { cellActions: [{ id: "open", label: "Open", href: () => "/x", onClick: () => undefined }] },
      row,
      undefined,
      "Copy"
    );
    assert.equal(action?.href, "/x");
    assert.equal(action?.run, undefined);
  });
});

describe("cellCopyText", () => {
  it("copies text, numbers, lists and objects as cells show them", () => {
    assert.equal(cellCopyText(null), "");
    assert.equal(cellCopyText(12), "12");
    assert.equal(cellCopyText(["a", 2, null]), "a, 2");
    assert.equal(cellCopyText({ a: 1 }), '{"a":1}');
  });
});
