import { test } from "bun:test";
import {
  defaultScheduleSettings,
  describeLastRun,
  describeNextRun,
  describeSchedule,
  isSchedulable,
  loadDestinationSchedule,
  nextScheduleRun,
  normalizeScheduleSettings,
  orderedWeekdays,
  saveDestinationSchedule,
  scheduleFields,
  scheduleFrequencies,
  scheduleTimeZones,
  zonedTimeToInstant,
} from "../src/components/ui/yayaw-table/utils/schedule-model";
import { scheduleModelSuite } from "./schedule-model-suite";

scheduleModelSuite(test, {
  defaultScheduleSettings,
  describeLastRun,
  describeNextRun,
  describeSchedule,
  isSchedulable,
  loadDestinationSchedule,
  nextScheduleRun,
  normalizeScheduleSettings,
  orderedWeekdays,
  saveDestinationSchedule,
  scheduleFields,
  scheduleFrequencies,
  scheduleTimeZones,
  zonedTimeToInstant,
});
