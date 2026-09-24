/**
 * Calendar view model shared by the React and Vue editions. It has no
 * calendar-library dependency: the optional calendar registry items render it.
 */
import { type DateRangeScope, localDayKey } from "./scoped-rows";
import { type FieldTextColumn, fieldText } from "./table-contracts";

type FieldTextColumnWithId = FieldTextColumn & { id: string };

export type CalendarLayout = "month" | "week" | "list";

export interface CalendarViewSettings {
  /** Column holding the start date, or the only date. */
  dateColumn?: string;
  /** Column holding an inclusive end date; one-day events without it. */
  endColumn?: string;
  /** Column used as the event title. */
  titleColumn?: string;
  /** Column whose tag color colors the event. */
  colorColumn?: string;
  layout?: CalendarLayout;
  /** First day of the week, 0 = Sunday … 6 = Saturday (default Monday). */
  weekStartsOn?: number;
  showWeekends?: boolean;
  /** Drag an event to another day (needs `actions.update`). */
  allowDragUpdate?: boolean;
  /** Stretch an event to change its end (needs an end column). */
  allowResize?: boolean;
  /** Click a day to create a record on it (needs `actions.create`). */
  allowCreate?: boolean;
}

export const CALENDAR_DEFAULTS = {
  layout: "month",
  weekStartsOn: 1,
  showWeekends: true,
  allowDragUpdate: true,
  allowResize: true,
  allowCreate: true,
} as const satisfies CalendarViewSettings;

type ResolvedCalendarSettings = CalendarViewSettings &
  Required<
    Pick<
      CalendarViewSettings,
      | "allowCreate"
      | "allowDragUpdate"
      | "allowResize"
      | "layout"
      | "showWeekends"
      | "weekStartsOn"
    >
  >;

const LAYOUTS = new Set<CalendarLayout>(["month", "week", "list"]);
const STRING_KEYS = [
  "dateColumn",
  "endColumn",
  "titleColumn",
  "colorColumn",
] as const;
const BOOLEAN_KEYS = [
  "showWeekends",
  "allowDragUpdate",
  "allowResize",
  "allowCreate",
] as const;
const DAYS_IN_WEEK = 7;
const DAY_MS = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Keep only valid calendar settings; unknown or malformed values are dropped. */
export function normalizeCalendarViewConfig(
  value: unknown
): CalendarViewSettings | undefined {
  if (!value || typeof value !== "object") {
    return;
  }
  const input = value as Record<string, unknown>;
  const normalized: CalendarViewSettings = {};
  for (const key of STRING_KEYS) {
    const text = typeof input[key] === "string" ? input[key].trim() : "";
    if (text) {
      normalized[key] = text;
    }
  }
  for (const key of BOOLEAN_KEYS) {
    if (typeof input[key] === "boolean") {
      normalized[key] = input[key];
    }
  }
  if (LAYOUTS.has(input.layout as CalendarLayout)) {
    normalized.layout = input.layout as CalendarLayout;
  }
  const weekStart = Number(input.weekStartsOn);
  if (
    input.weekStartsOn !== undefined &&
    Number.isInteger(weekStart) &&
    weekStart >= 0 &&
    weekStart < DAYS_IN_WEEK
  ) {
    normalized.weekStartsOn = weekStart;
  }
  return Object.keys(normalized).length ? normalized : undefined;
}

interface CalendarColumn {
  id: string;
  type?: string;
}

/** Table defaults, then the view; the first date column when none is chosen. */
export function resolveCalendarSettings(
  columns: readonly CalendarColumn[],
  defaults: CalendarViewSettings | undefined,
  view: CalendarViewSettings | undefined
): ResolvedCalendarSettings {
  const merged = { ...CALENDAR_DEFAULTS, ...defaults, ...view };
  const dataColumns = columns.filter(
    (column) => column.id !== "select" && column.id !== "actions"
  );
  return {
    ...merged,
    dateColumn:
      merged.dateColumn ??
      dataColumns.find((column) => column.type === "date")?.id,
    titleColumn:
      merged.titleColumn ??
      dataColumns.find((column) => column.type !== "date")?.id,
  };
}

export interface CalendarEvent {
  id: string;
  title: string;
  /** Local calendar day (`YYYY-MM-DD`). */
  start: string;
  /** Exclusive end day, as calendar libraries expect for all-day events. */
  end: string;
  allDay: true;
  /** Value of the color column, for tag coloring. */
  colorValue?: string;
}

/** Year, month index and day of a `YYYY-MM-DD` string. */
function dayParts(day: string): [number, number, number] {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return [year, month - 1, date];
}

/** `YYYY-MM-DD` plus a number of days, in local calendar arithmetic. */
export function addDays(day: string, days: number): string {
  const [year, month, date] = dayParts(day);
  const shifted = new Date(year, month, date + days);
  return localDayKey(shifted) ?? day;
}

/** Whole days from one `YYYY-MM-DD` to another. */
export function daysBetween(from: string, to: string): number {
  const toTime = (day: string) => Date.UTC(...dayParts(day));
  return Math.round((toTime(to) - toTime(from)) / DAY_MS);
}

/**
 * Rows with a start date become all-day events; an end before the start is
 * ignored. With the columns and locale, titles read as the table shows the
 * title column (option labels, number and date formats).
 */
export function calendarEvents(
  rows: readonly Record<string, unknown>[],
  settings: CalendarViewSettings,
  getRowId: (row: Record<string, unknown>) => string,
  format: { columns?: readonly FieldTextColumnWithId[]; locale?: string } = {}
): CalendarEvent[] {
  if (!settings.dateColumn) {
    return [];
  }
  const titleColumn = format.columns?.find(
    (column) => column.id === settings.titleColumn
  );
  return rows.flatMap((row) => {
    const start = localDayKey(row[settings.dateColumn as string]);
    if (!start) {
      return [];
    }
    const lastDay =
      (settings.endColumn && localDayKey(row[settings.endColumn])) || start;
    const last = lastDay < start ? start : lastDay;
    const title = settings.titleColumn ? row[settings.titleColumn] : undefined;
    const color = settings.colorColumn ? row[settings.colorColumn] : undefined;
    return [
      {
        id: getRowId(row),
        title: fieldText(title, titleColumn, format.locale, row),
        start,
        end: addDays(last, 1),
        allDay: true as const,
        colorValue:
          color === null || color === undefined ? undefined : String(color),
      },
    ];
  });
}

/** The rows a visible calendar range needs, as a list scope. */
export function calendarScope(
  settings: CalendarViewSettings,
  visibleStart: Date,
  visibleEndExclusive: Date
): DateRangeScope | undefined {
  const from = localDayKey(visibleStart);
  const end = localDayKey(visibleEndExclusive);
  if (!(settings.dateColumn && from && end)) {
    return;
  }
  return {
    kind: "dateRange",
    field: settings.dateColumn,
    endField: settings.endColumn,
    from,
    to: addDays(end, -1),
  };
}

/** Write a day in the stored value's own format: date-only stays date-only. */
function formatLike(original: unknown, day: string): string {
  if (typeof original === "string" && !DATE_ONLY.test(original)) {
    const previous = new Date(original);
    if (Number.isFinite(previous.getTime())) {
      previous.setFullYear(...dayParts(day));
      return previous.toISOString();
    }
  }
  return day;
}

/**
 * The patch for an event moved or stretched to a new exclusive range. Without
 * an end column, only the start moves and stretching is not possible.
 */
export function calendarMovePatch(
  row: Record<string, unknown>,
  settings: CalendarViewSettings,
  start: string,
  endExclusive: string
): Record<string, unknown> {
  if (!settings.dateColumn) {
    return {};
  }
  const patch: Record<string, unknown> = {
    [settings.dateColumn]: formatLike(row[settings.dateColumn], start),
  };
  if (settings.endColumn) {
    const last = addDays(endExclusive, -1);
    patch[settings.endColumn] = formatLike(
      row[settings.endColumn],
      last < start ? start : last
    );
  }
  return patch;
}
