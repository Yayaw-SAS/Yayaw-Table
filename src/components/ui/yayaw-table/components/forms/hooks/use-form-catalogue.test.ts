import assert from "node:assert/strict";
import { describe, it } from "bun:test";
import {
  createFormConfigContext,
  resolveFormConfigMode,
} from "./use-form-catalogue";

describe("resolveFormConfigMode", () => {
  it("maps update mode to edit form config mode", () => {
    assert.equal(resolveFormConfigMode("create"), "create");
    assert.equal(resolveFormConfigMode("update"), "edit");
  });
});

describe("createFormConfigContext", () => {
  it("keeps tableId, tableType, and formType separate", () => {
    const context = createFormConfigContext<Record<string, unknown>>({
      formType: "article-entry",
      initialData: { id: "entry-1", modelId: "article" },
      mode: "update",
      tableId: "cms-entries",
      tableType: "content-index",
      values: { modelId: "article", title: "Hello" },
    });

    assert.equal(context.mode, "edit");
    assert.equal(context.tableId, "cms-entries");
    assert.equal(context.tableType, "content-index");
    assert.equal(context.formType, "article-entry");
    assert.deepEqual(context.row, { id: "entry-1", modelId: "article" });
    assert.deepEqual(context.values, { modelId: "article", title: "Hello" });
  });
});
