/**
 * Scheduling settings for Connect destinations, shared by the React and Vue
 * editions. The table only edits and previews the schedule; the host stores it
 * (per view) and runs it.
 */

export type ScheduleFrequency =
  | "manual"
  | "auto"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly";

export const SCHEDULE_FREQUENCIES: readonly ScheduleFrequency[] = [
  "manual",
  "auto",
  "hourly",
  "daily",
  "weekly",
  "monthly",
];

export interface ScheduleSettings {
  /** "manual" runs only on "Run now"; "auto" runs when the data changes. */
  frequency: ScheduleFrequency;
  /** Minute of the hour, for hourly runs (0–59). */
  minute: number;
  /** Local time "HH:mm", for daily, weekly and monthly runs. */
  time: string;
  /** Day of the week for weekly runs, 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** Day of the month (1–31) or the last day; shorter months use their last day. */
  dayOfMonth: number | "last";
  /** First day the schedule may run, "YYYY-MM-DD" in its time zone. */
  startDate?: string;
  /** IANA time zone the times are expressed in. */
  timeZone: string;
}

export interface ScheduleStatus {
  lastRunAt?: string;
  lastResult?: "ok" | "error";
  message?: string;
  /** The host's own next run, preferred over the client preview when given. */
  nextRunAt?: string;
}

type MaybePromise<T> = T | Promise<T>;

/** What a Connect destination declares to be scheduled; the host runs it. */
export interface DataDestinationSchedule<TContext = unknown> {
  /** Frequencies to offer (default all). "manual" is always offered. */
  frequencies?: ScheduleFrequency[];
  /** Settings saved for this view, or `null` when none. */
  load: (context: TContext) => MaybePromise<ScheduleSettings | null>;
  save: (settings: ScheduleSettings, context: TContext) => MaybePromise<void>;
  status?: (context: TContext) => MaybePromise<ScheduleStatus | null>;
}

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DEFAULT_TIME = "09:00";
const FALLBACK_TIME_ZONE = "UTC";

/** Offered when `Intl.supportedValuesOf` is unavailable. */
export const COMMON_TIME_ZONES: readonly string[] = [
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Brussels",
  "Europe/Zurich",
  "Europe/Amsterdam",
  "Europe/Lisbon",
  "Europe/Athens",
  "Europe/Moscow",
  "Africa/Casablanca",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
  "America/Sao_Paulo",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Mexico_City",
];

/** The browser's time zone, or UTC. */
export function browserTimeZone(): string {
  try {
    return (
      Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIME_ZONE
    );
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== "string" || timeZone.length === 0) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Time zones to choose from, always including `current`. */
export function scheduleTimeZones(current?: string): string[] {
  const supported = (Intl as { supportedValuesOf?: (key: string) => string[] })
    .supportedValuesOf;
  let zones: string[] = [...COMMON_TIME_ZONES];
  if (typeof supported === "function") {
    try {
      zones = supported("timeZone");
    } catch {
      // keep the common list
    }
  }
  const all = new Set(zones);
  all.add(FALLBACK_TIME_ZONE);
  if (current) {
    all.add(current);
  }
  return [...all].sort((a, b) => a.localeCompare(b));
}

export function defaultScheduleSettings(timeZone?: string): ScheduleSettings {
  return {
    frequency: "manual",
    minute: 0,
    time: DEFAULT_TIME,
    weekday: 1,
    dayOfMonth: 1,
    timeZone: isValidTimeZone(timeZone) ? timeZone : browserTimeZone(),
  };
}

/** Frequencies a destination offers, in their usual order, "manual" first. */
export function scheduleFrequencies(
  declared?: readonly ScheduleFrequency[]
): ScheduleFrequency[] {
  if (!declared || declared.length === 0) {
    return [...SCHEDULE_FREQUENCIES];
  }
  return SCHEDULE_FREQUENCIES.filter(
    (frequency) => frequency === "manual" || declared.includes(frequency)
  );
}

const clampInteger = (
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number => {
  const number = typeof value === "string" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
};

const normalizeDayOfMonth = (value: unknown): number | "last" =>
  value === "last" ? "last" : clampInteger(value, 1, 31, 1);

const normalizeTime = (value: unknown): string => {
  if (typeof value !== "string") {
    return DEFAULT_TIME;
  }
  const padded = value.length === 4 ? `0${value}` : value;
  return TIME_PATTERN.test(padded) ? padded : DEFAULT_TIME;
};

const isValidDate = (value: unknown): value is string => {
  if (typeof value !== "string") {
    return false;
  }
  const match = DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const [year = 0, month = 0, day = 0] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const normalizeFrequency = (
  value: unknown,
  allowed: readonly ScheduleFrequency[]
): ScheduleFrequency =>
  allowed.includes(value as ScheduleFrequency)
    ? (value as ScheduleFrequency)
    : "manual";

/**
 * Validate what the host returned or the user entered: values are clamped,
 * unknown frequencies become "manual" and unknown time zones the browser's.
 */
export function normalizeScheduleSettings(
  input: unknown,
  frequencies?: readonly ScheduleFrequency[]
): ScheduleSettings {
  const value =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  const settings: ScheduleSettings = {
    frequency: normalizeFrequency(
      value.frequency,
      scheduleFrequencies(frequencies)
    ),
    minute: clampInteger(value.minute, 0, 59, 0),
    time: normalizeTime(value.time),
    weekday: clampInteger(value.weekday, 0, 6, 1),
    dayOfMonth: normalizeDayOfMonth(value.dayOfMonth),
    timeZone: isValidTimeZone(value.timeZone)
      ? value.timeZone
      : browserTimeZone(),
  };
  if (isValidDate(value.startDate)) {
    settings.startDate = value.startDate;
  }
  return settings;
}

/** Which fields a frequency uses, so the form shows only those. */
export function scheduleFields(frequency: ScheduleFrequency): {
  minute: boolean;
  time: boolean;
  weekday: boolean;
  dayOfMonth: boolean;
  timing: boolean;
} {
  const timed = ["daily", "weekly", "monthly"].includes(frequency);
  return {
    minute: frequency === "hourly",
    time: timed,
    weekday: frequency === "weekly",
    dayOfMonth: frequency === "monthly",
    timing: timed || frequency === "hourly",
  };
}

interface WallTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

const partsFormatter = (timeZone: string): Intl.DateTimeFormat => {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    partsFormatters.set(timeZone, formatter);
  }
  return formatter;
};

/** Wall-clock time of an instant in a time zone. */
function wallTime(
  instant: number,
  timeZone: string
): WallTime & {
  second: number;
} {
  const values: Record<string, number> = {};
  for (const part of partsFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== "literal") {
      values[part.type] = Number(part.value);
    }
  }
  return {
    year: values.year ?? 0,
    month: values.month ?? 1,
    day: values.day ?? 1,
    hour: (values.hour ?? 0) % 24,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

/** Milliseconds the zone is ahead of UTC at an instant. */
function zoneOffset(instant: number, timeZone: string): number {
  const wall = wallTime(instant, timeZone);
  const asUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

const sameWallTime = (a: WallTime, b: WallTime): boolean =>
  a.year === b.year &&
  a.month === b.month &&
  a.day === b.day &&
  a.hour === b.hour &&
  a.minute === b.minute;

/**
 * The instant a wall-clock time happens in a time zone. A time repeated when
 * clocks go back resolves to its first occurrence; a time skipped when clocks
 * go forward moves forward by the gap (02:30 → 03:30).
 */
export function zonedTimeToInstant(wall: WallTime, timeZone: string): number {
  const guess = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute
  );
  const offsets = [
    ...new Set([
      zoneOffset(guess - DAY_MS, timeZone),
      zoneOffset(guess, timeZone),
      zoneOffset(guess + DAY_MS, timeZone),
    ]),
  ];
  const matches = offsets
    .map((offset) => guess - offset)
    .filter((instant) => sameWallTime(wallTime(instant, timeZone), wall));
  if (matches.length > 0) {
    return Math.min(...matches);
  }
  return guess - Math.min(...offsets);
}

const parseTime = (time: string): { hour: number; minute: number } => {
  const [hour = 0, minute = 0] = normalizeTime(time).split(":").map(Number);
  return { hour, minute };
};

/** A calendar day `offset` days after the given one. */
const addDays = (
  date: { year: number; month: number; day: number },
  offset: number
) => {
  const shifted = new Date(
    Date.UTC(date.year, date.month - 1, date.day + offset)
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
};

const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/** First instant a run may happen: after `from`, and not before the start date. */
function earliestRun(settings: ScheduleSettings, from: Date): number {
  const afterFrom =
    Math.floor(from.getTime() / MINUTE_MS) * MINUTE_MS + MINUTE_MS;
  if (!(settings.startDate && isValidDate(settings.startDate))) {
    return afterFrom;
  }
  const [year = 0, month = 0, day = 0] = settings.startDate
    .split("-")
    .map(Number);
  const start = zonedTimeToInstant(
    { year, month, day, hour: 0, minute: 0 },
    settings.timeZone
  );
  return Math.max(afterFrom, start);
}

function nextHourlyRun(settings: ScheduleSettings, earliest: number): number {
  const current = wallTime(earliest, settings.timeZone).minute;
  let candidate =
    earliest + ((settings.minute - current + 60) % 60) * MINUTE_MS;
  // Zones with half-hour shifts may move the minute; walk until it matches.
  for (let step = 0; step < 120; step += 1) {
    if (wallTime(candidate, settings.timeZone).minute === settings.minute) {
      return candidate;
    }
    candidate += MINUTE_MS;
  }
  return candidate;
}

/** The first day (from the earliest one) matching `accepts`, at the set time. */
function nextDailyRun(
  settings: ScheduleSettings,
  earliest: number,
  days: number,
  accepts: (date: ReturnType<typeof addDays>) => boolean
): number | null {
  const start = wallTime(earliest, settings.timeZone);
  const { hour, minute } = parseTime(settings.time);
  for (let offset = 0; offset <= days; offset += 1) {
    const date = addDays(start, offset);
    if (accepts(date)) {
      const instant = zonedTimeToInstant(
        { ...date, hour, minute },
        settings.timeZone
      );
      if (instant >= earliest) {
        return instant;
      }
    }
  }
  return null;
}

function nextMonthlyRun(
  settings: ScheduleSettings,
  earliest: number
): number | null {
  const start = wallTime(earliest, settings.timeZone);
  const { hour, minute } = parseTime(settings.time);
  for (let offset = 0; offset < 3; offset += 1) {
    const first = new Date(Date.UTC(start.year, start.month - 1 + offset, 1));
    const year = first.getUTCFullYear();
    const month = first.getUTCMonth() + 1;
    const last = daysInMonth(year, month);
    const day =
      settings.dayOfMonth === "last"
        ? last
        : Math.min(settings.dayOfMonth, last);
    const instant = zonedTimeToInstant(
      { year, month, day, hour, minute },
      settings.timeZone
    );
    if (instant >= earliest) {
      return instant;
    }
  }
  return null;
}

/**
 * The next time the schedule runs after `from`, computed in its time zone
 * (daylight saving included). Manual and automatic schedules have none.
 */
export function nextScheduleRun(
  input: ScheduleSettings,
  from: Date = new Date()
): Date | null {
  const settings = normalizeScheduleSettings(input);
  const earliest = earliestRun(settings, from);
  let next: number | null = null;
  switch (settings.frequency) {
    case "hourly":
      next = nextHourlyRun(settings, earliest);
      break;
    case "daily":
      next = nextDailyRun(settings, earliest, 2, () => true);
      break;
    case "weekly":
      next = nextDailyRun(
        settings,
        earliest,
        8,
        (date) => date.weekday === settings.weekday
      );
      break;
    case "monthly":
      next = nextMonthlyRun(settings, earliest);
      break;
    default:
      next = null;
  }
  return next === null ? null : new Date(next);
}

/** First day of the week for a locale: 0 = Sunday, 1 = Monday. */
export function weekStartsOn(locale: string): number {
  try {
    const info = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const firstDay = (info.getWeekInfo?.() ?? info.weekInfo)?.firstDay;
    if (typeof firstDay === "number") {
      return firstDay % 7;
    }
  } catch {
    // fall back on the region below
  }
  const region = locale.split("-")[1]?.toUpperCase();
  return ["US", "CA", "JP", "BR", "MX", "IL"].includes(region ?? "") ? 0 : 1;
}

/** Weekdays 0–6 with their names, in the locale's order. */
export function orderedWeekdays(
  locale: string,
  firstDay: number = weekStartsOn(locale)
): { value: number; label: string }[] {
  const format = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: "UTC",
  });
  // 4 January 2026 is a Sunday.
  const sunday = Date.UTC(2026, 0, 4);
  return Array.from({ length: 7 }, (_, index) => {
    const value = (firstDay + index) % 7;
    return { value, label: format.format(sunday + value * DAY_MS) };
  });
}

export type ScheduleLabelKey =
  | "schedule"
  | "scheduleFor"
  | "frequency"
  | "manual"
  | "auto"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "minute"
  | "time"
  | "weekday"
  | "dayOfMonth"
  | "lastDay"
  | "startDate"
  | "timeZone"
  | "next"
  | "nextNone"
  | "lastRun"
  | "lastRunOk"
  | "lastRunError"
  | "save"
  | "cancel"
  | "runNow"
  | "saved"
  | "loading"
  | "describeManual"
  | "describeAuto"
  | "describeHourly"
  | "describeDaily"
  | "describeWeekly"
  | "describeMonthly"
  | "describeMonthlyLast";

const ENGLISH_LABELS: Record<ScheduleLabelKey, string> = {
  schedule: "Schedule",
  scheduleFor: "Schedule {name}",
  frequency: "Frequency",
  manual: "Manual",
  auto: "Automatic (on change)",
  hourly: "Hourly",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  minute: "Minute of the hour",
  time: "Time",
  weekday: "Day of the week",
  dayOfMonth: "Day of the month",
  lastDay: "Last day",
  startDate: "Start date",
  timeZone: "Time zone",
  next: "Next: {date} ({zone})",
  nextNone: "No scheduled run",
  lastRun: "Last run: {date}",
  lastRunOk: "succeeded",
  lastRunError: "failed",
  save: "Save",
  cancel: "Cancel",
  runNow: "Run now",
  saved: "Schedule saved",
  loading: "Loading…",
  describeManual: "Runs only with Run now",
  describeAuto: "Runs when the data changes",
  describeHourly: "Every hour at :{minute}",
  describeDaily: "Every day at {time} ({zone})",
  describeWeekly: "Every {weekday} at {time} ({zone})",
  describeMonthly: "Day {day} of each month at {time} ({zone})",
  describeMonthlyLast: "Last day of each month at {time} ({zone})",
};

const FRENCH_LABELS: Record<ScheduleLabelKey, string> = {
  schedule: "Planification",
  scheduleFor: "Planifier {name}",
  frequency: "Fréquence",
  manual: "Manuelle",
  auto: "Automatique (à chaque modification)",
  hourly: "Toutes les heures",
  daily: "Quotidienne",
  weekly: "Hebdomadaire",
  monthly: "Mensuelle",
  minute: "Minute de l’heure",
  time: "Heure",
  weekday: "Jour de la semaine",
  dayOfMonth: "Jour du mois",
  lastDay: "Dernier jour",
  startDate: "Date de début",
  timeZone: "Fuseau horaire",
  next: "Prochaine : {date} ({zone})",
  nextNone: "Aucune exécution planifiée",
  lastRun: "Dernière exécution : {date}",
  lastRunOk: "réussie",
  lastRunError: "échouée",
  save: "Enregistrer",
  cancel: "Annuler",
  runNow: "Exécuter maintenant",
  saved: "Planification enregistrée",
  loading: "Chargement…",
  describeManual: "Uniquement avec Exécuter maintenant",
  describeAuto: "À chaque modification des données",
  describeHourly: "Toutes les heures à :{minute}",
  describeDaily: "Tous les jours à {time} ({zone})",
  describeWeekly: "Chaque {weekday} à {time} ({zone})",
  describeMonthly: "Le {day} de chaque mois à {time} ({zone})",
  describeMonthlyLast: "Le dernier jour de chaque mois à {time} ({zone})",
};

/** Host override for a label (`schedule.<key>`), or the built-in one. */
export type ScheduleTranslate = (
  key: ScheduleLabelKey,
  fallback: string
) => string;

/** Built-in English or French labels, overridable per key by the host. */
export function scheduleLabel(
  key: ScheduleLabelKey,
  locale: string,
  translate?: ScheduleTranslate,
  params: Record<string, string | number> = {}
): string {
  const labels = locale.toLowerCase().startsWith("fr")
    ? FRENCH_LABELS
    : ENGLISH_LABELS;
  const template = translate ? translate(key, labels[key]) : labels[key];
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template
  );
}

const pad = (value: number): string => String(value).padStart(2, "0");

const DESCRIBE_KEYS: Record<ScheduleFrequency, ScheduleLabelKey> = {
  manual: "describeManual",
  auto: "describeAuto",
  hourly: "describeHourly",
  daily: "describeDaily",
  weekly: "describeWeekly",
  monthly: "describeMonthly",
};

/** One sentence for the schedule, e.g. "Every Thursday at 09:00 (Europe/Paris)". */
export function describeSchedule(
  input: ScheduleSettings,
  locale: string,
  translate?: ScheduleTranslate
): string {
  const settings = normalizeScheduleSettings(input);
  const weekday =
    orderedWeekdays(locale, 0).find(
      (option) => option.value === settings.weekday
    )?.label ?? "";
  const key =
    settings.frequency === "monthly" && settings.dayOfMonth === "last"
      ? "describeMonthlyLast"
      : DESCRIBE_KEYS[settings.frequency];
  return scheduleLabel(key, locale, translate, {
    minute: pad(settings.minute),
    time: settings.time,
    weekday,
    day: String(settings.dayOfMonth),
    zone: settings.timeZone,
  });
}

/** A run date in the schedule's time zone, e.g. "Thu 24 Sep, 09:00". */
export function formatScheduleDate(
  date: Date,
  timeZone: string,
  locale: string
): string {
  const zone = isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE;
  const day = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: zone,
  }).format(date);
  const wall = wallTime(date.getTime(), zone);
  return `${day}, ${pad(wall.hour)}:${pad(wall.minute)}`;
}

/** "Next: Thu 24 Sep, 09:00 (Europe/Paris)", or why there is none. */
export function describeNextRun(
  settings: ScheduleSettings,
  locale: string,
  translate?: ScheduleTranslate,
  from: Date = new Date(),
  hostNextRunAt?: string
): string | null {
  if (settings.frequency === "manual" || settings.frequency === "auto") {
    return null;
  }
  const hostNext = hostNextRunAt ? new Date(hostNextRunAt) : null;
  const next =
    hostNext && !Number.isNaN(hostNext.getTime())
      ? hostNext
      : nextScheduleRun(settings, from);
  if (!next) {
    return scheduleLabel("nextNone", locale, translate);
  }
  return scheduleLabel("next", locale, translate, {
    date: formatScheduleDate(next, settings.timeZone, locale),
    zone: settings.timeZone,
  });
}

/** "Last run: Wed 23 Sep, 18:00 · succeeded", when the host reports one. */
export function describeLastRun(
  status: ScheduleStatus | null | undefined,
  timeZone: string,
  locale: string,
  translate?: ScheduleTranslate
): string | null {
  const date = status?.lastRunAt ? new Date(status.lastRunAt) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }
  const parts = [
    scheduleLabel("lastRun", locale, translate, {
      date: formatScheduleDate(date, timeZone, locale),
    }),
  ];
  if (status?.lastResult) {
    parts.push(
      scheduleLabel(
        status.lastResult === "ok" ? "lastRunOk" : "lastRunError",
        locale,
        translate
      )
    );
  }
  if (status?.message) {
    parts.push(status.message);
  }
  return parts.join(" · ");
}

/** A destination the Connect screen offers to schedule. */
export function isSchedulable(
  destination: {
    kind?: string;
    schedule?: Partial<DataDestinationSchedule<never>>;
  },
  enabled: boolean | undefined
): boolean {
  return (
    enabled !== false &&
    destination.kind !== "share" &&
    typeof destination.schedule?.load === "function" &&
    typeof destination.schedule?.save === "function"
  );
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Saved settings (or the defaults) and the host status; failures become a message. */
export async function loadDestinationSchedule<TContext>(
  schedule: DataDestinationSchedule<TContext>,
  context: TContext
): Promise<{
  settings: ScheduleSettings;
  status: ScheduleStatus | null;
  error?: string;
}> {
  try {
    const [saved, status] = await Promise.all([
      schedule.load(context),
      schedule.status ? schedule.status(context) : null,
    ]);
    return {
      settings: saved
        ? normalizeScheduleSettings(saved, schedule.frequencies)
        : defaultScheduleSettings(),
      status: status ?? null,
    };
  } catch (error) {
    return {
      settings: defaultScheduleSettings(),
      status: null,
      error: errorMessage(error),
    };
  }
}

/** Save normalized settings; failures become a message instead of an exception. */
export async function saveDestinationSchedule<TContext>(
  schedule: DataDestinationSchedule<TContext>,
  settings: ScheduleSettings,
  context: TContext
): Promise<
  { ok: true; settings: ScheduleSettings } | { ok: false; error: string }
> {
  const normalized = normalizeScheduleSettings(settings, schedule.frequencies);
  try {
    await schedule.save(normalized, context);
    return { ok: true, settings: normalized };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
