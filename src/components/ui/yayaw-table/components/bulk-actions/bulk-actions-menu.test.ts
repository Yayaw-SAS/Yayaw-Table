import assert from "node:assert/strict";
import { describe, it } from "bun:test";
import type { Row } from "@/components/ui/yayaw-table/tanstack";

import {
  applyCustomBulkActionResult,
  buildBulkActionsMenuActionTabs,
  createBulkActionContext,
  executeCustomBulkAction,
  executeConfirmableBulkActionWithLock,
  getBulkActionsMenuPositionMode,
  getBulkActionsMenuWrapperClassName,
  getBulkActionsMenuWrapperStyle,
  getBulkMenuStateAfterOutsideClick,
  shouldRenderBulkActionsMenu,
  type BulkAction,
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

function TestIcon(_props: { className?: string; size?: number }) {
  return null;
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

describe("custom bulk actions", () => {
  it("renders custom actions between export and delete when rows are selected", () => {
    const selectedRows = createSelectedRows(["row-1", "row-2"]);
    const tabs = buildBulkActionsMenuActionTabs({
      canSelectAll: false,
      customBulkActions: [
        {
          id: "publish",
          icon: TestIcon,
          label: "Publish",
          onClick: () => undefined,
        },
      ],
      isSelectingAll: false,
      selectedRows,
      showBulkDelete: true,
      showBulkEdit: true,
      showBulkExport: true,
    });

    assert.equal(shouldRenderBulkActionsMenu(selectedRows), true);
    assert.deepEqual(
      tabs.map((tab) => (tab.kind === "custom" ? tab.label : tab.id)),
      ["edit", "copy", "export", "Publish", "delete"]
    );
  });

  it("does not run disabled custom actions", async () => {
    const selectedRows = createSelectedRows(["row-1"]);
    const context = createBulkActionContext(selectedRows);
    let callCount = 0;
    const action: BulkAction<Record<string, unknown>> = {
      disabled: true,
      icon: TestIcon,
      id: "archive",
      label: "Archive",
      onClick: () => {
        callCount += 1;
      },
    };

    const result = await executeCustomBulkAction({ action, context });

    assert.equal(result, undefined);
    assert.equal(callCount, 0);
  });

  it("passes selected rows, original rows, and count to custom actions", async () => {
    const selectedRows = createSelectedRows(["row-1", "row-2"]);
    const context = createBulkActionContext(selectedRows);
    let receivedContext:
      | Parameters<BulkAction<Record<string, unknown>>["onClick"]>[0]
      | undefined;
    const action: BulkAction<Record<string, unknown>> = {
      icon: TestIcon,
      id: "publish",
      label: "Publish",
      onClick: (ctx) => {
        receivedContext = ctx;
      },
    };

    await executeCustomBulkAction({ action, context });

    assert.equal(receivedContext?.selectedRows, selectedRows);
    assert.deepEqual(receivedContext?.selectedOriginalRows, [
      { id: "row-1" },
      { id: "row-2" },
    ]);
    assert.equal(receivedContext?.selectedCount, 2);
  });

  it("applies closeMenu and clearSelection from BulkActionResult independently", () => {
    let clearSelectionCount = 0;
    let dismissMenuCount = 0;

    applyCustomBulkActionResult({
      onClearSelection: () => {
        clearSelectionCount += 1;
      },
      onDismissMenu: () => {
        dismissMenuCount += 1;
      },
      result: {
        clearSelection: true,
        closeMenu: false,
        success: true,
      },
    });

    applyCustomBulkActionResult({
      onClearSelection: () => {
        clearSelectionCount += 1;
      },
      onDismissMenu: () => {
        dismissMenuCount += 1;
      },
      result: {
        clearSelection: false,
        closeMenu: true,
        success: true,
      },
    });

    assert.equal(clearSelectionCount, 1);
    assert.equal(dismissMenuCount, 1);
  });
});
