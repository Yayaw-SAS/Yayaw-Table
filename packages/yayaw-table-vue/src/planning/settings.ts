import { type PlanningSurfaceLabels, planningLabels } from "./labels";

const WEEK_ORIGIN = Date.UTC(2026, 0, 4);
const DAYS_IN_WEEK = 7;
const DAY_MS = 86_400_000;

/** Shared presentation labels keep React and Vue planning settings equivalent. */
export function ganttSettingsLabels(
  locale = "en",
  overrides?: Partial<PlanningSurfaceLabels>
) {
  const labels = planningLabels(locale, overrides);
  return {
    title: labels.settings,
    zoom: labels.zoom,
    weekStart: labels.weekStart,
    showDependencies: labels.showLinks,
    zoomOptions: [
      { value: "day", label: labels.day },
      { value: "week", label: labels.week },
      { value: "month", label: labels.month },
    ],
    weekOptions: Array.from({ length: DAYS_IN_WEEK }, (_, day) => ({
      value: String(day),
      label: new Intl.DateTimeFormat(locale, {
        weekday: "long",
        timeZone: "UTC",
      }).format(new Date(WEEK_ORIGIN + day * DAY_MS)),
    })),
  };
}
