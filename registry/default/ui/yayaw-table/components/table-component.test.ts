import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldShowCalculationsFooter } from "./table-component";

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
