import {
  type PlanningCalendar,
  PlanningError,
  type PlanningSnapshot,
  type PlanningTask,
} from "./types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
/** Integer UTC day arithmetic avoids daylight-saving and browser time-zone drift. */
export function dateDay(value: string): number {
  if (!DATE_PATTERN.test(value)) {
    throw new PlanningError("invalid-date", `Invalid civil date: ${value}`);
  }
  const time = Date.parse(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(time) ||
    new Date(time).toISOString().slice(0, 10) !== value
  ) {
    throw new PlanningError("invalid-date", `Invalid civil date: ${value}`);
  }
  return time / DAY_MS;
}
export function dayDate(day: number): string {
  if (!Number.isInteger(day)) {
    throw new PlanningError("invalid-date", "A date must use whole days.");
  }
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}
export const isWorkingDay = (
  day: number,
  calendar: PlanningCalendar
): boolean =>
  calendar.exceptions?.[dayDate(day)] ??
  calendar.workingDays.includes((((day + 4) % 7) + 7) % 7);

export function seekWorkingDay(
  day: number,
  direction: 1 | -1,
  calendar: PlanningCalendar,
  limit = 36_600
): number {
  let current = day;
  for (let count = 0; count < limit; count += 1, current += direction) {
    if (isWorkingDay(current, calendar)) {
      return current;
    }
  }
  throw new PlanningError(
    "calendar-exhausted",
    `No working date found in calendar ${calendar.id}.`
  );
}
export function addWorkingDays(
  day: number,
  amount: number,
  calendar: PlanningCalendar,
  limit = 36_600
): number {
  if (!Number.isSafeInteger(amount) || Math.abs(amount) > limit) {
    throw new PlanningError(
      "invalid-duration",
      "Working-day offsets must be bounded integers."
    );
  }
  const direction = amount < 0 ? -1 : 1;
  let remaining = Math.abs(amount);
  let current = day;
  for (let visited = 0; remaining > 0 && visited < limit; visited += 1) {
    current += direction;
    if (isWorkingDay(current, calendar)) {
      remaining -= 1;
    }
  }
  if (remaining) {
    throw new PlanningError(
      "calendar-exhausted",
      `Offset exceeds calendar ${calendar.id}.`
    );
  }
  return current;
}
export function workingDuration(
  start: number,
  end: number,
  calendar: PlanningCalendar,
  limit = 36_600
): number {
  if (end < start || end - start > limit) {
    throw new PlanningError(
      "invalid-duration",
      "Task dates are reversed or exceed the supported horizon."
    );
  }
  let duration = 0;
  for (let day = start; day <= end; day += 1) {
    if (isWorkingDay(day, calendar)) {
      duration += 1;
    }
  }
  if (!duration) {
    throw new PlanningError(
      "invalid-duration",
      "A scheduled task must include a working day."
    );
  }
  return duration;
}
export function taskCalendar(
  task: PlanningTask,
  snapshot: PlanningSnapshot
): PlanningCalendar {
  const source = snapshot.sources.find((item) => item.id === task.ref.source);
  if (!source) {
    throw new PlanningError(
      "missing-source",
      `Unknown source ${task.ref.source}.`
    );
  }
  const id = task.calendarId ?? source.calendarId ?? snapshot.defaultCalendarId;
  const calendar = snapshot.calendars.find((item) => item.id === id);
  if (!calendar) {
    throw new PlanningError("missing-calendar", `Unknown calendar ${id}.`);
  }
  return calendar;
}
