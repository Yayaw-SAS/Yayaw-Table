import assert from "node:assert/strict";
import { describe, it } from "bun:test";
import {
  resolveInitialTableQueryData,
  shouldUseInitialTableQueryData,
} from "./use-table-url-data";

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

describe("shouldUseInitialTableQueryData", () => {
  it("hydrates only the first page with the configured default page size", () => {
    assert.equal(
      shouldUseInitialTableQueryData({
        defaultPageSize: 20,
        pagination: { pageIndex: 0, pageSize: 20 },
      }),
      true
    );
  });

  it("does not hydrate later pages with first-page data", () => {
    assert.equal(
      shouldUseInitialTableQueryData({
        defaultPageSize: 20,
        pagination: { pageIndex: 1, pageSize: 20 },
      }),
      false
    );
  });

  it("does not hydrate when the user changes page size", () => {
    assert.equal(
      shouldUseInitialTableQueryData({
        defaultPageSize: 20,
        pagination: { pageIndex: 0, pageSize: 50 },
      }),
      false
    );
  });

  it("does not hydrate filtered, searched, or sorted table states", () => {
    const baseState = {
      defaultPageSize: 20,
      pagination: { pageIndex: 0, pageSize: 20 },
    };

    assert.equal(
      shouldUseInitialTableQueryData({
        ...baseState,
        filtersParam: [{ id: "status", value: "published" }],
      }),
      false
    );
    assert.equal(
      shouldUseInitialTableQueryData({
        ...baseState,
        globalSearchParam: "hero",
      }),
      false
    );
    assert.equal(
      shouldUseInitialTableQueryData({
        ...baseState,
        sortParam: [{ desc: true, id: "updatedAt" }],
      }),
      false
    );
    assert.equal(
      shouldUseInitialTableQueryData({
        ...baseState,
        serverFilters: { status: "published" },
      }),
      false
    );
  });
});
