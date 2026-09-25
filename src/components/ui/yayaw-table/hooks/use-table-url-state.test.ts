import { describe, expect, it } from "bun:test";
import { parseAdvancedFiltersParam } from "./use-table-url-state";

/** What older links wrote for a day: the instant of the viewer's local midnight. */
const localMidnight = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day).toISOString();

describe("advanced filters from the URL", () => {
  it("keeps date values as calendar days, whatever the time zone", () => {
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
    expect(filter?.values).toEqual(["2026-09-07", "2026-09-13"]);
  });

  it("reads older instants as the viewer's days", () => {
    const [between, on] = parseAdvancedFiltersParam(
      JSON.stringify([
        {
          id: "week",
          columnId: "dueDate",
          type: "date",
          operator: "between",
          values: [localMidnight(2026, 9, 7), localMidnight(2026, 9, 13)],
          isActive: true,
        },
        {
          id: "on",
          columnId: "dueDate",
          type: "date",
          operator: "equals",
          values: [localMidnight(2026, 9, 7)],
          isActive: true,
          createdAt: "2026-09-01T08:00:00.000Z",
        },
      ])
    ) as unknown as { values: unknown; createdAt?: unknown }[];
    expect(between?.values).toEqual(["2026-09-07", "2026-09-13"]);
    expect(on?.values).toEqual(["2026-09-07"]);
    // Edit timestamps stay dates.
    expect(on?.createdAt).toBeInstanceOf(Date);
    expect(parseAdvancedFiltersParam("not json")).toEqual([]);
  });
});
