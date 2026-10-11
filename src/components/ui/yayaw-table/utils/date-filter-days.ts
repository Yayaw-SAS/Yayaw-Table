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

/*
 * Relative dates: tokens such as `"$today"` or `"$thisWeek"` that a date rule
 * holds in place of days, so a saved view ("Due this week") keeps meaning the
 * current week. They are resolved to days when the rule is applied: in the
 * viewer's time zone, with the week starting on the locale's first day.
 */

/** First day of the week: 0 Sunday, 1 Monday … 6 Saturday. */
export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Fixed relative tokens; `$lastNDays` and `$nextNDays` take any count. */
export const RELATIVE_DATE_TOKENS = [
  "$today",
  "$yesterday",
  "$tomorrow",
  "$thisWeek",
  "$lastWeek",
  "$nextWeek",
  "$thisMonth",
  "$lastMonth",
  "$nextMonth",
  "$thisYear",
  "$lastYear",
  "$nextYear",
] as const;

/**
 * A relative date: one of `RELATIVE_DATE_TOKENS`, or `$last<N>Days` /
 * `$next<N>Days` (N from 1 to 3660), such as `"$last7Days"`.
 */
export type RelativeDateToken =
  | (typeof RELATIVE_DATE_TOKENS)[number]
  | `$last${number}Days`
  | `$next${number}Days`;

/** The relative choices date filter menus offer, in order. */
export const RELATIVE_DATE_CHOICES: readonly RelativeDateToken[] = [
  "$today",
  "$yesterday",
  "$tomorrow",
  "$thisWeek",
  "$lastWeek",
  "$nextWeek",
  "$thisMonth",
  "$lastMonth",
  "$nextMonth",
  "$thisYear",
  "$last7Days",
  "$last30Days",
  "$last90Days",
  "$next7Days",
  "$next30Days",
];

const RELATIVE_DAY_COUNT = /^\$(last|next)([1-9]\d{0,3})Days$/;
const MAX_RELATIVE_DAYS = 3660;

/** Whether a value is a relative date token such as `"$thisWeek"`. */
export function isRelativeDateToken(
  value: unknown
): value is RelativeDateToken {
  if (typeof value !== "string" || !value.startsWith("$")) {
    return false;
  }
  if ((RELATIVE_DATE_TOKENS as readonly string[]).includes(value)) {
    return true;
  }
  const count = Number(RELATIVE_DAY_COUNT.exec(value)?.[2] ?? 0);
  return count >= 1 && count <= MAX_RELATIVE_DAYS;
}

/** A date rule value: a `YYYY-MM-DD` day or a relative token. */
export function isDateFilterValue(
  value: unknown
): value is CalendarDay | RelativeDateToken {
  return isCalendarDay(value) || isRelativeDateToken(value);
}

/** How relative dates resolve: whose today, and which first weekday. */
export interface RelativeDateContext {
  /** IANA zone of "today", by default the runtime's (the viewer's in a browser). */
  timeZone?: string;
  /** Locale whose first weekday starts weeks, by default the runtime's. */
  locale?: string;
  /** First day of the week, winning over the locale's: 0 Sunday … 6 Saturday. */
  weekStartsOn?: number;
  /** The instant "today" is read from, by default now (mainly for tests and servers). */
  now?: Date | number | string;
}

/** Inclusive range of calendar days. */
export interface CalendarDayRange {
  start: CalendarDay;
  end: CalendarDay;
}

/** CLDR regions whose weeks start on Sunday or on Saturday; the others start on Monday. */
const SUNDAY_REGIONS = new Set(
  "AG AS BD BR BS BT BW BZ CA CN CO DM DO ET GT GU HK HN ID IL IN JM JP KE KH KR LA MH MM MO MT MX MZ NI NP PA PE PH PK PR PT PY SA SG SV TH TT TW UM US VE VI WS YE ZA ZW".split(
    " "
  )
);
const SATURDAY_REGIONS = new Set(
  "AE AF BH DJ DZ EG IQ IR JO KW LY OM QA SD SY".split(" ")
);
const DAYS_IN_WEEK = 7;

interface WeekInfoLocale {
  getWeekInfo?: () => { firstDay: number };
  weekInfo?: { firstDay: number };
  maximize?: () => Intl.Locale;
}

const runtimeLocale = (): string => {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return "en-US";
  }
};

/** First day of the week in a locale (`"fr"` Monday, `"en-US"` Sunday). */
export function localeWeekStart(locale?: string): WeekStart {
  try {
    const info = new Intl.Locale(locale || runtimeLocale()) as Intl.Locale &
      WeekInfoLocale;
    const firstDay = (info.getWeekInfo?.() ?? info.weekInfo)?.firstDay;
    if (firstDay) {
      return (firstDay % DAYS_IN_WEEK) as WeekStart;
    }
    const region = info.maximize?.().region ?? info.region ?? "";
    if (SUNDAY_REGIONS.has(region)) {
      return 0;
    }
    return SATURDAY_REGIONS.has(region) ? 6 : 1;
  } catch {
    return 1;
  }
}

const contextWeekStart = (context: RelativeDateContext): WeekStart => {
  const explicit = Number(context.weekStartsOn);
  return Number.isInteger(explicit) && explicit >= 0 && explicit < DAYS_IN_WEEK
    ? (explicit as WeekStart)
    : localeWeekStart(context.locale);
};

/** The weekday of a calendar day: 0 Sunday … 6 Saturday. */
const weekday = (day: CalendarDay): number =>
  new Date(`${day}T00:00:00Z`).getUTCDay();

const firstOfMonth = (day: CalendarDay, months: number): CalendarDay => {
  const date = new Date(0);
  date.setUTCFullYear(
    Number(day.slice(0, 4)),
    Number(day.slice(5, 7)) - 1 + months,
    1
  );
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-01`;
};

const monthRange = (today: CalendarDay, months: number): CalendarDayRange => {
  const start = firstOfMonth(today, months);
  return { start, end: addCalendarDays(firstOfMonth(today, months + 1), -1) };
};

const yearRange = (today: CalendarDay, years: number): CalendarDayRange => {
  const year = pad(Number(today.slice(0, 4)) + years, 4);
  return { start: `${year}-01-01`, end: `${year}-12-31` };
};

const weekRange = (
  today: CalendarDay,
  weeks: number,
  start: WeekStart
): CalendarDayRange => {
  const offset = (weekday(today) - start + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  const first = addCalendarDays(today, weeks * DAYS_IN_WEEK - offset);
  return { start: first, end: addCalendarDays(first, DAYS_IN_WEEK - 1) };
};

const singleDay = (day: CalendarDay): CalendarDayRange => ({
  start: day,
  end: day,
});

/**
 * The days a relative token names, both included, at `context.now` in
 * `context.timeZone`: `$today` is one day, `$thisWeek` the seven days of the
 * current week (starting on the locale's first weekday), `$last7Days` the
 * seven days ending today and `$next7Days` the seven days starting today.
 * Undefined when the value is not a token.
 */
export function resolveRelativeDate(
  token: unknown,
  context: RelativeDateContext = {}
): CalendarDayRange | undefined {
  if (!isRelativeDateToken(token)) {
    return;
  }
  const now =
    context.now === undefined ? new Date() : new Date(context.now as Date);
  const today = todayCalendarDay(
    context.timeZone,
    Number.isFinite(now.getTime()) ? now : new Date()
  );
  const count = RELATIVE_DAY_COUNT.exec(token);
  if (count) {
    const days = Number(count[2]) - 1;
    return count[1] === "last"
      ? { start: addCalendarDays(today, -days), end: today }
      : { start: today, end: addCalendarDays(today, days) };
  }
  const weekStart = contextWeekStart(context);
  const ranges: Record<string, () => CalendarDayRange> = {
    $today: () => singleDay(today),
    $yesterday: () => singleDay(addCalendarDays(today, -1)),
    $tomorrow: () => singleDay(addCalendarDays(today, 1)),
    $thisWeek: () => weekRange(today, 0, weekStart),
    $lastWeek: () => weekRange(today, -1, weekStart),
    $nextWeek: () => weekRange(today, 1, weekStart),
    $thisMonth: () => monthRange(today, 0),
    $lastMonth: () => monthRange(today, -1),
    $nextMonth: () => monthRange(today, 1),
    $thisYear: () => yearRange(today, 0),
    $lastYear: () => yearRange(today, -1),
    $nextYear: () => yearRange(today, 1),
  };
  return ranges[token]?.();
}

/**
 * The days a date rule value names: a token's days, or one day for a day (an
 * instant reads as its day in `context.timeZone`). Undefined for other values.
 */
export function dateFilterValueRange(
  value: unknown,
  context: RelativeDateContext = {}
): CalendarDayRange | undefined {
  if (isRelativeDateToken(value)) {
    return resolveRelativeDate(value, context);
  }
  const day = calendarDay(value, context.timeZone);
  return day ? singleDay(day) : undefined;
}

/**
 * A date rule's operator and values with its relative tokens resolved to
 * days, in the shapes every date rule already uses:
 * - `equals` / `between` a token → `between [first, last]` (the token's days);
 * - `notEquals` a token → `notEquals [first, last]` (outside those days);
 * - `before` / `lessThan` → its first day, `after` / `greaterThan` → its last;
 * - `lessThanOrEqual` → its last day, `greaterThanOrEqual` → its first;
 * - `between [A, B]` → from A's first day to B's last.
 *
 * A rule without tokens comes back unchanged (the same object).
 */
export function resolveRelativeDateRule<
  T extends { operator?: unknown; values?: unknown },
>(rule: T, context: RelativeDateContext = {}): T {
  const values = Array.isArray(rule.values) ? rule.values : [rule.values];
  if (!values.some(isRelativeDateToken)) {
    return rule;
  }
  const ranges = values.map((value) => dateFilterValueRange(value, context));
  const first = ranges[0];
  const last = ranges[1] ?? first;
  if (!(first && last)) {
    return rule;
  }
  // One day keeps the rule's shape: a value stays a value, a list a list.
  const one = (day: CalendarDay) => (Array.isArray(rule.values) ? [day] : day);
  switch (rule.operator) {
    case "equals":
    case "between":
      return { ...rule, operator: "between", values: [first.start, last.end] };
    case "notEquals":
      return { ...rule, values: [first.start, first.end] };
    case "before":
    case "lessThan":
    case "greaterThanOrEqual":
      return { ...rule, values: one(first.start) };
    case "after":
    case "greaterThan":
    case "lessThanOrEqual":
      return { ...rule, values: one(first.end) };
    default:
      return rule;
  }
}

const RELATIVE_LABELS: Record<
  "en" | "fr",
  Record<(typeof RELATIVE_DATE_TOKENS)[number], string> & {
    lastDays: string;
    nextDays: string;
  }
> = {
  en: {
    $today: "Today",
    $yesterday: "Yesterday",
    $tomorrow: "Tomorrow",
    $thisWeek: "This week",
    $lastWeek: "Last week",
    $nextWeek: "Next week",
    $thisMonth: "This month",
    $lastMonth: "Last month",
    $nextMonth: "Next month",
    $thisYear: "This year",
    $lastYear: "Last year",
    $nextYear: "Next year",
    lastDays: "Last {count} days",
    nextDays: "Next {count} days",
  },
  fr: {
    $today: "Aujourd’hui",
    $yesterday: "Hier",
    $tomorrow: "Demain",
    $thisWeek: "Cette semaine",
    $lastWeek: "La semaine dernière",
    $nextWeek: "La semaine prochaine",
    $thisMonth: "Ce mois-ci",
    $lastMonth: "Le mois dernier",
    $nextMonth: "Le mois prochain",
    $thisYear: "Cette année",
    $lastYear: "L’année dernière",
    $nextYear: "L’année prochaine",
    lastDays: "{count} derniers jours",
    nextDays: "{count} prochains jours",
  },
};

/**
 * A relative token as people read it, in English or French (`"fr"` locales):
 * `"$thisWeek"` reads "This week", `"$last14Days"` "Last 14 days".
 * `translate`, when given, wins for the keys `filters.relative.<token
 * without $>` (and `filters.relative.lastDays` / `nextDays`, with `{count}`).
 */
export function relativeDateLabel(
  token: RelativeDateToken,
  locale?: string,
  translate?: (key: string) => string | undefined
): string {
  const labels = locale?.toLowerCase().startsWith("fr")
    ? RELATIVE_LABELS.fr
    : RELATIVE_LABELS.en;
  const count = RELATIVE_DAY_COUNT.exec(token);
  const key = count ? `${count[1]}Days` : token.slice(1);
  const fallback = count
    ? labels[count[1] === "last" ? "lastDays" : "nextDays"]
    : labels[token as (typeof RELATIVE_DATE_TOKENS)[number]];
  const text = translate?.(`filters.relative.${key}`) || fallback;
  return count ? text.replace("{count}", count[2] ?? "") : text;
}

const RELATIVE_FIELD_LABELS = {
  en: { label: "Date", fixed: "Specific date" },
  fr: { label: "Date", fixed: "Date précise" },
} as const;

/**
 * The relative choice's own words: `"label"` names the choice ("Date") and
 * `"fixed"` the option that picks days in the calendar ("Specific date").
 * `translate` wins for `filters.relative.label` / `filters.relative.fixed`.
 */
export function relativeDateFieldLabel(
  kind: "fixed" | "label",
  locale?: string,
  translate?: (key: string) => string | undefined
): string {
  const labels = locale?.toLowerCase().startsWith("fr")
    ? RELATIVE_FIELD_LABELS.fr
    : RELATIVE_FIELD_LABELS.en;
  return translate?.(`filters.relative.${kind}`) || labels[kind];
}

/** The relative token a date rule's value holds, if any (`"$x"` or `["$x"]`). */
export function relativeDateTokenOf(
  value: unknown
): RelativeDateToken | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return isRelativeDateToken(first) ? first : undefined;
}
