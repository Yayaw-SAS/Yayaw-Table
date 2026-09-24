import assert from "node:assert/strict";
import { describe, it } from "bun:test";
import { calculateColumn } from "./column-calculations";

describe("calculateColumn", () => {
  it("computes count and percent families", () => {
    const values = [1, "", null, "abc", undefined, 1];

    assert.deepEqual(calculateColumn(values, "count_all"), {
      raw: 6,
      label: "6",
    });
    assert.deepEqual(calculateColumn(values, "count_values"), {
      raw: 3,
      label: "3",
    });
    assert.deepEqual(calculateColumn(values, "count_unique"), {
      raw: 2,
      label: "2",
    });
    assert.deepEqual(calculateColumn(values, "count_empty"), {
      raw: 3,
      label: "3",
    });
    assert.deepEqual(calculateColumn(values, "count_not_empty"), {
      raw: 3,
      label: "3",
    });
    assert.deepEqual(calculateColumn(values, "percent_empty"), {
      raw: 50,
      label: "50%",
    });
    assert.deepEqual(calculateColumn(values, "percent_not_empty"), {
      raw: 50,
      label: "50%",
    });
  });

  it("computes numeric aggregations from numeric strings", () => {
    const values = ["1", 2, "3", "not-a-number", null, undefined];

    assert.deepEqual(calculateColumn(values, "sum", "number", "en-US"), {
      raw: 6,
      label: "6",
    });
    assert.deepEqual(calculateColumn(values, "average", "number", "en-US"), {
      raw: 2,
      label: "2",
    });
    assert.deepEqual(calculateColumn(values, "median", "number", "en-US"), {
      raw: 2,
      label: "2",
    });
    assert.deepEqual(calculateColumn(values, "min", "number", "en-US"), {
      raw: 1,
      label: "1",
    });
    assert.deepEqual(calculateColumn(values, "max", "number", "en-US"), {
      raw: 3,
      label: "3",
    });
    assert.deepEqual(calculateColumn(values, "range", "number", "en-US"), {
      raw: 2,
      label: "2",
    });
  });

  it("computes boolean-specific counts and percentages", () => {
    const values = [true, false, true, "", null, undefined];

    assert.deepEqual(calculateColumn(values, "count_true", "boolean"), {
      raw: 2,
      label: "2",
    });
    assert.deepEqual(calculateColumn(values, "count_false", "boolean"), {
      raw: 1,
      label: "1",
    });
    assert.deepEqual(calculateColumn(values, "percent_true", "boolean"), {
      raw: 33,
      label: "33%",
    });
    assert.deepEqual(calculateColumn(values, "percent_false", "boolean"), {
      raw: 17,
      label: "17%",
    });
  });

  it("returns explicit empty numeric results when no numeric value is available", () => {
    const values = ["", null, undefined, "abc"];

    assert.deepEqual(calculateColumn(values, "sum", "number", "en-US"), {
      raw: null,
      label: "—",
    });
    assert.deepEqual(calculateColumn(values, "average", "number", "en-US"), {
      raw: null,
      label: "—",
    });
  });

  it("computes date min/max/range and ignores invalid dates", () => {
    const first = "2024-01-01T12:00:00Z";
    const second = "2024-01-04T12:00:00Z";
    const values = [first, second, "invalid-date", "", null];

    const minResult = calculateColumn(values, "min", "date", "en-US");
    const maxResult = calculateColumn(values, "max", "date", "en-US");
    const rangeResult = calculateColumn(values, "range", "date", "en-US");

    assert.equal(minResult.raw, new Date(first).getTime());
    assert.equal(maxResult.raw, new Date(second).getTime());
    assert.equal(rangeResult.raw, 3);
    assert.equal(rangeResult.label, "3d");

    assert.equal(minResult.label.length > 0, true);
    assert.equal(maxResult.label.length > 0, true);
  });

  it("returns empty date results for invalid date-only data", () => {
    const values = ["not-a-date", "", null, undefined];

    assert.deepEqual(calculateColumn(values, "min", "date", "en-US"), {
      raw: null,
      label: "—",
    });
    assert.deepEqual(calculateColumn(values, "range", "date", "en-US"), {
      raw: null,
      label: "—",
    });
  });

  it("handles empty inputs for percent calculations", () => {
    const values: unknown[] = [];

    assert.deepEqual(calculateColumn(values, "percent_empty"), {
      raw: 0,
      label: "0%",
    });
    assert.deepEqual(calculateColumn(values, "percent_not_empty"), {
      raw: 0,
      label: "0%",
    });
  });

  it("reads sums, averages and extremes in the column's format; counts stay plain", () => {
    const amount = {
      numberFormat: { style: "currency" as const, currency: "EUR" },
    };
    assert.deepEqual(
      calculateColumn([2499, 1200.5, 350], "sum", "number", "en-US", amount),
      { raw: 4049.5, label: "€4,049.50" }
    );
    assert.equal(
      calculateColumn(
        [0.45, 0.8, 0.1],
        "average",
        "number",
        "fr-FR",
        { numberFormat: { style: "percent" as const } }
      ).label.replace(/[  ]/g, " "),
      "45 %"
    );
    assert.deepEqual(
      calculateColumn([2499, 1200.5], "count_values", "number", "en-US", amount),
      { raw: 2, label: "2" }
    );
    const due = {
      dateFormat: "dd/MM/yyyy HH:mm",
      timeZone: "Europe/Paris",
    };
    const values = ["2026-09-05T22:30:00Z", "2026-09-15T12:00:00Z"];
    assert.equal(
      calculateColumn(values, "min", "date", "en-US", due).label,
      "06/09/2026 00:30"
    );
    assert.equal(
      calculateColumn(values, "max", "date", "en-US", due).label,
      "15/09/2026 14:00"
    );
    // Calendar days stay the day stored, whatever the zone.
    assert.equal(
      calculateColumn(
        ["2026-01-02", "2026-01-09"],
        "min",
        "date",
        "en-US",
        { dateDisplayPreset: "iso-date", timeZone: "Pacific/Honolulu" }
      ).label,
      "2026-01-02"
    );
    assert.equal(
      calculateColumn(values, "range", "date", "fr-FR", due).label,
      "10j"
    );
  });
});
