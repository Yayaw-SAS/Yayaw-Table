/**
 * Calendar view model shared by the React and Vue editions. It has no
 * calendar-library dependency: the optional calendar registry items render it.
 */
import { type DateRangeScope, localDayKey } from "./scoped-rows";
import { type FieldTextColumn, fieldText } from "./table-contracts";

type FieldTextColumnWithId = FieldTextColumn & { id: string; header?: string };

export type CalendarLayout = "month" | "week" | "list";

/** Unit of a numeric duration; ISO 8601 strings (`"PT1H30M"`) carry their own. */
export type CalendarDurationUnit = "minutes" | "hours" | "days";

export interface CalendarViewSettings {
  /** Column holding the start date, or the only date. */
  dateColumn?: string;
  /** Column holding an inclusive end date; one-day events without it. */
  endColumn?: string;
  /**
   * Without `endColumn`: column holding a duration (a number in
   * `durationUnit`, or an ISO 8601 string such as `"PT1H30M"`); the end is
   * the start plus the duration and stretching an event writes the duration.
   */
  durationColumn?: string;
  /** Unit of numeric durations and of `defaultDuration` (default minutes). */
  durationUnit?: CalendarDurationUnit;
  /** Duration of rows without one, as a number in `durationUnit` or ISO 8601. */
  defaultDuration?: number | string;
  /** Column used as the event title. */
  titleColumn?: string;
  /** Column whose tag color colors the event. */
  colorColumn?: string;
  /**
   * Columns shown under the title, one line each, in this order (none by
   * default). An empty list hides the fields a table default chose.
   */
  cardColumnIds?: string[];
  /** Prefix each field line with its column label. */
  showCardLabels?: boolean;
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
const DURATION_UNITS = new Set<CalendarDurationUnit>([
  "minutes",
  "hours",
  "days",
]);
const STRING_KEYS = [
  "dateColumn",
  "endColumn",
  "durationColumn",
  "titleColumn",
  "colorColumn",
] as const;
const BOOLEAN_KEYS = [
  "showCardLabels",
  "showWeekends",
  "allowDragUpdate",
  "allowResize",
  "allowCreate",
] as const;
const DAYS_IN_WEEK = 7;
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
/** Weeks, days, hours, minutes and seconds; years and months are ambiguous. */
const ISO_DURATION =
  /^P(?:(\d+(?:[.,]\d+)?)W)?(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/i;
const MINUTES_PER_UNIT: Record<CalendarDurationUnit, number> = {
  minutes: 1,
  hours: MINUTES_PER_HOUR,
  days: MINUTES_PER_DAY,
};

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
  if (Array.isArray(input.cardColumnIds)) {
    normalized.cardColumnIds = [
      ...new Set(
        input.cardColumnIds.flatMap((id) =>
          typeof id === "string" && id.trim() ? [id.trim()] : []
        )
      ),
    ];
  }
  if (LAYOUTS.has(input.layout as CalendarLayout)) {
    normalized.layout = input.layout as CalendarLayout;
  }
  if (DURATION_UNITS.has(input.durationUnit as CalendarDurationUnit)) {
    normalized.durationUnit = input.durationUnit as CalendarDurationUnit;
  }
  if (parseDurationMinutes(input.defaultDuration, "minutes") !== undefined) {
    normalized.defaultDuration = input.defaultDuration as number | string;
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

/** A field shown under an event title, as the table formats its column. */
export interface CalendarEventField {
  id: string;
  label: string;
  text: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  /** Non-empty values of `cardColumnIds`, in order. */
  fields: CalendarEventField[];
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

interface CalendarFieldColumn {
  id: string;
  label: string;
  column?: FieldTextColumnWithId;
}

/** The columns of `cardColumnIds`; without the columns, ids stand for labels. */
function calendarFieldColumns(
  settings: CalendarViewSettings,
  columns: readonly FieldTextColumnWithId[] | undefined
): CalendarFieldColumn[] {
  return (settings.cardColumnIds ?? []).flatMap(
    (id): CalendarFieldColumn[] => {
      if (!columns) {
        return [{ id, label: id }];
      }
      const column = columns.find((item) => item.id === id);
      return column && id !== settings.titleColumn
        ? [{ id, label: column.header ?? id, column }]
        : [];
    }
  );
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
  const fieldColumns = calendarFieldColumns(settings, format.columns);
  return rows.flatMap((row) => {
    const start = localDayKey(row[settings.dateColumn as string]);
    if (!start) {
      return [];
    }
    const lastDay = settings.endColumn
      ? localDayKey(row[settings.endColumn]) || start
      : durationLastDay(row, settings, start);
    const last = lastDay < start ? start : lastDay;
    const title = settings.titleColumn ? row[settings.titleColumn] : undefined;
    const color = settings.colorColumn ? row[settings.colorColumn] : undefined;
    return [
      {
        id: getRowId(row),
        title: fieldText(title, titleColumn, format.locale, row),
        fields: fieldColumns.flatMap(({ id, label, column }) => {
          const text = fieldText(row[id], column, format.locale, row);
          return text ? [{ id, label, text }] : [];
        }),
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
    return patch;
  }
  const durationPatch = calendarDurationPatch(
    row,
    settings,
    start,
    endExclusive
  );
  return durationPatch ? { ...patch, ...durationPatch } : patch;
}

/** Stretching is possible with an end column or a duration column. */
export function calendarCanResize(settings: CalendarViewSettings): boolean {
  return Boolean(
    settings.allowResize !== false &&
      (settings.endColumn || settings.durationColumn)
  );
}

/** Values prefilled when a day is clicked to create a record on it. */
export function calendarCreateValues(
  settings: CalendarViewSettings,
  day: string
): Record<string, unknown> {
  if (!settings.dateColumn) {
    return {};
  }
  const values: Record<string, unknown> = { [settings.dateColumn]: day };
  if (settings.endColumn) {
    values[settings.endColumn] = day;
  } else if (
    settings.durationColumn &&
    settings.defaultDuration !== undefined &&
    parseDurationMinutes(settings.defaultDuration, "minutes") !== undefined
  ) {
    values[settings.durationColumn] = settings.defaultDuration;
  }
  return values;
}

/**
 * Minutes in a duration: a finite number (or numeric string) in `unit`, or an
 * ISO 8601 duration with weeks, days, hours, minutes and seconds. Negative or
 * malformed values give `undefined`.
 */
export function parseDurationMinutes(
  value: unknown,
  unit: CalendarDurationUnit = "minutes"
): number | undefined {
  if (value === null || value === undefined || value === "") {
    return;
  }
  if (typeof value === "string") {
    const text = value.trim();
    const iso = ISO_DURATION.exec(text);
    if (iso && text.length > 1 && !text.toUpperCase().endsWith("T")) {
      const [, weeks, days, hours, minutes, seconds] = iso.map((part) =>
        part === undefined ? 0 : Number(part.replace(",", "."))
      );
      return (
        (weeks ?? 0) * DAYS_IN_WEEK * MINUTES_PER_DAY +
        (days ?? 0) * MINUTES_PER_DAY +
        (hours ?? 0) * MINUTES_PER_HOUR +
        (minutes ?? 0) +
        (seconds ?? 0) / MINUTES_PER_HOUR
      );
    }
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (typeof value === "boolean" || !Number.isFinite(numeric) || numeric < 0) {
    return;
  }
  return numeric * MINUTES_PER_UNIT[unit];
}

/** A number of minutes as an ISO 8601 duration such as `"P1DT2H30M"`. */
export function formatIsoDuration(totalMinutes: number): string {
  const rounded = Math.max(0, Math.round(totalMinutes));
  const days = Math.floor(rounded / MINUTES_PER_DAY);
  const hours = Math.floor((rounded % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  const minutes = rounded % MINUTES_PER_HOUR;
  const time = `${hours ? `${hours}H` : ""}${minutes ? `${minutes}M` : ""}`;
  if (!(days || time)) {
    return "PT0M";
  }
  return `P${days ? `${days}D` : ""}${time ? `T${time}` : ""}`;
}

/** The row's duration in minutes: its own value, else the default. */
function rowDurationMinutes(
  row: Record<string, unknown>,
  settings: CalendarViewSettings
): number | undefined {
  const unit = settings.durationUnit ?? "minutes";
  const own = settings.durationColumn
    ? parseDurationMinutes(row[settings.durationColumn], unit)
    : undefined;
  return own ?? parseDurationMinutes(settings.defaultDuration, unit);
}

/** The start as an instant: a date-only value starts at local midnight. */
function startInstant(value: unknown): Date | undefined {
  if (typeof value === "string" && DATE_ONLY.test(value)) {
    const [year, month, date] = dayParts(value);
    return new Date(year, month, date);
  }
  const instant =
    value instanceof Date || typeof value === "number"
      ? new Date(value)
      : new Date(String(value));
  return Number.isFinite(instant.getTime()) ? instant : undefined;
}

/**
 * The last day an event covers when its end is its start plus its duration.
 * The end is exclusive: 24 hours from midnight stays on the start day. Whole
 * days follow the local calendar, so a daylight-saving change moves nothing.
 */
function durationLastDay(
  row: Record<string, unknown>,
  settings: CalendarViewSettings,
  start: string
): string {
  const minutes = rowDurationMinutes(row, settings);
  const from = settings.dateColumn
    ? startInstant(row[settings.dateColumn])
    : undefined;
  if (!(minutes && from)) {
    return start;
  }
  const days = Math.floor(minutes / MINUTES_PER_DAY);
  const end = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate() + days,
    from.getHours(),
    from.getMinutes(),
    from.getSeconds(),
    from.getMilliseconds()
  );
  end.setTime(end.getTime() + (minutes - days * MINUTES_PER_DAY) * MINUTE_MS);
  const endDay = localDayKey(end) ?? start;
  const atMidnight =
    end.getHours() === 0 &&
    end.getMinutes() === 0 &&
    end.getSeconds() === 0 &&
    end.getMilliseconds() === 0;
  return atMidnight ? addDays(endDay, -1) : endDay;
}

/** Write a duration as the stored one: ISO stays ISO, numbers keep the unit. */
function durationLike(
  original: unknown,
  fallback: unknown,
  minutes: number,
  unit: CalendarDurationUnit
): number | string {
  const sample =
    original === null || original === undefined || original === ""
      ? fallback
      : original;
  if (typeof sample === "string" && ISO_DURATION.test(sample.trim())) {
    return formatIsoDuration(minutes);
  }
  const value = minutes / MINUTES_PER_UNIT[unit];
  return typeof sample === "string" ? String(value) : value;
}

/**
 * Without an end column, a stretched event changes its duration by the days
 * its end moved more than its start; a plain move keeps the duration.
 */
function calendarDurationPatch(
  row: Record<string, unknown>,
  settings: CalendarViewSettings,
  start: string,
  endExclusive: string
): Record<string, unknown> | undefined {
  const { dateColumn, durationColumn } = settings;
  const previousStart = dateColumn ? localDayKey(row[dateColumn]) : undefined;
  if (!(durationColumn && previousStart)) {
    return;
  }
  const previousEnd = addDays(durationLastDay(row, settings, previousStart), 1);
  const stretch =
    daysBetween(previousEnd, endExclusive) - daysBetween(previousStart, start);
  if (stretch === 0) {
    return;
  }
  const unit = settings.durationUnit ?? "minutes";
  const minutes = Math.max(
    0,
    (rowDurationMinutes(row, settings) ?? 0) + stretch * MINUTES_PER_DAY
  );
  return {
    [durationColumn]: durationLike(
      row[durationColumn],
      settings.defaultDuration,
      minutes,
      unit
    ),
  };
}
