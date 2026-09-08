import { describe, expect, it } from "vitest";
import cases from "../../../tests/fixtures/auto-page-size.json";
import { fitPageSize } from "./auto-page-size";

describe("automatic pagination capacity", () => {
  for (const test of cases) {
    it(`fits ${test.expected} rows into ${test.availableHeight}px at ${test.rowHeight}px per row`, () => {
      expect(fitPageSize(test.availableHeight, test.rowHeight)).toBe(
        test.expected
      );
    });
  }
  it("rejects non-finite geometry without sending an invalid server page size", () => {
    expect(fitPageSize(Number.NaN, 40)).toBe(1);
    expect(fitPageSize(400, Number.POSITIVE_INFINITY)).toBe(1);
  });
});
