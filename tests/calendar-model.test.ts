import { test } from "bun:test";
import {
  addDays,
  calendarEvents,
  calendarMovePatch,
  calendarScope,
  daysBetween,
  normalizeCalendarViewConfig,
  resolveCalendarSettings,
} from "../src/components/ui/yayaw-table/utils/calendar-model";
import {
  normalizeModeConfig,
  resolveDisplayModes,
} from "../src/components/ui/yayaw-table/utils/display-modes";
import { calendarModelSuite } from "./calendar-model-suite";

calendarModelSuite(
  test,
  {
    addDays,
    calendarEvents,
    calendarMovePatch,
    calendarScope,
    daysBetween,
    normalizeCalendarViewConfig,
    resolveCalendarSettings,
  },
  {
    normalizeModeConfig,
    resolveDisplayModes,
  }
);
