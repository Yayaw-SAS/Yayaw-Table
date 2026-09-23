import assert from "node:assert/strict";
import type * as Calendar from "../src/components/ui/yayaw-table/utils/calendar-model";
import type * as Modes from "../src/components/ui/yayaw-table/utils/display-modes";

const COLUMNS = [
  { id: "select", type: "text" },
  { id: "name", type: "text" },
  { id: "status", type: "select" },
  { id: "start", type: "date" },
  { id: "end", type: "date" },
];
const rowId = (row: Record<string, unknown>) => String(row.id);

export function calendarModelSuite(
  test: (name: string, run: () => void) => void,
  calendar: Pick<
    typeof Calendar,
    | "addDays"
    | "calendarEvents"
    | "calendarMovePatch"
    | "calendarScope"
    | "daysBetween"
    | "normalizeCalendarViewConfig"
    | "resolveCalendarSettings"
  >,
  modes: Pick<typeof Modes, "normalizeModeConfig" | "resolveDisplayModes">
) {
  test("keeps only valid calendar settings", () => {
    assert.deepEqual(
      calendar.normalizeCalendarViewConfig({
        dateColumn: " start ",
        layout: "week",
        weekStartsOn: "0",
        showWeekends: false,
        allowCreate: "yes",
      }),
      {
        dateColumn: "start",
        layout: "week",
        weekStartsOn: 0,
        showWeekends: false,
      }
    );
    assert.equal(
      calendar.normalizeCalendarViewConfig({ layout: "year", weekStartsOn: 7 }),
      undefined
    );
    assert.deepEqual(
      modes.normalizeModeConfig("calendar", { layout: "list" }),
      {
        layout: "list",
      }
    );
  });

  test("defaults to the first date column and the first other column as title", () => {
    const settings = calendar.resolveCalendarSettings(COLUMNS, undefined, {});
    assert.equal(settings.dateColumn, "start");
    assert.equal(settings.titleColumn, "name");
    assert.equal(settings.layout, "month");
    assert.equal(settings.weekStartsOn, 1);
    const view = calendar.resolveCalendarSettings(
      COLUMNS,
      { layout: "week", weekStartsOn: 0 },
      { weekStartsOn: 6 }
    );
    assert.equal(view.layout, "week");
    assert.equal(view.weekStartsOn, 6);
  });

  test("turns rows into all-day events with an exclusive end", () => {
    const events = calendar.calendarEvents(
      [
        { id: 1, name: "One day", start: "2026-09-02", status: "Active" },
        { id: 2, name: "Range", start: "2026-09-05", end: "2026-09-07" },
        { id: 3, name: "Backwards", start: "2026-09-10", end: "2026-09-08" },
        { id: 4, name: "Undated" },
      ],
      {
        dateColumn: "start",
        endColumn: "end",
        titleColumn: "name",
        colorColumn: "status",
      },
      rowId
    );
    assert.deepEqual(
      events.map(({ id, start, end, colorValue }) => ({
        id,
        start,
        end,
        colorValue,
      })),
      [
        {
          id: "1",
          start: "2026-09-02",
          end: "2026-09-03",
          colorValue: "Active",
        },
        {
          id: "2",
          start: "2026-09-05",
          end: "2026-09-08",
          colorValue: undefined,
        },
        {
          id: "3",
          start: "2026-09-10",
          end: "2026-09-11",
          colorValue: undefined,
        },
      ]
    );
  });

  test("asks the server for the visible range, with an inclusive last day", () => {
    assert.deepEqual(
      calendar.calendarScope(
        { dateColumn: "start", endColumn: "end" },
        new Date(2026, 7, 31),
        new Date(2026, 9, 12)
      ),
      {
        kind: "dateRange",
        field: "start",
        endField: "end",
        from: "2026-08-31",
        to: "2026-10-11",
      }
    );
    assert.equal(
      calendar.calendarScope({}, new Date(2026, 7, 31), new Date(2026, 9, 12)),
      undefined
    );
  });

  test("moves keep the stored date format and the duration", () => {
    assert.deepEqual(
      calendar.calendarMovePatch(
        { start: "2026-09-05", end: "2026-09-07" },
        { dateColumn: "start", endColumn: "end" },
        "2026-09-06",
        "2026-09-09"
      ),
      { start: "2026-09-06", end: "2026-09-08" }
    );
    const moved = calendar.calendarMovePatch(
      { start: new Date(2026, 8, 5, 14, 30).toISOString() },
      { dateColumn: "start" },
      "2026-09-06",
      "2026-09-07"
    );
    const date = new Date(String(moved.start));
    assert.deepEqual(
      [
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
      ],
      [2026, 8, 6, 14, 30]
    );
    assert.equal(calendar.addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(calendar.daysBetween("2026-10-24", "2026-10-26"), 2);
  });

  test("the calendar is offered only when its renderer is installed", () => {
    assert.deepEqual(
      modes.resolveDisplayModes(["table", "calendar"], { planning: false }),
      ["table"]
    );
    assert.deepEqual(
      modes.resolveDisplayModes(["table", "calendar"], {
        planning: false,
        renderers: ["calendar"],
      }),
      ["table", "calendar"]
    );
  });
}
