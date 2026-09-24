import assert from "node:assert/strict";
import { describe, it } from "bun:test";
import {
  resolveInitialTableQueryData,
  resolveInitialTableRowsUse,
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

  it("hydrates the table's configured sort, where it starts", () => {
    const configuredSorting = [{ desc: true, id: "updatedAt" }];
    assert.equal(
      shouldUseInitialTableQueryData({
        configuredSorting,
        defaultPageSize: 20,
        pagination: { pageIndex: 0, pageSize: 20 },
        sortParam: [{ id: "updatedAt", desc: true }],
      }),
      true
    );
  });
});

describe("resolveInitialTableRowsUse", () => {
  const firstPage = {
    defaultPageSize: 20,
    pagination: { pageIndex: 0, pageSize: 20 },
  };
  const configuredSorting = [{ desc: true, id: "updatedAt" }];

  it("shows the rows under the configured sort, then loads them again in it", () => {
    assert.equal(
      resolveInitialTableRowsUse({
        ...firstPage,
        configuredSorting,
        sortParam: configuredSorting,
      }),
      "placeholder"
    );
  });

  it("keeps rows the host says it produced in the starting sort", () => {
    assert.equal(
      resolveInitialTableRowsUse({
        ...firstPage,
        configuredSorting,
        initialDataSort: configuredSorting,
        sortParam: [{ id: "updatedAt", desc: true }],
      }),
      "current"
    );
  });

  it("keeps the rows of a table without a sort, as before", () => {
    assert.equal(resolveInitialTableRowsUse(firstPage), "current");
    assert.equal(
      resolveInitialTableRowsUse({
        ...firstPage,
        configuredSorting: [],
        sortParam: [],
      }),
      "current"
    );
  });

  it("loads rows produced in another sort again", () => {
    assert.equal(
      resolveInitialTableRowsUse({
        ...firstPage,
        initialDataSort: configuredSorting,
        sortParam: [],
      }),
      "placeholder"
    );
  });

  it("leaves rows made for another sort, page, filter or search", () => {
    const configuredState = {
      ...firstPage,
      configuredSorting,
      sortParam: configuredSorting,
    };
    assert.equal(
      resolveInitialTableRowsUse({
        ...configuredState,
        sortParam: [{ desc: false, id: "updatedAt" }],
      }),
      "unused"
    );
    assert.equal(
      resolveInitialTableRowsUse({
        ...configuredState,
        pagination: { pageIndex: 1, pageSize: 20 },
      }),
      "unused"
    );
    assert.equal(
      resolveInitialTableRowsUse({
        ...configuredState,
        filtersParam: [{ id: "status", value: "published" }],
      }),
      "unused"
    );
    assert.equal(
      resolveInitialTableRowsUse({
        ...configuredState,
        globalSearchParam: "hero",
      }),
      "unused"
    );
  });
});
