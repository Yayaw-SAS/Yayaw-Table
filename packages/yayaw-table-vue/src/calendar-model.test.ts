import { it } from "vitest";
import { calendarModelSuite } from "../../../tests/calendar-model-suite";
import {
  addDays,
  calendarEvents,
  calendarMovePatch,
  calendarScope,
  daysBetween,
  normalizeCalendarViewConfig,
  resolveCalendarSettings,
} from "./calendar-model";
import { normalizeModeConfig, resolveDisplayModes } from "./display-modes";

calendarModelSuite(
  it,
  {
    addDays,
    calendarEvents,
    calendarMovePatch,
    calendarScope,
    daysBetween,
    normalizeCalendarViewConfig,
    resolveCalendarSettings,
  },
  { normalizeModeConfig, resolveDisplayModes }
);
