import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildBulkDeleteFeedback,
  executeBulkDeleteOperation,
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
