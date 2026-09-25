/**
 * Date filter rules compare calendar days, so their values are days written
 * `YYYY-MM-DD`, never instants: a server that does not know the viewer's time
 * zone still reads the days the viewer picked. Shared by the React and Vue
 * editions (copied into the Vue registry) and safe on a server.
 *
 * Older versions wrote instants at the viewer's local midnight, such as
 * `2026-09-24T22:00:00.000Z` for 25 September in Paris; `calendarDay` reads
 * them back as the day they named in the viewer's time zone, so old links and
 * saved views keep filtering the same days.
 */

const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
/** A date and a time without a zone: a wall-clock time, whose day is its date. */
const FLOATING_DATE_TIME =
  /^(\d{4}-\d{2}-\d{2})[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const FEBRUARY = 2;

/**
 * Date rule operators that name days: every date operator but `isEmpty` and
 * `isNotEmpty`, including the older comparison aliases Vue saved views keep.
 */
export const DAY_DATE_FILTER_OPERATORS = [
  "equals",
  "notEquals",
  "before",
  "after",
  "between",
  "greaterThan",
  "greaterThanOrEqual",
  "lessThan",
  "lessThanOrEqual",
] as const;

export type DayDateFilterOperator = (typeof DAY_DATE_FILTER_OPERATORS)[number];

/** A calendar day written `YYYY-MM-DD`, such as `"2026-09-25"`. */
export type CalendarDay = string;

const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const pad = (value: number, length = 2): string =>
  String(value).padStart(length, "0");

/** Whether a value is a day written `YYYY-MM-DD` that exists in the calendar. */
export function isCalendarDay(value: unknown): value is CalendarDay {
  if (typeof value !== "string") {
    return false;
  }
  const match = CALENDAR_DAY.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > DAYS_IN_MONTH.length) {
    return false;
  }
  const lastDay =
    month === FEBRUARY && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day >= 1 && day <= (lastDay ?? 0);
}

/** A local `Date`'s calendar day in the runtime's time zone. */
function localDay(date: Date): CalendarDay {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const ZONE_FORMATS = new Map<string, Intl.DateTimeFormat | null>();

/** The formatter of a zone Intl knows; undefined for an unknown zone. */
function zoneFormat(timeZone: string): Intl.DateTimeFormat | undefined {
  let format = ZONE_FORMATS.get(timeZone);
  if (format === undefined) {
    try {
      format = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      format = null;
    }
    ZONE_FORMATS.set(timeZone, format);
  }
  return format ?? undefined;
}

/**
 * An instant's calendar day in `timeZone` (an IANA zone such as
 * `"Europe/Paris"`); the runtime's zone without one or with an unknown one.
 */
function instantDay(date: Date, timeZone?: string): CalendarDay | undefined {
  if (!Number.isFinite(date.getTime())) {
    return;
  }
  const format = timeZone ? zoneFormat(timeZone) : undefined;
  let day: string;
  if (format) {
    const parts = format.formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((item) => item.type === type)?.value ?? "";
    day = `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
  } else {
    day = localDay(date);
  }
  return isCalendarDay(day) ? day : undefined;
}

/**
 * The calendar day a date value names, written `YYYY-MM-DD`:
 * - a `YYYY-MM-DD` day is that day, whatever the zone;
 * - a date and time without a zone (`"2026-09-25T10:30"`) is its date's day;
 * - an instant — a `Date`, a timestamp, a text with `Z` or an offset — is its
 *   day in `timeZone`, by default the runtime's (in a browser, the viewer's).
 *
 * Undefined when the value is not a date.
 */
export function calendarDay(
  value: unknown,
  timeZone?: string
): CalendarDay | undefined {
  if (value instanceof Date) {
    return instantDay(value, timeZone);
  }
  if (typeof value === "number") {
    return instantDay(new Date(value), timeZone);
  }
  if (typeof value !== "string") {
    return;
  }
  const text = value.trim();
  if (CALENDAR_DAY.test(text)) {
    return isCalendarDay(text) ? text : undefined;
  }
  const floating = FLOATING_DATE_TIME.exec(text)?.[1];
  if (floating) {
    return isCalendarDay(floating) ? floating : undefined;
  }
  return text ? instantDay(new Date(text), timeZone) : undefined;
}

/** Today's calendar day in `timeZone`, by default the runtime's. */
export function todayCalendarDay(
  timeZone?: string,
  now: Date = new Date()
): CalendarDay {
  return calendarDay(now, timeZone) ?? localDay(now);
}

/** The day `amount` days after (or before, when negative) a calendar day. */
export function addCalendarDays(day: CalendarDay, amount: number): CalendarDay {
  const match = CALENDAR_DAY.exec(day);
  if (!(match && isCalendarDay(day))) {
    return day;
  }
  const date = new Date(0);
  date.setUTCFullYear(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]) + Math.trunc(amount)
  );
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * A calendar day as a `Date` at the runtime's local midnight, for date pickers
 * that work with dates; undefined when the value is not a day.
 */
export function calendarDayToLocalDate(
  value: unknown,
  timeZone?: string
): Date | undefined {
  const day = calendarDay(value, timeZone);
  const match = day ? CALENDAR_DAY.exec(day) : undefined;
  if (!match) {
    return;
  }
  const date = new Date(0);
  date.setFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Whether a date rule operator names days (every one but the emptiness checks). */
export function isDayDateFilterOperator(
  operator: unknown
): operator is DayDateFilterOperator {
  return (DAY_DATE_FILTER_OPERATORS as readonly unknown[]).includes(operator);
}

const sameValues = (left: readonly unknown[], right: readonly unknown[]) =>
  left.length === right.length &&
  left.every((value, index) => Object.is(value, right[index]));

/**
 * A date rule's values as days, in the same shape: one value stays one value
 * and a list stays a list, ordered `[first, last]` for `between` (both days
 * included). Values that are not dates stay as they are, for the rule's
 * validation to report, and so do the values of the emptiness operators and
 * of unknown operators. Values that already are days come back unchanged.
 */
export function dateFilterDays(
  operator: unknown,
  values: unknown,
  timeZone?: string
): unknown {
  if (!isDayDateFilterOperator(operator)) {
    return values;
  }
  const day = (value: unknown) => calendarDay(value, timeZone) ?? value;
  if (!Array.isArray(values)) {
    return day(values);
  }
  const days = values.map(day);
  const [first, last] = days;
  if (
    operator === "between" &&
    isCalendarDay(first) &&
    isCalendarDay(last) &&
    last < first
  ) {
    days[0] = last;
    days[1] = first;
  }
  return sameValues(days, values) ? values : days;
}

/** How to recognize and read the date rules of a filter state. */
export interface DateFilterDayOptions {
  /**
   * IANA zone that reads instants, by default the runtime's: in a browser,
   * the viewer's. Pass the zone of the person who saved a view to read its
   * older instants on a server.
   */
  timeZone?: string;
  /**
   * Whether a column holds dates, for rules saved without their `type`.
   * Rules typed `"date"` are always read as date rules.
   */
  isDateColumn?: (columnId: string) => boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/**
 * A filter rule (`{ columnId, type?, operator, values }`) whose date values are
 * days. The same object comes back when nothing changes, so reactive state
 * and memoized queries do not see a change.
 */
export function normalizeDateFilterRule<T>(
  rule: T,
  options: DateFilterDayOptions = {}
): T {
  if (!isRecord(rule)) {
    return rule;
  }
  const isDateRule =
    rule.type === "date" ||
    (rule.type === undefined &&
      typeof rule.columnId === "string" &&
      Boolean(options.isDateColumn?.(rule.columnId)));
  if (!(isDateRule && "values" in rule)) {
    return rule;
  }
  const values = dateFilterDays(rule.operator, rule.values, options.timeZone);
  return Object.is(values, rule.values) ? rule : { ...rule, values };
}

/**
 * Every date rule of a filter state as days: a list of rules or a
 * `{ filters, joinOperator }` envelope comes back in the same shape, and the
 * same object when nothing changes.
 */
export function normalizeDateFilterRules<T>(
  state: T,
  options: DateFilterDayOptions = {}
): T {
  if (Array.isArray(state)) {
    const rules = state.map((rule) => normalizeDateFilterRule(rule, options));
    return (sameValues(rules, state) ? state : rules) as T;
  }
  if (isRecord(state) && Array.isArray(state.filters)) {
    const filters = normalizeDateFilterRules(state.filters, options);
    return (
      Object.is(filters, state.filters) ? state : { ...state, filters }
    ) as T;
  }
  return state;
}
