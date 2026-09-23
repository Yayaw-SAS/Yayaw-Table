"use client";

import { CalendarClock, Loader2, Play } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  StackMenuContent,
  useStackMenu,
} from "@/components/ui/custom/stack-menu";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import type { DataDestinationContext } from "../../utils/data-destinations";
import {
  type DataDestinationSchedule,
  describeLastRun,
  describeNextRun,
  describeSchedule,
  loadDestinationSchedule,
  orderedWeekdays,
  type ScheduleFrequency,
  type ScheduleLabelKey,
  type ScheduleSettings,
  type ScheduleStatus,
  saveDestinationSchedule,
  scheduleFields,
  scheduleFrequencies,
  scheduleLabel,
  scheduleTimeZones,
  type ScheduleTranslate,
} from "../../utils/schedule-model";
import { TableTooltip } from "../../utils/table-tooltip";
import { type ViewSettingField, ViewSettingsPanel } from "./view-settings-panel";

const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, index) => index + 1);

interface SchedulePanelProps {
  schedule: DataDestinationSchedule<DataDestinationContext>;
  context: () => DataDestinationContext;
  locale: string;
  translate: ScheduleTranslate;
  running: boolean;
  onRunNow: () => Promise<void>;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}

/** Frequency, day, week day and time zone choices for the current frequency. */
function scheduleChoiceFields({
  settings,
  frequencies,
  locale,
  label,
  update,
}: {
  settings: ScheduleSettings;
  frequencies: ScheduleFrequency[];
  locale: string;
  label: (key: ScheduleLabelKey) => string;
  update: (patch: Partial<ScheduleSettings>) => void;
}): ViewSettingField[] {
  const visible = scheduleFields(settings.frequency);
  const fields: ViewSettingField[] = [
    {
      id: "frequency",
      label: label("frequency"),
      value: settings.frequency,
      options: frequencies.map((frequency) => ({
        value: frequency,
        label: label(frequency),
      })),
      onChange: (value) => update({ frequency: value as ScheduleFrequency }),
    },
  ];
  if (visible.weekday) {
    fields.push({
      id: "weekday",
      label: label("weekday"),
      value: String(settings.weekday),
      options: orderedWeekdays(locale).map((day) => ({
        value: String(day.value),
        label: day.label,
      })),
      onChange: (value) => update({ weekday: Number(value) }),
    });
  }
  if (visible.dayOfMonth) {
    fields.push({
      id: "dayOfMonth",
      label: label("dayOfMonth"),
      value: String(settings.dayOfMonth),
      options: [
        ...DAYS_OF_MONTH.map((day) => ({
          value: String(day),
          label: String(day),
        })),
        { value: "last", label: label("lastDay") },
      ],
      onChange: (value) =>
        update({ dayOfMonth: value === "last" ? "last" : Number(value) }),
    });
  }
  if (visible.timing) {
    fields.push({
      id: "timeZone",
      label: label("timeZone"),
      value: settings.timeZone,
      options: scheduleTimeZones(settings.timeZone).map((zone) => ({
        value: zone,
        label: zone,
      })),
      onChange: (value) => update({ timeZone: value }),
    });
  }
  return fields;
}

/** Minute, time and start date inputs for the current frequency. */
function ScheduleInputs({
  settings,
  label,
  update,
}: {
  settings: ScheduleSettings;
  label: (key: ScheduleLabelKey) => string;
  update: (patch: Partial<ScheduleSettings>) => void;
}) {
  const id = useId();
  const visible = scheduleFields(settings.frequency);
  return (
    <>
      {visible.minute ? (
        <div className="grid gap-1.5">
          <label className="text-muted-foreground text-sm" htmlFor={`${id}-minute`}>
            {label("minute")}
          </label>
          <Input
            id={`${id}-minute`}
            max={59}
            min={0}
            onChange={(event) => update({ minute: Number(event.target.value) })}
            type="number"
            value={settings.minute}
          />
        </div>
      ) : null}
      {visible.time ? (
        <div className="grid gap-1.5">
          <label className="text-muted-foreground text-sm" htmlFor={`${id}-time`}>
            {label("time")}
          </label>
          <Input
            id={`${id}-time`}
            onChange={(event) => update({ time: event.target.value })}
            type="time"
            value={settings.time}
          />
        </div>
      ) : null}
      {visible.timing ? (
        <div className="grid gap-1.5">
          <label className="text-muted-foreground text-sm" htmlFor={`${id}-start`}>
            {label("startDate")}
          </label>
          <Input
            id={`${id}-start`}
            onChange={(event) =>
              update({ startDate: event.target.value || undefined })
            }
            type="date"
            value={settings.startDate ?? ""}
          />
        </div>
      ) : null}
    </>
  );
}

/**
 * Scheduling settings of one Connect destination for the current view. The
 * table edits and previews them; the host saves and runs the schedule.
 */
export function SchedulePanel({
  schedule,
  context,
  locale,
  translate,
  running,
  onRunNow,
  onSaved,
  onError,
}: SchedulePanelProps) {
  const { goBack } = useStackMenu();
  const [settings, setSettings] = useState<ScheduleSettings>();
  const [status, setStatus] = useState<ScheduleStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const label = (key: ScheduleLabelKey) => scheduleLabel(key, locale, translate);
  const frequencies = useMemo(
    () => scheduleFrequencies(schedule.frequencies),
    [schedule.frequencies]
  );
  // The view the screen was opened on owns the schedule; load it once.
  const [opened] = useState(() => ({ schedule, context: context() }));
  const reportError = useRef(onError);
  reportError.current = onError;
  useEffect(() => {
    let active = true;
    loadDestinationSchedule(opened.schedule, opened.context)
      .then((loaded) => {
        if (!active) {
          return;
        }
        setSettings(loaded.settings);
        setStatus(loaded.status);
        if (loaded.error) {
          reportError.current(loaded.error);
        }
      })
      .catch(() => {
        /* failures are reported above */
      });
    return () => {
      active = false;
    };
  }, [opened]);

  if (!settings) {
    return (
      <StackMenuContent className="p-3" data-schedule-panel>
        <p className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          {label("loading")}
        </p>
      </StackMenuContent>
    );
  }
  const update = (patch: Partial<ScheduleSettings>) =>
    setSettings((current) => (current ? { ...current, ...patch } : current));
  const save = async () => {
    setSaving(true);
    const result = await saveDestinationSchedule(
      opened.schedule,
      settings,
      opened.context
    );
    setSaving(false);
    if (result.ok) {
      onSaved(label("saved"));
      goBack();
    } else {
      onError(result.error);
    }
  };
  const next = describeNextRun(
    settings,
    locale,
    translate,
    new Date(),
    status?.nextRunAt
  );
  const lastRun = describeLastRun(status, settings.timeZone, locale, translate);

  return (
    <StackMenuContent className="p-3" data-schedule-panel>
      <ViewSettingsPanel
        fields={scheduleChoiceFields({
          settings,
          frequencies,
          locale,
          label,
          update,
        })}
      >
        <ScheduleInputs label={label} settings={settings} update={update} />
        <div
          aria-live="polite"
          className="grid gap-1 rounded-md bg-muted px-3 py-2 text-sm"
          data-schedule-summary
        >
          <p>{describeSchedule(settings, locale, translate)}</p>
          {next ? (
            <p className="text-muted-foreground" data-schedule-next>
              {next}
            </p>
          ) : null}
          {lastRun ? (
            <p className="text-muted-foreground" data-schedule-last-run>
              {lastRun}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="flex-1"
            disabled={saving}
            onClick={() => {
              save().catch(() => {
                /* failures are reported by save */
              });
            }}
            type="button"
          >
            {saving ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : null}
            {label("save")}
          </Button>
          <Button
            className="flex-1"
            onClick={goBack}
            type="button"
            variant="outline"
          >
            {label("cancel")}
          </Button>
        </div>
        <Button
          aria-busy={running}
          className="w-full"
          disabled={running}
          onClick={() => {
            onRunNow().catch(() => {
              /* failures are reported by the runner */
            });
          }}
          type="button"
          variant="ghost"
        >
          {running ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Play aria-hidden="true" className="size-4" />
          )}
          {label("runNow")}
        </Button>
      </ViewSettingsPanel>
    </StackMenuContent>
  );
}

/** The secondary control on a Connect row that opens its schedule screen. */
export function DestinationScheduleButton({
  label,
  screen,
}: {
  label: string;
  screen: string;
}) {
  const { navigate } = useStackMenu();
  return (
    <TableTooltip label={label}>
      <Button
        aria-label={label}
        className="size-8 shrink-0"
        data-schedule-trigger
        onClick={() => navigate(screen, label)}
        size="icon"
        type="button"
        variant="ghost"
      >
        <CalendarClock aria-hidden="true" className="size-4" />
      </Button>
    </TableTooltip>
  );
}
