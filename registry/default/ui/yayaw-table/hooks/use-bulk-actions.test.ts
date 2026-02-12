import { describe, expect, it } from "bun:test";

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

    expect(outcome.mode).toBe("bulkDelete");
    expect(outcome.successCount).toBe(2);
    expect(outcome.failureCount).toBe(0);

    const feedback = buildBulkDeleteFeedback(outcome);
    expect(feedback.tone).toBe("success");
    expect(feedback.message).toContain("Deleted 2 rows successfully");
  });

  it("reports partial failure when delete fallback fails for some rows", async () => {
    const outcome = await executeBulkDeleteOperation({
      deleteOne: async (id) =>
        id === "row-2"
          ? { success: false, error: "row-2 failed" }
          : { success: true },
      ids: ["row-1", "row-2"],
    });

    expect(outcome.mode).toBe("deleteFallback");
    expect(outcome.successCount).toBe(1);
    expect(outcome.failureCount).toBe(1);
    expect(outcome.errorMessages).toContain("row-2 failed");

    const feedback = buildBulkDeleteFeedback(outcome);
    expect(feedback.tone).toBe("error");
    expect(feedback.message).toContain("Deleted 1 of 2 rows. 1 failed.");
    expect(feedback.message).toContain("row-2 failed");
  });

  it("returns a user-facing configuration message when no delete action exists", async () => {
    const outcome = await executeBulkDeleteOperation({
      ids: ["row-1"],
    });

    expect(outcome.mode).toBe("notConfigured");
    expect(outcome.successCount).toBe(0);
    expect(outcome.failureCount).toBe(1);

    const feedback = buildBulkDeleteFeedback(outcome);
    expect(feedback.tone).toBe("error");
    expect(feedback.message).toContain("Bulk delete is not configured");
  });
});

describe("resolveBulkEditWithoutCustom", () => {
  it("returns an explicit message when bulkUpdate exists but no payload callback is provided", () => {
    const resolution = resolveBulkEditWithoutCustom({
      hasBulkUpdateAction: true,
    });

    expect(resolution.status).toBe("missingPayload");
    expect(resolution.message).toContain("actions.bulkUpdate(ids, data)");
    expect(resolution.message).toContain("Provide onBulkEdit");
  });
});
