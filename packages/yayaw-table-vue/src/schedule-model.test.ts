import { it } from "vitest";
import { scheduleModelSuite } from "../../../tests/schedule-model-suite";
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
} from "./schedule-model";

scheduleModelSuite(it, {
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
