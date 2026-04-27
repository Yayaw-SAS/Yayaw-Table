import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Row } from "@tanstack/react-table";

import {
  buildRowSelectionState,
  buildBulkDeleteFeedback,
  canSelectAllRows,
  createSyntheticSelectedRows,
  executeCustomBulkDeleteHandler,
  executeBulkDeleteOperation,
  loadAllMatchingRowsForSelection,
  mergeSelectedRows,
  normalizeBulkActionResult,
  resolveBulkEditWithoutCustom,
} from "./use-bulk-actions";

describe("executeBulkDeleteOperation", () => {
  it("uses bulkDelete when available and reports full success", async () => {
    const outcome = await executeBulkDeleteOperation({
      bulkDelete: async () => ({ success: true }),
      ids: ["row-1", "row-2"],
    });

    assert.equal(outcome.mode, "bulkDelete");
    assert.equal(outcome.successCount, 2);
    assert.equal(outcome.failureCount, 0);

    const feedback = buildBulkDeleteFeedback(outcome);
    assert.equal(feedback.tone, "success");
    assert.ok(feedback.message.includes("Deleted 2 rows successfully"));
  });

  it("reports partial failure when delete fallback fails for some rows", async () => {
    const outcome = await executeBulkDeleteOperation({
      deleteOne: async (id) =>
        id === "row-2"
          ? { success: false, error: "row-2 failed" }
          : { success: true },
      ids: ["row-1", "row-2"],
    });

    assert.equal(outcome.mode, "deleteFallback");
    assert.equal(outcome.successCount, 1);
    assert.equal(outcome.failureCount, 1);
    assert.ok(outcome.errorMessages.includes("row-2 failed"));

    const feedback = buildBulkDeleteFeedback(outcome);
    assert.equal(feedback.tone, "error");
    assert.ok(feedback.message.includes("Deleted 1 of 2 rows. 1 failed."));
    assert.ok(feedback.message.includes("row-2 failed"));
  });

  it("returns a user-facing configuration message when no delete action exists", async () => {
    const outcome = await executeBulkDeleteOperation({
      ids: ["row-1"],
    });

    assert.equal(outcome.mode, "notConfigured");
    assert.equal(outcome.successCount, 0);
    assert.equal(outcome.failureCount, 1);

    const feedback = buildBulkDeleteFeedback(outcome);
    assert.equal(feedback.tone, "error");
    assert.ok(feedback.message.includes("Bulk delete is not configured"));
  });
});

describe("resolveBulkEditWithoutCustom", () => {
  it("returns an explicit message when bulkUpdate exists but no payload callback is provided", () => {
    const resolution = resolveBulkEditWithoutCustom({
      hasBulkUpdateAction: true,
    });

    assert.equal(resolution.status, "missingPayload");
    assert.ok(resolution.message.includes("actions.bulkUpdate(ids, data)"));
    assert.ok(resolution.message.includes("Provide onBulkEdit"));
  });
});

describe("normalizeBulkActionResult", () => {
  it("supports explicit bulk action contract result", () => {
    const normalized = normalizeBulkActionResult(
      {
        clearSelection: true,
        closeMenu: true,
        message: "Operation done",
        success: true,
      },
      {
        clearSelection: false,
        closeMenu: false,
        success: false,
      }
    );

    assert.equal(normalized.success, true);
    assert.equal(normalized.closeMenu, true);
    assert.equal(normalized.clearSelection, true);
    assert.equal(normalized.message, "Operation done");
  });

  it("maps legacy boolean result to explicit contract", () => {
    const normalized = normalizeBulkActionResult(true, {
      clearSelection: false,
      closeMenu: false,
      success: false,
    });

    assert.equal(normalized.success, true);
    assert.equal(normalized.closeMenu, true);
    assert.equal(normalized.clearSelection, true);
  });
});

describe("cross-page bulk selection helpers", () => {
  it("loads all matching rows across pages and builds a selection state", async () => {
    const requestedPages: number[] = [];

    const selection = await loadAllMatchingRowsForSelection<
      Record<string, unknown>
    >({
      advancedFiltersParam: [{ field: "status", isActive: true }],
      filtersParam: [{ id: "category", value: "phones" }],
      globalSearchParam: "galaxy",
      listAction: (params) => {
        requestedPages.push(params.page as number);

        assert.deepEqual(params.filters, { category: "phones" });
        assert.deepEqual(params.orderBy, { name: "asc" });
        assert.equal(params.search, "galaxy");

        if (params.page === 1) {
          return Promise.resolve({
            data: [{ id: "row-1" }, { id: "row-2" }],
            meta: { pageCount: 2, totalCount: 3 },
          });
        }

        return Promise.resolve({
          data: [{ id: "row-3" }],
          meta: { pageCount: 2, totalCount: 3 },
        });
      },
      pageSizeParam: "2",
      sortParam: [{ desc: false, id: "name" }],
    });

    assert.deepEqual(requestedPages, [1, 2]);
    assert.deepEqual(selection.rowIds, ["row-1", "row-2", "row-3"]);
    assert.equal(selection.rows.length, 3);
    assert.deepEqual(buildRowSelectionState(selection.rowIds), {
      "row-1": true,
      "row-2": true,
      "row-3": true,
    });
  });

  it("merges current-page rows over synthetic cross-page rows", () => {
    const syntheticRows = createSyntheticSelectedRows<Record<string, unknown>>([
      { id: "row-1", source: "cached" },
      { id: "row-2", source: "cached" },
    ]);
    const liveRow = {
      id: "row-2",
      original: { id: "row-2", source: "live" },
    } as unknown as Row<Record<string, unknown>>;

    const mergedRows = mergeSelectedRows({
      crossPageRows: syntheticRows,
      currentPageRows: [liveRow],
    });

    assert.equal(mergedRows.length, 2);
    const mergedRow = mergedRows.find((row) => row.id === "row-2");
    assert.deepEqual(mergedRow?.original, {
      id: "row-2",
      source: "live",
    });
  });

  it("only offers select all when more matching rows remain", () => {
    assert.equal(
      canSelectAllRows({
        hasListAction: true,
        isSelectingAll: false,
        rowCount: 50,
        selectedCount: 10,
      }),
      true
    );

    assert.equal(
      canSelectAllRows({
        hasListAction: true,
        isSelectingAll: false,
        rowCount: 10,
        selectedCount: 10,
      }),
      false
    );
  });
});

function createSelectedRows(ids: string[]): Row<Record<string, unknown>>[] {
  return ids.map(
    (id) =>
      ({
        id,
        original: { id },
      }) as unknown as Row<Record<string, unknown>>
  );
}

describe("executeCustomBulkDeleteHandler", () => {
  it("shows error feedback and keeps menu open for partial failure outcomes", async () => {
    const selectedRows = createSelectedRows(["row-1", "row-2"]);
    const notifications = { error: [] as string[], success: [] as string[] };
    let clearSelectionCalls = 0;

    const result = await executeCustomBulkDeleteHandler({
      clearSelection: () => {
        clearSelectionCalls += 1;
      },
      closeOnError: false,
      notify: {
        error: (message: string) => notifications.error.push(message),
        success: (message: string) => notifications.success.push(message),
      },
      onBulkDelete: async () => ({
        errorMessages: ["row-2 failed"],
        failureCount: 1,
        mode: "bulkDelete",
        successCount: 1,
        totalCount: 2,
      }),
      selectedRows,
      showDefaultToastsForCustomHandlers: false,
    });

    assert.equal(result.clearSelection, false);
    assert.equal(result.closeMenu, false);
    assert.equal(result.success, false);
    assert.equal(clearSelectionCalls, 0);
    assert.equal(notifications.success.length, 0);
    assert.equal(notifications.error.length, 1);
    assert.ok(notifications.error[0].includes("Deleted 1 of 2 rows. 1 failed."));
  });

  it("shows an error toast and keeps menu open when the custom handler throws", async () => {
    const selectedRows = createSelectedRows(["row-1", "row-2"]);
    const notifications = { error: [] as string[], success: [] as string[] };
    let clearSelectionCalls = 0;

    const result = await executeCustomBulkDeleteHandler({
      clearSelection: () => {
        clearSelectionCalls += 1;
      },
      closeOnError: false,
      notify: {
        error: (message: string) => notifications.error.push(message),
        success: (message: string) => notifications.success.push(message),
      },
      onBulkDelete: () => {
        throw new Error("delete failed");
      },
      selectedRows,
      showDefaultToastsForCustomHandlers: false,
    });

    assert.equal(result.clearSelection, false);
    assert.equal(result.closeMenu, false);
    assert.equal(result.success, false);
    assert.equal(clearSelectionCalls, 0);
    assert.equal(notifications.success.length, 0);
    assert.equal(notifications.error.length, 1);
    assert.equal(notifications.error[0], "delete failed");
  });

  it("shows success feedback and closes menu on success outcomes", async () => {
    const selectedRows = createSelectedRows(["row-1", "row-2"]);
    const notifications = { error: [] as string[], success: [] as string[] };
    let clearSelectionCalls = 0;

    const result = await executeCustomBulkDeleteHandler({
      clearSelection: () => {
        clearSelectionCalls += 1;
      },
      closeOnError: false,
      notify: {
        error: (message: string) => notifications.error.push(message),
        success: (message: string) => notifications.success.push(message),
      },
      onBulkDelete: async () => ({
        errorMessages: [],
        failureCount: 0,
        mode: "bulkDelete",
        successCount: 2,
        totalCount: 2,
      }),
      selectedRows,
      showDefaultToastsForCustomHandlers: false,
    });

    assert.equal(result.clearSelection, true);
    assert.equal(result.closeMenu, true);
    assert.equal(result.success, true);
    assert.equal(clearSelectionCalls, 1);
    assert.equal(notifications.error.length, 0);
    assert.equal(notifications.success.length, 1);
    assert.ok(notifications.success[0].includes("Deleted 2 rows successfully."));
  });

  it("preserves legacy custom-handler behavior when default toasts are explicitly enabled", async () => {
    const selectedRows = createSelectedRows(["row-1", "row-2"]);
    const notifications = { error: [] as string[], success: [] as string[] };
    let clearSelectionCalls = 0;

    const result = await executeCustomBulkDeleteHandler({
      clearSelection: () => {
        clearSelectionCalls += 1;
      },
      closeOnError: false,
      notify: {
        error: (message: string) => notifications.error.push(message),
        success: (message: string) => notifications.success.push(message),
      },
      onBulkDelete: () => undefined,
      selectedRows,
      showDefaultToastsForCustomHandlers: true,
    });

    assert.equal(result.clearSelection, true);
    assert.equal(result.closeMenu, true);
    assert.equal(result.success, true);
    assert.equal(clearSelectionCalls, 1);
    assert.equal(notifications.error.length, 0);
    assert.equal(notifications.success.length, 1);
    assert.ok(notifications.success[0].includes("Deleted 2 rows successfully."));
  });
});
