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
    | "calendarCanResize"
    | "calendarCreateValues"
    | "calendarEvents"
    | "calendarMovePatch"
    | "calendarScope"
    | "daysBetween"
    | "normalizeCalendarViewConfig"
    | "parseDurationMinutes"
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

  test("keeps duration settings and reads numeric and ISO 8601 durations", () => {
    assert.deepEqual(
      calendar.normalizeCalendarViewConfig({
        dateColumn: "start",
        durationColumn: " minutes ",
        durationUnit: "hours",
        defaultDuration: "PT30M",
      }),
      {
        dateColumn: "start",
        durationColumn: "minutes",
        durationUnit: "hours",
        defaultDuration: "PT30M",
      }
    );
    assert.equal(
      calendar.normalizeCalendarViewConfig({
        durationUnit: "weeks",
        defaultDuration: -5,
      }),
      undefined
    );
    assert.equal(calendar.parseDurationMinutes(90), 90);
    assert.equal(calendar.parseDurationMinutes("2", "hours"), 120);
    assert.equal(calendar.parseDurationMinutes(1.5, "days"), 2160);
    assert.equal(calendar.parseDurationMinutes("PT1H30M"), 90);
    assert.equal(calendar.parseDurationMinutes("P1DT2H"), 1560);
    assert.equal(calendar.parseDurationMinutes("P1W"), 10_080);
    assert.equal(calendar.parseDurationMinutes("P1M"), undefined);
    assert.equal(calendar.parseDurationMinutes("PT"), undefined);
    assert.equal(calendar.parseDurationMinutes(-1), undefined);
  });

  test("derives the end from the start plus a duration", () => {
    const settings = {
      dateColumn: "start",
      durationColumn: "duration",
      durationUnit: "minutes" as const,
      defaultDuration: 60,
    };
    const events = calendar.calendarEvents(
      [
        {
          id: 1,
          start: new Date(2026, 8, 2, 9, 0).toISOString(),
          duration: 90,
        },
        {
          id: 2,
          start: new Date(2026, 8, 2, 22, 0).toISOString(),
          duration: "PT3H",
        },
        { id: 3, start: "2026-09-05", duration: 2880 },
        { id: 4, start: "2026-09-08" },
        { id: 5, start: "2026-09-10", duration: "P3D" },
      ],
      settings,
      rowId
    );
    assert.deepEqual(
      events.map(({ id, start, end }) => ({ id, start, end })),
      [
        { id: "1", start: "2026-09-02", end: "2026-09-03" },
        { id: "2", start: "2026-09-02", end: "2026-09-04" },
        { id: "3", start: "2026-09-05", end: "2026-09-07" },
        { id: "4", start: "2026-09-08", end: "2026-09-09" },
        { id: "5", start: "2026-09-10", end: "2026-09-13" },
      ]
    );
    const days = calendar.calendarEvents(
      [{ id: 6, start: "2026-09-14", length: 2 }],
      { dateColumn: "start", durationColumn: "length", durationUnit: "days" },
      rowId
    );
    assert.equal(days[0]?.end, "2026-09-16");
  });

  test("stretching a derived end writes the duration, moving keeps it", () => {
    const settings = {
      dateColumn: "start",
      durationColumn: "duration",
      durationUnit: "minutes" as const,
    };
    const row = { start: "2026-09-05", duration: 1440 };
    assert.deepEqual(
      calendar.calendarMovePatch(row, settings, "2026-09-07", "2026-09-08"),
      { start: "2026-09-07" }
    );
    assert.deepEqual(
      calendar.calendarMovePatch(row, settings, "2026-09-05", "2026-09-08"),
      { start: "2026-09-05", duration: 4320 }
    );
    assert.deepEqual(
      calendar.calendarMovePatch(
        { start: "2026-09-05", duration: "P2D" },
        settings,
        "2026-09-05",
        "2026-09-06"
      ),
      { start: "2026-09-05", duration: "P1D" }
    );
    assert.deepEqual(
      calendar.calendarMovePatch(
        { start: "2026-09-05" },
        { ...settings, durationUnit: "hours", defaultDuration: 24 },
        "2026-09-05",
        "2026-09-07"
      ),
      { start: "2026-09-05", duration: 48 }
    );
    assert.equal(calendar.calendarCanResize({ ...settings }), true);
    assert.equal(
      calendar.calendarCanResize({ dateColumn: "start", defaultDuration: 60 }),
      false
    );
    assert.equal(
      calendar.calendarCanResize({ ...settings, allowResize: false }),
      false
    );
    assert.deepEqual(
      calendar.calendarCreateValues(
        { ...settings, defaultDuration: 30 },
        "2026-09-05"
      ),
      { start: "2026-09-05", duration: 30 }
    );
    assert.deepEqual(
      calendar.calendarCreateValues(
        { dateColumn: "start", endColumn: "end" },
        "2026-09-05"
      ),
      { start: "2026-09-05", end: "2026-09-05" }
    );
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
