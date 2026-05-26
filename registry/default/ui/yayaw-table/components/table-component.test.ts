import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getBulkActionsViewportBottomOffset,
  isRowIdActive,
  resolveEffectiveRowClickMode,
  shouldRenderBulkActionsInFooter,
  shouldRenderPaginationControls,
  shouldRenderTableEmptyState,
  shouldShowCalculationsFooter,
} from "./table-component";

describe("shouldShowCalculationsFooter", () => {
  it("returns true when footer toggle is on and calculations are enabled", () => {
    assert.equal(
      shouldShowCalculationsFooter({
        enableCalculations: true,
        isFooterVisible: true,
      }),
      true
    );
  });

  it("returns false when footer toggle is off", () => {
    assert.equal(
      shouldShowCalculationsFooter({
        enableCalculations: true,
        isFooterVisible: false,
      }),
      false
    );
  });

  it("returns false when calculations feature is disabled", () => {
    assert.equal(
      shouldShowCalculationsFooter({
        enableCalculations: false,
        isFooterVisible: true,
      }),
      false
    );
  });

  it("returns false when calculations feature is omitted", () => {
    assert.equal(
      shouldShowCalculationsFooter({
        isFooterVisible: true,
      }),
      false
    );
  });
});

describe("shouldRenderBulkActionsInFooter", () => {
  it("returns true when pagination is enabled and the table footer is visible", () => {
    assert.equal(
      shouldRenderBulkActionsInFooter({
        enablePagination: true,
        isTableBottomVisible: true,
      }),
      true
    );
  });

  it("returns false when the footer anchor is outside the viewport", () => {
    assert.equal(
      shouldRenderBulkActionsInFooter({
        enablePagination: true,
        isTableBottomVisible: false,
      }),
      false
    );
  });

  it("returns false when pagination is disabled", () => {
    assert.equal(
      shouldRenderBulkActionsInFooter({
        enablePagination: false,
        isTableBottomVisible: true,
      }),
      false
    );
  });
});

describe("shouldRenderPaginationControls", () => {
  it("returns false when total rows are below the page size", () => {
    assert.equal(
      shouldRenderPaginationControls({
        enablePagination: true,
        pageCount: 1,
        pageSize: 10,
        rowCount: 5,
      }),
      false
    );
  });

  it("returns false when total rows equal the page size", () => {
    assert.equal(
      shouldRenderPaginationControls({
        enablePagination: true,
        pageCount: 1,
        pageSize: 10,
        rowCount: 10,
      }),
      false
    );
  });

  it("returns true when total rows exceed the page size", () => {
    assert.equal(
      shouldRenderPaginationControls({
        enablePagination: true,
        pageCount: 2,
        pageSize: 10,
        rowCount: 11,
      }),
      true
    );
  });

  it("falls back to page count when total rows are unavailable", () => {
    assert.equal(
      shouldRenderPaginationControls({
        enablePagination: true,
        pageCount: 2,
        pageSize: 10,
      }),
      true
    );
  });

  it("returns false when pagination is disabled", () => {
    assert.equal(
      shouldRenderPaginationControls({
        enablePagination: false,
        pageCount: 2,
        pageSize: 10,
        rowCount: 20,
      }),
      false
    );
  });
});

describe("getBulkActionsViewportBottomOffset", () => {
  it("adds the pagination height when pagination is visible", () => {
    assert.equal(
      getBulkActionsViewportBottomOffset({
        isPaginationVisible: true,
        paginationHeight: 72,
      }),
      96
    );
  });

  it("keeps only the viewport margin when pagination is hidden", () => {
    assert.equal(
      getBulkActionsViewportBottomOffset({
        isPaginationVisible: false,
        paginationHeight: 72,
      }),
      24
    );
  });
});

describe("shouldRenderTableEmptyState", () => {
  it("renders when the table is loaded and has no rows", () => {
    assert.equal(
      shouldRenderTableEmptyState({
        dataLength: 0,
        isError: false,
        isLoading: false,
        rowCount: 0,
      }),
      true
    );
  });

  it("does not render while loading or when disabled", () => {
    assert.equal(
      shouldRenderTableEmptyState({
        dataLength: 0,
        isError: false,
        isLoading: true,
        rowCount: 0,
      }),
      false
    );
    assert.equal(
      shouldRenderTableEmptyState({
        dataLength: 0,
        isError: false,
        isLoading: false,
        rowCount: 0,
        showEmptyState: false,
      }),
      false
    );
  });

  it("falls back to data length when row count is unavailable", () => {
    assert.equal(
      shouldRenderTableEmptyState({
        dataLength: 1,
        isError: false,
        isLoading: false,
      }),
      false
    );
  });
});

describe("isRowIdActive", () => {
  it("matches active rows by table row id or original id", () => {
    assert.equal(
      isRowIdActive({
        activeRowId: "row-1",
        rowId: "row-1",
      }),
      true
    );
    assert.equal(
      isRowIdActive({
        activeRowId: "entity-1",
        rowId: "0",
        rowOriginal: { id: "entity-1" },
      }),
      true
    );
  });

  it("returns false when no active row id is provided", () => {
    assert.equal(
      isRowIdActive({
        rowId: "row-1",
      }),
      false
    );
  });
});

describe("resolveEffectiveRowClickMode", () => {
  it("preserves explicit row click modes", () => {
    assert.equal(
      resolveEffectiveRowClickMode({
        configuredMode: "activate",
        hasRowLink: true,
        isRowClickEditEnabled: true,
      }),
      "activate"
    );
  });

  it("keeps legacy edit and row-link behavior by default", () => {
    assert.equal(
      resolveEffectiveRowClickMode({
        hasRowLink: true,
        isRowClickEditEnabled: true,
      }),
      "edit"
    );
    assert.equal(
      resolveEffectiveRowClickMode({
        hasRowLink: true,
        isRowClickEditEnabled: false,
      }),
      "link"
    );
    assert.equal(
      resolveEffectiveRowClickMode({
        hasRowLink: false,
        isRowClickEditEnabled: false,
      }),
      "none"
    );
  });
});
