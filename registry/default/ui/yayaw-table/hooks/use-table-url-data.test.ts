import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveInitialTableQueryData } from "./use-table-url-data";

describe("resolveInitialTableQueryData", () => {
  it("returns undefined when no initial rows are provided", () => {
    assert.equal(
      resolveInitialTableQueryData({
        initialData: [],
      }),
      undefined
    );
  });

  it("builds an initial query result with explicit totals", () => {
    assert.deepEqual(
      resolveInitialTableQueryData({
        initialData: [{ id: "row-1" }],
        initialPageCount: 4,
        initialRowCount: 31,
      }),
      {
        data: [{ id: "row-1" }],
        pageCount: 4,
        rowCount: 31,
      }
    );
  });

  it("falls back to one page and the initial row count", () => {
    assert.deepEqual(
      resolveInitialTableQueryData({
        initialData: [{ id: "row-1" }, { id: "row-2" }],
      }),
      {
        data: [{ id: "row-1" }, { id: "row-2" }],
        pageCount: 1,
        rowCount: 2,
      }
    );
  });
});
