import { describe, expect, it } from "vitest";
import bulkEditorCases from "../../../tests/fixtures/bulk-editor.json";
import { bulkClearCandidate } from "./bulk-editor";
import { bulkCompletion, commonBulkValues } from "./bulk-form";

describe("bulk draft helpers", () => {
  it("clones only common values including nested arrays and dates", () => {
    const first = {
      name: "Alpha",
      tags: [1],
      active: false,
      amount: 0,
      date: new Date("2026-01-01"),
    };
    const common = commonBulkValues([
      first,
      { ...first, name: "Beta", tags: [1] },
    ]);
    expect(common).toEqual({
      tags: [1],
      active: false,
      amount: 0,
      date: first.date,
    });
    expect(common.tags).not.toBe(first.tags);
    expect(common.date).not.toBe(first.date);
    expect(commonBulkValues([])).toEqual({});
  });
  it("only clears targets with a trustworthy completion report", () => {
    expect(
      bulkCompletion(["1", "2"], { success: false, failedIds: ["2"] })
    ).toEqual({ completed: ["1"], remaining: ["2"] });
    for (const failedIds of [undefined, [], ["other"]]) {
      expect(bulkCompletion(["1", "2"], { success: false, failedIds })).toEqual(
        { completed: [], remaining: ["1", "2"] }
      );
    }
    expect(bulkCompletion(["1"], { success: true })).toEqual({
      completed: ["1"],
      remaining: [],
    });
  });
});

for (const scenario of bulkEditorCases) {
  it(`offers an explicit clear for ${scenario.type}, required=${Boolean(scenario.required)}`, () => {
    const result = bulkClearCandidate(scenario);
    expect(result).toEqual(
      scenario.unsupported ? undefined : { value: scenario.value }
    );
  });
}
