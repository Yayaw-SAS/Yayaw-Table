import assert from "node:assert/strict";
import { describe, it } from "bun:test";
import {
  fromInternalColumnPinning,
  toInternalColumnPinning,
} from "./tanstack";

describe("TanStack Table v9 compatibility", () => {
  it("keeps persisted left/right pinning compatible", () => {
    const persisted = {
      left: ["select", "name"],
      right: ["actions"],
    };

    assert.deepEqual(toInternalColumnPinning(persisted), {
      start: ["select", "name"],
      end: ["actions"],
    });
    assert.deepEqual(
      fromInternalColumnPinning(toInternalColumnPinning(persisted)),
      persisted
    );
  });

  it("normalizes missing pinning groups", () => {
    assert.deepEqual(toInternalColumnPinning(), { start: [], end: [] });
    assert.deepEqual(fromInternalColumnPinning(), { left: [], right: [] });
  });
});
