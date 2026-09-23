import type { DisplayModeRenderer } from "@/components/ui/yayaw-table/types/display-mode-renderer";
import { CalendarSettings } from "./calendar-settings";
import { CalendarView } from "./calendar-view";

/**
 * Pass to `<DataTable displayModeRenderers={{ calendar: calendarRenderer }} />`
 * and list `"calendar"` in `table.displayModes`.
 */
export const calendarRenderer: DisplayModeRenderer = {
  View: CalendarView,
  Settings: CalendarSettings,
};
