import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shouldCloseBulkActionsMenuAfterDelete } from "./bulk-actions-menu";

describe("shouldCloseBulkActionsMenuAfterDelete", () => {
  it("keeps the menu open for partial failure results", () => {
    const shouldClose = shouldCloseBulkActionsMenuAfterDelete({
      closeMenu: false,
      success: false,
    });

    assert.equal(shouldClose, false);
  });

  it("keeps the menu open when delete throws and no close result is provided", () => {
    const shouldClose = shouldCloseBulkActionsMenuAfterDelete(undefined);

    assert.equal(shouldClose, false);
  });

  it("closes the menu for successful delete results", () => {
    const shouldClose = shouldCloseBulkActionsMenuAfterDelete({
      closeMenu: true,
      success: true,
    });

    assert.equal(shouldClose, true);
  });

  it("supports legacy boolean close results", () => {
    const shouldClose = shouldCloseBulkActionsMenuAfterDelete(true);

    assert.equal(shouldClose, true);
  });
});
