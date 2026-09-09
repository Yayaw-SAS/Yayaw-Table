import { describe, expect, it } from "bun:test";
import {
  detailExampleRow,
  recordActivity,
  recordDetailsConfig,
  recordSections,
  revertExampleRecord,
  updateExampleRecord,
} from "../../../../../examples/record-details";
import {
  type DetailField,
  detailActivity,
  detailDate,
  detailDisplay,
  detailHref,
  detailLabels,
  detailSections,
  detailValue,
} from "./record-details";
import { TABLE_DATA_TYPES } from "./table-contracts";

const labels = detailLabels("fr");
const field: DetailField = { id: "value", label: "Value" };

describe("record detail values", () => {
  it("undoes by appending an inverse event while preserving the original and blocking repeat or conflicting undo", () => {
    const original = structuredClone(detailExampleRow);
    const change = recordActivity[0];
    if (!change) {
      throw new Error("Missing demo event");
    }
    const restored = revertExampleRecord(original, change);
    expect(restored.budget).toBe(12_000);
    expect(restored.status).toBe("draft");
    const history = detailActivity(recordDetailsConfig, restored);
    expect(history).toHaveLength(recordActivity.length + 1);
    expect(history[0]?.reverts).toBe(change.id);
    expect(history.find((entry) => entry.id === change.id)).toEqual(change);
    expect(original.budget).toBe(15_000);
    expect(() => revertExampleRecord(restored, change)).toThrow();
    const newer = updateExampleRecord(original, { budget: 20_000 });
    expect(() => revertExampleRecord(newer, change)).toThrow();
  });
  it("covers every table data type except the action control", () => {
    const types = new Set(
      recordSections.flatMap((section) =>
        section.fields.map((item) => item.type)
      )
    );
    for (const type of Object.keys(TABLE_DATA_TYPES)) {
      if (type !== "actions") {
        expect(types.has(type as DetailField["type"])).toBe(true);
      }
    }
  });
  it("preserves false, zero, primitive option identity, and full collection data", () => {
    expect(
      detailDisplay({ ...field, type: "boolean" }, false, {}, "fr", labels)
        .items?.[0]?.text
    ).toBe("Non");
    expect(
      detailDisplay({ ...field, type: "number" }, 0, {}, "fr", labels).text
    ).toBe("0");
    const select: DetailField = {
      ...field,
      type: "multiSelect",
      options: [
        { value: 1, label: "Number one" },
        { value: "1", label: "String one" },
        { value: false, label: "False" },
      ],
    };
    expect(
      detailDisplay(select, [1, "1", false], {}, "fr", labels).items?.map(
        (item) => item.text
      )
    ).toEqual(["Number one", "String one", "False"]);
    expect(
      detailDisplay(
        { ...field, type: "collection" },
        [{ name: "A", count: 0 }],
        {},
        "en",
        labels
      ).items?.[0]?.text
    ).toContain('"count": 0');
  });
  it("masks passwords and never activates unsafe links or images", () => {
    expect(
      detailDisplay({ ...field, type: "password" }, "secret", {}, "en", labels)
        .text
    ).toBe("••••••••");
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,test",
      "file:///etc/passwd",
    ]) {
      expect(detailHref(url)).toBeUndefined();
      expect(
        detailDisplay({ ...field, type: "image" }, url, {}, "en", labels).kind
      ).toBe("text");
    }
  });
  it("resolves dotted values and excludes explicitly hidden fields from the projection", () => {
    expect(
      detailValue(
        { nested: { name: "Example" } },
        { ...field, accessorKey: "nested.name" }
      )
    ).toBe("Example");
    expect(
      detailValue(
        { "nested.name": "Literal" },
        { ...field, accessorKey: "nested.name" }
      )
    ).toBe("Literal");
    expect(
      detailSections(
        {
          sections: [
            {
              id: "private",
              title: "Private",
              fields: [{ ...field, hidden: () => true }],
            },
          ],
        },
        [],
        {},
        "Details"
      )
    ).toEqual([]);
  });
  it("formats calendar dates and leaves supplied audit data unmodified", () => {
    expect(detailDate("2026-09-22", "en-US")).toBe("Sep 22, 2026");
    expect(detailDate("invalid", "en-US")).toBe("invalid");
    const events = [
      { id: "old", at: "2026-01-01", actor: { name: "A" }, action: "created" },
      { id: "new", at: "2026-09-09", actor: { name: "B" }, action: "updated" },
    ];
    expect(
      detailActivity({ activity: () => events }, {}).map((item) => item.id)
    ).toEqual(["new", "old"]);
    expect(events[0]?.id).toBe("old");
  });
});
