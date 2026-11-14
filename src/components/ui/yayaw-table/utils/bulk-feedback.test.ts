import { describe, it } from "bun:test";
import assert from "node:assert/strict";
import {
  buildBulkDeleteFeedback,
  executeBulkCopyAction,
  executeBulkDeleteOperation,
} from "../hooks/use-bulk-actions";
import {
  bulkFeedbackMessages,
  countedBulkFeedback,
  formatBulkFeedback,
  resolveBulkFeedbackMessages,
} from "./bulk-feedback";

describe("bulk feedback messages", () => {
  it("says a full delete in French", async () => {
    const messages = bulkFeedbackMessages("fr-FR");
    const outcome = await executeBulkDeleteOperation({
      bulkDelete: async () => ({ success: true }),
      ids: ["a", "b", "c", "d", "e", "f"],
      messages,
    });

    const feedback = buildBulkDeleteFeedback(outcome, messages);
    assert.equal(feedback.tone, "success");
    assert.equal(feedback.message, "6 lignes supprimées.");
  });

  it("says a single row and a partial delete in French", async () => {
    const messages = bulkFeedbackMessages("fr");
    assert.equal(
      buildBulkDeleteFeedback(
        {
          errorMessages: [],
          failureCount: 0,
          mode: "bulkDelete",
          successCount: 1,
          totalCount: 1,
        },
        messages
      ).message,
      "1 ligne supprimée."
    );

    const outcome = await executeBulkDeleteOperation({
      deleteOne: async (id) =>
        id === "b" ? { success: false } : { success: true },
      ids: ["a", "b"],
      messages,
    });
    assert.equal(
      buildBulkDeleteFeedback(outcome, messages).message,
      "Lignes supprimées : 1 sur 2, 1 en échec. Impossible de supprimer la ligne « b »."
    );
  });

  it("says a copy in French", async () => {
    const result = await executeBulkCopyAction({
      bulkCopy: async () => ({ success: true }),
      ids: ["a", "b"],
      messages: bulkFeedbackMessages("fr"),
    });
    assert.equal(result.message, "2 lignes copiées.");
  });

  it("keeps English as the default and for other locales", () => {
    assert.equal(
      countedBulkFeedback(
        bulkFeedbackMessages("de").deletedOne,
        bulkFeedbackMessages("de").deletedMany,
        6
      ),
      "Deleted 6 rows successfully."
    );
  });

  it("applies host overrides and ignores blank ones", () => {
    const messages = resolveBulkFeedbackMessages("fr", {
      copyError: "  ",
      deletedMany: "{count} fiches supprimées.",
    });
    assert.equal(
      formatBulkFeedback(messages.deletedMany, { count: 3 }),
      "3 fiches supprimées."
    );
    assert.equal(
      messages.copyError,
      bulkFeedbackMessages("fr").copyError
    );
  });

  it("leaves unknown placeholders untouched", () => {
    assert.equal(formatBulkFeedback("{count} / {x}", { count: 2 }), "2 / {x}");
  });
});
