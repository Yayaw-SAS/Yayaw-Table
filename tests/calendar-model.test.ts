import { test } from "bun:test";
import {
  addDays,
  calendarCanResize,
  calendarCreateValues,
  calendarEvents,
  calendarMovePatch,
  calendarScope,
  daysBetween,
  normalizeCalendarViewConfig,
  parseDurationMinutes,
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
    calendarCanResize,
    calendarCreateValues,
    calendarEvents,
    calendarMovePatch,
    calendarScope,
    daysBetween,
    normalizeCalendarViewConfig,
    parseDurationMinutes,
    resolveCalendarSettings,
  },
  {
    normalizeModeConfig,
    resolveDisplayModes,
  }
);
