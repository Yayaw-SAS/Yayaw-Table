import { describe, expect, it } from "vitest";
import { fromInternalColumnPinning, toInternalColumnPinning } from "./tanstack";

describe("TanStack Table v9 compatibility", () => {
  it("keeps persisted left/right pinning compatible", () => {
    const persisted = {
      left: ["select", "name"],
      right: ["actions"],
    };

    expect(toInternalColumnPinning(persisted)).toEqual({
      start: ["select", "name"],
      end: ["actions"],
    });
    expect(
      fromInternalColumnPinning(toInternalColumnPinning(persisted))
    ).toEqual(persisted);
  });

  it("normalizes missing pinning groups", () => {
    expect(toInternalColumnPinning()).toEqual({ start: [], end: [] });
    expect(fromInternalColumnPinning()).toEqual({ left: [], right: [] });
  });
});
