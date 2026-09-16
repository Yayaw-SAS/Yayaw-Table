import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Row, RowSelectionState, Table } from "../tanstack";
import { selectRowWithRange } from "./row-selection-interaction";

function selectionFixture() {
  let selection: RowSelectionState = {};
  const store = {};
  let order = ["one", "two", "three", "four"];
  const rows = order.map(
    (id) =>
      ({
        id,
        getCanMultiSelect: () => true,
        getCanSelect: () => true,
        getIsGrouped: () => false,
        toggleSelected: (selected: boolean) => {
          selection = { ...selection };
          if (selected) {
            selection[id] = true;
          } else {
            delete selection[id];
          }
        },
      }) as Row<{ id: string }>
  );
  const getTable = () =>
    ({
      store,
      getRowModel: () => ({
        flatRows: order.map((id) => rows.find((row) => row.id === id)),
      }),
      setRowSelection: (
        updater: (previous: RowSelectionState) => RowSelectionState
      ) => {
        selection = updater(selection);
      },
    }) as Table<{ id: string }>;

  return {
    get selection() {
      return selection;
    },
    reorder: (nextOrder: string[]) => {
      order = nextOrder;
    },
    select: (id: string, shiftKey = false, isSelected = true) => {
      const row = rows.find((item) => item.id === id);
      if (!row) {
        throw new Error("Unknown fixture row");
      }
      selectRowWithRange({
        element: null,
        isSelected,
        row,
        shiftKey,
        // A new facade matches React Table v9 after each state change.
        table: getTable(),
      });
    },
  };
}

describe("selection across checkbox and card interactions", () => {
  it("preserves the anchor across table facades and selects every intermediate row", () => {
    const fixture = selectionFixture();
    fixture.select("one");
    fixture.select("four", true);
    assert.deepEqual(fixture.selection, {
      one: true,
      two: true,
      three: true,
      four: true,
    });
  });

  it("preserves independent selections and supports a reverse range", () => {
    const fixture = selectionFixture();
    fixture.select("one");
    fixture.select("four");
    fixture.select("two", true);
    fixture.select("three", false, false);
    assert.deepEqual(fixture.selection, { one: true, two: true, four: true });
  });

  it("drops the previous range anchor when the displayed order changes", () => {
    const fixture = selectionFixture();
    fixture.select("one");
    fixture.reorder(["one", "three", "two", "four"]);
    fixture.select("four", true);
    assert.deepEqual(fixture.selection, { one: true, four: true });
  });

  it("selects only the clicked row when Shift has no anchor", () => {
    const fixture = selectionFixture();
    fixture.select("three", true);
    assert.deepEqual(fixture.selection, { three: true });
  });

  it("keeps range anchors isolated between table instances", () => {
    const first = selectionFixture();
    const second = selectionFixture();
    first.select("one");
    second.select("four", true);
    assert.deepEqual(second.selection, { four: true });
  });
});
