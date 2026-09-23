import { expect, test } from "bun:test";
import { timelineToday } from "../src/components/ui/yayaw-table/planning/timeline";

test("today is the user's calendar day, not the UTC day, around midnight", () => {
  expect(timelineToday(new Date(2026, 8, 10, 0, 30))).toBe("2026-09-10");
  expect(timelineToday(new Date(2026, 8, 10, 23, 30))).toBe("2026-09-10");
});
