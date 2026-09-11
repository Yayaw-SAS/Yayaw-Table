import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Row, Table } from "@/components/ui/yayaw-table/tanstack";
import {
  getNextRowSelectionForRange,
  getRangeSelectableRows,
} from "./row-selection-range";

interface TestRowData {
  id: string;
}

const createRow = (
  id: string,
  {
    canMultiSelect = true,
    canSelect = true,
    isGrouped = false,
    subRows = [],
  }: {
    canMultiSelect?: boolean;
    canSelect?: boolean;
    isGrouped?: boolean;
    subRows?: Row<TestRowData>[];
  } = {}
): Row<TestRowData> =>
  ({
    getCanMultiSelect: () => canMultiSelect,
    getCanSelect: () => canSelect,
    getIsGrouped: () => isGrouped,
    id,
    subRows,
  }) as Row<TestRowData>;

const createTable = (flatRows: Row<TestRowData>[]): Table<TestRowData> =>
  ({
    getRowModel: () => ({ flatRows }),
  }) as Table<TestRowData>;

const createOrderedRows = (...ids: string[]): Row<TestRowData>[] =>
  ids.map((id) => createRow(id));

describe("getRangeSelectableRows", () => {
  it("keeps displayed order while excluding groups, disabled rows, single-select rows, and duplicate ids", () => {
    const firstVisibleRow = createRow("row-3");
    const groupedRow = createRow("group", {
      isGrouped: true,
      subRows: [firstVisibleRow],
    });
    const duplicateRow = createRow("row-3");
    const disabledRow = createRow("disabled", { canSelect: false });
    const singleSelectRow = createRow("single", { canMultiSelect: false });
    const lastVisibleRow = createRow("row-1");
    const table = createTable([
      groupedRow,
      firstVisibleRow,
      duplicateRow,
      disabledRow,
      singleSelectRow,
      lastVisibleRow,
    ]);

    const rows = getRangeSelectableRows(table);

    assert.deepEqual(
      rows.map((row) => row.id),
      ["row-3", "row-1"]
    );
    assert.equal(rows[0], firstVisibleRow);
  });

  it("keeps selectable tree rows that have children but are not grouping rows", () => {
    const childRow = createRow("child");
    const treeRow = createRow("parent", { subRows: [childRow] });

    const rows = getRangeSelectableRows(createTable([treeRow, childRow]));

    assert.deepEqual(
      rows.map((row) => row.id),
      ["parent", "child"]
    );
  });
});

describe("getNextRowSelectionForRange", () => {
  it("selects a forward range inclusively and preserves selections outside it", () => {
    const rows = createOrderedRows("row-0", "row-1", "row-2", "row-3");

    const selection = getNextRowSelectionForRange({
      anchorRowId: "row-1",
      isSelected: true,
      rowSelection: { "outside-row": true },
      rows,
      targetRowId: "row-3",
    });

    assert.deepEqual(selection, {
      "outside-row": true,
      "row-1": true,
      "row-2": true,
      "row-3": true,
    });
  });

  it("selects an inclusive range in reverse", () => {
    const rows = createOrderedRows("row-0", "row-1", "row-2", "row-3", "row-4");

    const selection = getNextRowSelectionForRange({
      anchorRowId: "row-4",
      isSelected: true,
      rowSelection: {},
      rows,
      targetRowId: "row-1",
    });

    assert.deepEqual(selection, {
      "row-1": true,
      "row-2": true,
      "row-3": true,
      "row-4": true,
    });
  });

  it("uses the supplied displayed order instead of deriving order from row ids", () => {
    const rows = createOrderedRows("row-3", "row-1", "row-4", "row-2");

    const selection = getNextRowSelectionForRange({
      anchorRowId: "row-1",
      isSelected: true,
      rowSelection: {},
      rows,
      targetRowId: "row-2",
    });

    assert.deepEqual(selection, {
      "row-1": true,
      "row-2": true,
      "row-4": true,
    });
  });

  it("removes deselected range keys, preserves outside selections, and does not mutate the input", () => {
    const rows = createOrderedRows("row-0", "row-1", "row-2", "row-3", "row-4");
    const rowSelection = {
      "outside-row": true,
      "row-0": true,
      "row-1": true,
      "row-2": true,
      "row-3": true,
      "row-4": true,
    };

    const selection = getNextRowSelectionForRange({
      anchorRowId: "row-1",
      isSelected: false,
      rowSelection,
      rows,
      targetRowId: "row-3",
    });

    assert.deepEqual(selection, {
      "outside-row": true,
      "row-0": true,
      "row-4": true,
    });
    assert.deepEqual(rowSelection, {
      "outside-row": true,
      "row-0": true,
      "row-1": true,
      "row-2": true,
      "row-3": true,
      "row-4": true,
    });
  });

  it("returns undefined when the anchor or target is absent", () => {
    const rows = createOrderedRows("row-1", "row-2", "row-3");

    assert.equal(
      getNextRowSelectionForRange({
        anchorRowId: "missing-anchor",
        isSelected: true,
        rowSelection: {},
        rows,
        targetRowId: "row-3",
      }),
      undefined
    );
    assert.equal(
      getNextRowSelectionForRange({
        anchorRowId: "row-1",
        isSelected: true,
        rowSelection: {},
        rows,
        targetRowId: "missing-target",
      }),
      undefined
    );
  });
});
