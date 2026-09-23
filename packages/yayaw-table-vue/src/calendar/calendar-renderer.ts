import type { DisplayModeRenderer } from "../display-mode-renderer";
import CalendarSettings from "./CalendarSettings.vue";
import CalendarView from "./CalendarView.vue";

/**
 * Pass to `<YayawDataTable :display-mode-renderers="{ calendar: calendarRenderer }" />`
 * and list `"calendar"` in `table.displayModes`.
 */
export const calendarRenderer: DisplayModeRenderer = {
  view: CalendarView,
  settings: CalendarSettings,
};
