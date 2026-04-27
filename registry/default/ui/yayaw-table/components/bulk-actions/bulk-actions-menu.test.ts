import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Row } from "@tanstack/react-table";

import {
  executeConfirmableBulkActionWithLock,
  getBulkActionsMenuPositionMode,
  getBulkActionsMenuWrapperClassName,
  getBulkActionsMenuWrapperStyle,
  getBulkMenuStateAfterOutsideClick,
} from "./bulk-actions-menu";

const FIXED_INSET_PATTERN = /\binset-x-0\b/;
const FIXED_POSITIONING_PATTERN = /\bfixed\b/;
const ANCHORED_POSITIONING_PATTERN = /\bpx-0\b/;
const VIEWPORT_OFFSET_PATTERN = /\bbottom-6\b/;

function createSelectedRows(ids: string[]): Row<Record<string, unknown>>[] {
  return ids.map(
    (id) =>
      ({
        id,
        original: { id },
      }) as unknown as Row<Record<string, unknown>>
  );
}

describe("bulk confirmation flow", () => {
  it("anchors the menu when the table bottom is visible", () => {
    assert.equal(getBulkActionsMenuPositionMode(true), "anchored");
  });

  it("fixes the menu to the viewport when the table bottom is hidden", () => {
    assert.equal(getBulkActionsMenuPositionMode(false), "fixed");
  });

  it("uses fixed viewport classes only in fixed mode", () => {
    const anchoredClassName = getBulkActionsMenuWrapperClassName({
      positionMode: "anchored",
    });
    const fixedClassName = getBulkActionsMenuWrapperClassName({
      positionMode: "fixed",
    });

    assert.doesNotMatch(anchoredClassName, FIXED_POSITIONING_PATTERN);
    assert.match(anchoredClassName, ANCHORED_POSITIONING_PATTERN);
    assert.doesNotMatch(anchoredClassName, FIXED_INSET_PATTERN);
    assert.match(fixedClassName, FIXED_POSITIONING_PATTERN);
    assert.match(fixedClassName, FIXED_INSET_PATTERN);
    assert.match(fixedClassName, VIEWPORT_OFFSET_PATTERN);
    assert.doesNotMatch(anchoredClassName, VIEWPORT_OFFSET_PATTERN);
  });

  it("applies a viewport bottom offset only in fixed mode", () => {
    assert.deepEqual(
      getBulkActionsMenuWrapperStyle({
        positionMode: "fixed",
        viewportBottomOffset: 120,
      }),
      { bottom: 120 }
    );

    assert.equal(
      getBulkActionsMenuWrapperStyle({
        positionMode: "anchored",
        viewportBottomOffset: 120,
      }),
      undefined
    );
  });

  it("delete confirm triggers handler exactly once", async () => {
    const selectedRows = createSelectedRows(["row-1", "row-2"]);
    const lockRef = { current: false };
    let deleteCalls = 0;

    const onBulkDelete = async () => {
      deleteCalls += 1;
      await new Promise((resolve) => {
        setTimeout(resolve, 5);
      });
      return {
        clearSelection: true,
        closeMenu: true,
        success: true,
      };
    };

    const [firstRun, secondRun] = await Promise.all([
      executeConfirmableBulkActionWithLock({
        action: "delete",
        lockRef,
        onBulkDelete,
        selectedRows,
      }),
      executeConfirmableBulkActionWithLock({
        action: "delete",
        lockRef,
        onBulkDelete,
        selectedRows,
      }),
    ]);

    assert.equal(deleteCalls, 1);
    assert.equal(
      [firstRun, secondRun].filter((result) => result !== undefined).length,
      1
    );
  });

  it("copy confirm triggers handler exactly once", async () => {
    const selectedRows = createSelectedRows(["row-1", "row-2"]);
    const lockRef = { current: false };
    let copyCalls = 0;

    const onBulkCopy = async () => {
      copyCalls += 1;
      await new Promise((resolve) => {
        setTimeout(resolve, 5);
      });
      return {
        clearSelection: false,
        closeMenu: true,
        success: true,
      };
    };

    const [firstRun, secondRun] = await Promise.all([
      executeConfirmableBulkActionWithLock({
        action: "copy",
        lockRef,
        onBulkCopy,
        selectedRows,
      }),
      executeConfirmableBulkActionWithLock({
        action: "copy",
        lockRef,
        onBulkCopy,
        selectedRows,
      }),
    ]);

    assert.equal(copyCalls, 1);
    assert.equal(
      [firstRun, secondRun].filter((result) => result !== undefined).length,
      1
    );
  });

  it("outside click while dialog is open keeps pending action intact", () => {
    const nextState = getBulkMenuStateAfterOutsideClick({
      hoveredAction: "delete",
      isConfirmingAction: false,
      selectedAction: "delete",
      showConfirmation: true,
    });

    assert.equal(nextState.selectedAction, "delete");
    assert.equal(nextState.showConfirmation, true);
    assert.equal(nextState.hoveredAction, "delete");
  });
});
