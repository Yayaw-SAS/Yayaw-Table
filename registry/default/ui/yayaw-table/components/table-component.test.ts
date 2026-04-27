import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getBulkActionsViewportBottomOffset,
  shouldRenderBulkActionsInFooter,
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
