import assert from "node:assert/strict";
import type * as Model from "../src/components/ui/yayaw-table/utils/schedule-model";

type ScheduleModel = Pick<
  typeof Model,
  | "defaultScheduleSettings"
  | "describeLastRun"
  | "describeNextRun"
  | "describeSchedule"
  | "isSchedulable"
  | "loadDestinationSchedule"
  | "nextScheduleRun"
  | "normalizeScheduleSettings"
  | "orderedWeekdays"
  | "saveDestinationSchedule"
  | "scheduleFields"
  | "scheduleFrequencies"
  | "scheduleTimeZones"
  | "zonedTimeToInstant"
>;

const base = {
  frequency: "daily" as const,
  minute: 0,
  time: "09:00",
  weekday: 1,
  dayOfMonth: 1 as number | "last",
  timeZone: "UTC",
};

// ICU versions abbreviate September as "Sep" or "Sept".
const NEXT_THURSDAY = /^Next: Thu 24 Sept?, 09:00 \(Europe\/Paris\)$/;
const NEXT_FRIDAY_FROM_HOST = /^Next: Fri 25 Sept?, 09:00 \(Europe\/Paris\)$/;
const LAST_RUN_FAILED = /^Last run: Wed 23 Sept?, 18:00 · failed · Timeout$/;

const at = (iso: string) => new Date(iso);

export function scheduleModelSuite(
  test: (name: string, body: () => void | Promise<void>) => void,
  model: ScheduleModel
) {
  const next = (
    settings: Partial<Model.ScheduleSettings>,
    from: string
  ): string | undefined =>
    model.nextScheduleRun({ ...base, ...settings }, at(from))?.toISOString();

  test("normalizes settings: unknown frequency, clamped values, invalid zone", () => {
    const settings = model.normalizeScheduleSettings({
      frequency: "yearly",
      minute: 75,
      time: "25:10",
      weekday: -3,
      dayOfMonth: 40,
      startDate: "2026-02-30",
      timeZone: "Mars/Olympus",
    });
    assert.equal(settings.frequency, "manual");
    assert.equal(settings.minute, 59);
    assert.equal(settings.time, "09:00");
    assert.equal(settings.weekday, 0);
    assert.equal(settings.dayOfMonth, 31);
    assert.equal(settings.startDate, undefined);
    assert.equal(
      settings.timeZone,
      Intl.DateTimeFormat().resolvedOptions().timeZone
    );
    const kept = model.normalizeScheduleSettings({
      ...base,
      frequency: "monthly",
      time: "7:05",
      dayOfMonth: "last",
      startDate: "2028-02-29",
      timeZone: "Europe/Paris",
    });
    assert.equal(kept.time, "07:05");
    assert.equal(kept.dayOfMonth, "last");
    assert.equal(kept.startDate, "2028-02-29");
    assert.equal(kept.timeZone, "Europe/Paris");
    assert.equal(model.normalizeScheduleSettings(null).frequency, "manual");
    // A frequency the destination does not offer falls back to manual.
    assert.equal(
      model.normalizeScheduleSettings({ ...base, frequency: "hourly" }, [
        "daily",
      ]).frequency,
      "manual"
    );
  });

  test("offers manual first and only the declared frequencies", () => {
    assert.deepEqual(model.scheduleFrequencies(["weekly", "daily"]), [
      "manual",
      "daily",
      "weekly",
    ]);
    assert.equal(model.scheduleFrequencies().length, 6);
    assert.deepEqual(model.scheduleFields("manual"), {
      minute: false,
      time: false,
      weekday: false,
      dayOfMonth: false,
      timing: false,
    });
    assert.equal(model.scheduleFields("weekly").weekday, true);
    assert.equal(model.scheduleFields("hourly").time, false);
    assert.ok(model.scheduleTimeZones("Europe/Paris").includes("Europe/Paris"));
    assert.ok(model.scheduleTimeZones().includes("UTC"));
  });

  test("manual and automatic schedules have no next run", () => {
    assert.equal(
      next({ frequency: "manual" }, "2026-09-23T10:00:00Z"),
      undefined
    );
    assert.equal(
      next({ frequency: "auto" }, "2026-09-23T10:00:00Z"),
      undefined
    );
    assert.equal(
      model.describeNextRun(
        { ...base, frequency: "manual" },
        "en",
        undefined,
        at("2026-09-23T10:00:00Z")
      ),
      null
    );
  });

  test("daily runs follow Paris daylight saving (spring forward)", () => {
    const paris = { timeZone: "Europe/Paris" };
    // 29 March 2026: clocks go from 02:00 to 03:00.
    assert.equal(
      next(paris, "2026-03-28T09:00:00Z"),
      "2026-03-29T07:00:00.000Z"
    );
    assert.equal(
      next(paris, "2026-03-27T07:30:00Z"),
      "2026-03-27T08:00:00.000Z"
    );
    // 02:30 does not exist that day and moves to 03:30.
    assert.equal(
      next({ ...paris, time: "02:30" }, "2026-03-28T12:00:00Z"),
      "2026-03-29T01:30:00.000Z"
    );
  });

  test("daily runs follow Paris daylight saving (fall back)", () => {
    const paris = { timeZone: "Europe/Paris" };
    // 25 October 2026: 02:30 happens twice; the first one runs.
    assert.equal(
      next({ ...paris, time: "02:30" }, "2026-10-24T12:00:00Z"),
      "2026-10-25T00:30:00.000Z"
    );
    assert.equal(
      next(paris, "2026-10-24T08:00:00Z"),
      "2026-10-25T08:00:00.000Z"
    );
    assert.equal(
      model.zonedTimeToInstant(
        { year: 2026, month: 10, day: 25, hour: 2, minute: 30 },
        "Europe/Paris"
      ),
      Date.parse("2026-10-25T00:30:00Z")
    );
  });

  test("weekly and daily runs follow New York daylight saving", () => {
    const newYork = { timeZone: "America/New_York" };
    // 8 March 2026: EST → EDT.
    assert.equal(
      next(
        { ...newYork, frequency: "weekly", weekday: 0 },
        "2026-03-02T00:00:00Z"
      ),
      "2026-03-08T13:00:00.000Z"
    );
    // 1 November 2026: EDT → EST.
    assert.equal(
      next(newYork, "2026-10-31T14:00:00Z"),
      "2026-11-01T14:00:00.000Z"
    );
    assert.equal(
      next({ ...newYork, time: "02:30" }, "2026-03-07T12:00:00Z"),
      "2026-03-08T07:30:00.000Z"
    );
  });

  test("hourly runs keep the minute of the hour, strictly after now", () => {
    const hourly = { frequency: "hourly" as const, minute: 15 };
    assert.equal(
      next(hourly, "2026-09-23T10:00:00Z"),
      "2026-09-23T10:15:00.000Z"
    );
    assert.equal(
      next(hourly, "2026-09-23T10:15:00Z"),
      "2026-09-23T11:15:00.000Z"
    );
    assert.equal(
      next(hourly, "2026-09-23T10:40:30Z"),
      "2026-09-23T11:15:00.000Z"
    );
    // Across the Paris fall back, every real hour still runs.
    assert.equal(
      next({ ...hourly, timeZone: "Europe/Paris" }, "2026-10-25T00:20:00Z"),
      "2026-10-25T01:15:00.000Z"
    );
    // Half-hour zones use their own minute.
    assert.equal(
      next(
        { frequency: "hourly", minute: 0, timeZone: "Asia/Kolkata" },
        "2026-09-23T10:00:00Z"
      ),
      "2026-09-23T10:30:00.000Z"
    );
  });

  test("weekly runs wrap to the next week", () => {
    const weekly = { frequency: "weekly" as const };
    // 23 September 2026 is a Wednesday.
    assert.equal(
      next({ ...weekly, weekday: 1 }, "2026-09-23T10:00:00Z"),
      "2026-09-28T09:00:00.000Z"
    );
    assert.equal(
      next({ ...weekly, weekday: 3 }, "2026-09-23T08:00:00Z"),
      "2026-09-23T09:00:00.000Z"
    );
    assert.equal(
      next({ ...weekly, weekday: 3 }, "2026-09-23T09:00:00Z"),
      "2026-09-30T09:00:00.000Z"
    );
    assert.equal(
      next({ ...weekly, weekday: 6 }, "2026-12-31T12:00:00Z"),
      "2027-01-02T09:00:00.000Z"
    );
  });

  test("monthly runs use the last day when the month is shorter", () => {
    const monthly = { frequency: "monthly" as const };
    assert.equal(
      next({ ...monthly, dayOfMonth: "last" }, "2028-02-10T00:00:00Z"),
      "2028-02-29T09:00:00.000Z"
    );
    assert.equal(
      next({ ...monthly, dayOfMonth: "last" }, "2027-02-10T00:00:00Z"),
      "2027-02-28T09:00:00.000Z"
    );
    assert.equal(
      next({ ...monthly, dayOfMonth: 29 }, "2028-02-01T00:00:00Z"),
      "2028-02-29T09:00:00.000Z"
    );
    assert.equal(
      next({ ...monthly, dayOfMonth: 29 }, "2027-02-01T00:00:00Z"),
      "2027-02-28T09:00:00.000Z"
    );
    assert.equal(
      next({ ...monthly, dayOfMonth: 31 }, "2026-04-01T00:00:00Z"),
      "2026-04-30T09:00:00.000Z"
    );
    assert.equal(
      next({ ...monthly, dayOfMonth: 15 }, "2026-09-20T00:00:00Z"),
      "2026-10-15T09:00:00.000Z"
    );
    assert.equal(
      next({ ...monthly, dayOfMonth: 31 }, "2026-12-31T10:00:00Z"),
      "2027-01-31T09:00:00.000Z"
    );
    assert.equal(
      next(
        { ...monthly, dayOfMonth: "last", timeZone: "Europe/Paris" },
        "2026-10-01T00:00:00Z"
      ),
      "2026-10-31T08:00:00.000Z"
    );
  });

  test("a start date in the future delays the first run", () => {
    assert.equal(
      next({ startDate: "2026-10-10" }, "2026-09-23T10:00:00Z"),
      "2026-10-10T09:00:00.000Z"
    );
    // The start date is a day in the schedule's time zone.
    assert.equal(
      next(
        { startDate: "2026-10-10", time: "00:30", timeZone: "Europe/Paris" },
        "2026-09-23T10:00:00Z"
      ),
      "2026-10-09T22:30:00.000Z"
    );
    assert.equal(
      next({ startDate: "2026-01-01" }, "2026-09-23T10:00:00Z"),
      "2026-09-24T09:00:00.000Z"
    );
    assert.equal(
      next(
        { frequency: "hourly", minute: 30, startDate: "2026-10-10" },
        "2026-09-23T10:00:00Z"
      ),
      "2026-10-10T00:30:00.000Z"
    );
  });

  test("describes the schedule and its next run in English and French", () => {
    const weekly = {
      ...base,
      frequency: "weekly" as const,
      weekday: 4,
      timeZone: "Europe/Paris",
    };
    assert.equal(
      model.describeSchedule(weekly, "en-GB"),
      "Every Thursday at 09:00 (Europe/Paris)"
    );
    assert.equal(
      model.describeSchedule(weekly, "fr-FR"),
      "Chaque jeudi à 09:00 (Europe/Paris)"
    );
    assert.equal(
      model.describeSchedule(
        { ...base, frequency: "monthly", dayOfMonth: "last" },
        "en"
      ),
      "Last day of each month at 09:00 (UTC)"
    );
    assert.equal(
      model.describeSchedule({ ...base, frequency: "hourly", minute: 5 }, "fr"),
      "Toutes les heures à :05"
    );
    assert.equal(
      model.describeSchedule(weekly, "en", (key, fallback) =>
        key === "describeWeekly" ? "Each {weekday}" : fallback
      ),
      "Each Thursday"
    );
    assert.match(
      model.describeNextRun(
        weekly,
        "en-GB",
        undefined,
        at("2026-09-23T12:00:00Z")
      ) ?? "",
      NEXT_THURSDAY
    );
    assert.equal(
      model.describeNextRun(
        weekly,
        "fr-FR",
        undefined,
        at("2026-09-23T12:00:00Z")
      ),
      "Prochaine : jeu. 24 sept., 09:00 (Europe/Paris)"
    );
    // The host's own next run wins over the preview.
    assert.match(
      model.describeNextRun(
        weekly,
        "en-GB",
        undefined,
        at("2026-09-23T12:00:00Z"),
        "2026-09-25T07:00:00Z"
      ) ?? "",
      NEXT_FRIDAY_FROM_HOST
    );
    assert.match(
      model.describeLastRun(
        {
          lastRunAt: "2026-09-23T16:00:00Z",
          lastResult: "error",
          message: "Timeout",
        },
        "Europe/Paris",
        "en-GB"
      ) ?? "",
      LAST_RUN_FAILED
    );
    assert.equal(model.describeLastRun(null, "UTC", "en"), null);
  });

  test("orders weekdays from the locale's first day", () => {
    assert.equal(model.orderedWeekdays("fr-FR")[0]?.value, 1);
    assert.equal(model.orderedWeekdays("en-US")[0]?.value, 0);
    assert.equal(model.orderedWeekdays("en-US")[0]?.label, "Sunday");
    assert.equal(model.orderedWeekdays("fr-FR", 1)[6]?.label, "dimanche");
  });

  test("loads and saves through the destination, reporting failures", async () => {
    const context = { viewId: "v1" };
    const saved: unknown[] = [];
    const schedule = {
      frequencies: ["weekly" as const],
      load: () => null,
      save: (settings: Model.ScheduleSettings, received: typeof context) => {
        saved.push([settings.frequency, settings.minute, received.viewId]);
      },
      status: () => ({ lastResult: "ok" as const }),
    };
    const loaded = await model.loadDestinationSchedule(schedule, context);
    assert.equal(loaded.settings.frequency, "manual");
    assert.deepEqual(loaded.status, { lastResult: "ok" });
    const result = await model.saveDestinationSchedule(
      schedule,
      { ...base, frequency: "weekly", minute: 99 },
      context
    );
    assert.deepEqual(saved, [["weekly", 59, "v1"]]);
    assert.equal(result.ok, true);
    const failing = {
      load: () => Promise.reject(new Error("offline")),
      save: () => Promise.reject(new Error("denied")),
    };
    assert.equal(
      (await model.loadDestinationSchedule(failing, context)).error,
      "offline"
    );
    assert.deepEqual(
      await model.saveDestinationSchedule(failing, base, context),
      { ok: false, error: "denied" }
    );
    assert.equal(
      model.isSchedulable({ kind: "connect", schedule }, undefined),
      true
    );
    assert.equal(
      model.isSchedulable({ kind: "connect", schedule }, false),
      false
    );
    assert.equal(model.isSchedulable({ kind: "share", schedule }, true), false);
    assert.equal(model.isSchedulable({ kind: "connect" }, true), false);
    assert.equal(
      model.defaultScheduleSettings("Europe/Paris").timeZone,
      "Europe/Paris"
    );
  });
}
