import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isStandardActionAllowed,
  resolveEditFormTypeForRow,
} from "./actions-cell";

describe("resolveEditFormTypeForRow", () => {
  it("uses the row resolver before the fallback form type", () => {
    const formType = resolveEditFormTypeForRow({
      fallbackFormType: "entry",
      resolveEditFormType: (row) => `${row.modelId}-entry`,
      rowData: { id: "1", modelId: "article" },
      tableId: "cms-entries",
    });

    assert.equal(formType, "article-entry");
  });

  it("falls back to formType and then tableId", () => {
    assert.equal(
      resolveEditFormTypeForRow({
        fallbackFormType: "entry",
        rowData: { id: "1" },
        tableId: "cms-entries",
      }),
      "entry"
    );

    assert.equal(
      resolveEditFormTypeForRow({
        rowData: { id: "1" },
        tableId: "cms-entries",
      }),
      "cms-entries"
    );
  });
});

describe("isStandardActionAllowed", () => {
  it("allows rows by default and respects row-aware guards", () => {
    assert.equal(isStandardActionAllowed({ id: "1" }, undefined), true);
    assert.equal(
      isStandardActionAllowed(
        { status: "locked" },
        (row) => row.status !== "locked"
      ),
      false
    );
  });
});
