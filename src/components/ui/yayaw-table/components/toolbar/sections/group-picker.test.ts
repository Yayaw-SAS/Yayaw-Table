import assert from "node:assert/strict";
import { describe, it } from "bun:test";
import { shouldShowGroupStackControls } from "./group-picker";

describe("shouldShowGroupStackControls", () => {
  it("hides stack controls when grouping is limited to one level", () => {
    assert.equal(shouldShowGroupStackControls(1), false);
  });

  it("keeps stack controls when several grouping levels are allowed", () => {
    assert.equal(shouldShowGroupStackControls(2), true);
  });
});
