import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Row } from "@tanstack/react-table";

import {
  executeConfirmableBulkActionWithLock,
  getBulkMenuStateAfterOutsideClick,
} from "./bulk-actions-menu";

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
