import assert from "node:assert/strict";
import { describe, it } from "bun:test";
import { resolveTablePageCount } from "./use-table-instance";

describe("resolveTablePageCount", () => {
  it("keeps the server page count when the current page has fewer rows", () => {
    assert.equal(
      resolveTablePageCount({
        dataLength: 10,
        pageCount: 5,
        pageSize: 10,
      }),
      5
    );
  });

  it("falls back to the loaded rows when no server page count is available", () => {
    assert.equal(
      resolveTablePageCount({
        dataLength: 10,
        pageSize: 10,
      }),
      1
    );
  });

  it("returns zero pages when the table is empty", () => {
    assert.equal(
      resolveTablePageCount({
        dataLength: 0,
        pageCount: 0,
        pageSize: 10,
      }),
      0
    );
  });
});
