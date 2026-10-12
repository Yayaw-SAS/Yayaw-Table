import { it } from "vitest";
import { calendarModelSuite } from "../../../tests/calendar-model-suite";
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
} from "./calendar-model";
import { normalizeModeConfig, resolveDisplayModes } from "./display-modes";

calendarModelSuite(
  it,
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
  { normalizeModeConfig, resolveDisplayModes }
);
