import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openCreateForm, openUpdateForm } from "./catalogue-form-atoms";

describe("catalogue form atoms", () => {
  it("stores formType separately from the parent tableId", () => {
    const createState = openCreateForm(
      "entry-create",
      "cms-entries",
      undefined,
      "content-index"
    );

    assert.equal(createState.formType, "entry-create");
    assert.equal(createState.tableId, "cms-entries");
    assert.equal(createState.tableType, "content-index");
  });

  it("keeps edit invalidation scoped to the parent tableId", () => {
    const updateState = openUpdateForm(
      "article-entry",
      "cms-entries",
      { id: "entry-1", modelId: "article" },
      undefined,
      "content-index"
    );

    assert.equal(updateState.formType, "article-entry");
    assert.equal(updateState.tableId, "cms-entries");
    assert.deepEqual(updateState.initialData, {
      id: "entry-1",
      modelId: "article",
    });
  });
});
