import { describe, expect, it } from "bun:test";
import { parseAdvancedFiltersParam } from "./use-table-url-state";

const dayOf = (value: unknown) => {
  const date = value as Date;
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()];
};

describe("advanced filters from the URL", () => {
  it("reads date-only values as local calendar days, whatever the time zone", () => {
    const [filter] = parseAdvancedFiltersParam(
      JSON.stringify([
        {
          id: "week",
          columnId: "dueDate",
          type: "date",
          operator: "between",
          values: ["2026-09-07", "2026-09-13"],
          isActive: true,
        },
      ])
    ) as unknown as { values: unknown[] }[];
    const [start, end] = filter?.values ?? [];
    expect(dayOf(start)).toEqual([2026, 9, 7]);
    expect(dayOf(end)).toEqual([2026, 9, 13]);
    // Local midnight, not UTC midnight (the previous day west of Greenwich).
    expect((start as Date).getHours()).toBe(0);
  });

  it("keeps instants and single dates", () => {
    const [filter] = parseAdvancedFiltersParam(
      JSON.stringify([
        {
          id: "on",
          columnId: "dueDate",
          type: "date",
          operator: "equals",
          values: ["2026-09-07T10:30:00.000Z"],
          isActive: true,
        },
      ])
    ) as unknown as { values: unknown }[];
    expect((filter?.values as Date).toISOString()).toBe(
      "2026-09-07T10:30:00.000Z"
    );
    expect(parseAdvancedFiltersParam("not json")).toEqual([]);
  });
});
