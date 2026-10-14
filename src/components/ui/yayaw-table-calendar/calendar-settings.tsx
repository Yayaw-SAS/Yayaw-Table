"use client";

import { Button } from "@/src/components/ui/button";
import {
  type ViewSettingField,
  ViewSettingsPanel,
} from "@/src/components/ui/yayaw-table/components/toolbar/view-settings-panel";
import type { DisplayModeSettingsContext } from "@/src/components/ui/yayaw-table/types/display-mode-renderer";
import {
  type CalendarDurationUnit,
  type CalendarViewSettings,
  resolveCalendarSettings,
} from "@/src/components/ui/yayaw-table/utils/calendar-model";

const NONE = "";
const COLOR_TYPES = new Set(["select", "multiSelect", "text", "boolean"]);
const DURATION_TYPES = new Set(["number", "text"]);
const DURATION_UNITS: CalendarDurationUnit[] = ["minutes", "hours", "days"];
const DURATION_UNIT_LABELS: Record<CalendarDurationUnit, string> = {
  minutes: "Minutes",
  hours: "Hours",
  days: "Days",
};
const WEEK_STARTS = [
  { value: 1, key: "monday", fallback: "Monday" },
  { value: 0, key: "sunday", fallback: "Sunday" },
  { value: 6, key: "saturday", fallback: "Saturday" },
];

const onOff = (
  label: (key: string, fallback: string) => string,
  id: string,
  title: string,
  value: boolean,
  onChange: (value: boolean) => void
): ViewSettingField => ({
  id,
  label: title,
  value: value ? "on" : "off",
  options: [
    { value: "on", label: label("on", "On") },
    { value: "off", label: label("off", "Off") },
  ],
  onChange: (next) => onChange(next === "on"),
});

/** View → Card settings of the calendar: columns, layout and interactions. */
export function CalendarSettings({
  context,
}: {
  context: DisplayModeSettingsContext;
}) {
  const label = (key: string, fallback: string) =>
    context.translate(`views.calendar.${key}`, fallback);
  const view = context.settings as CalendarViewSettings;
  const active = resolveCalendarSettings(
    context.columns,
    context.defaults as CalendarViewSettings,
    view
  );
  const columns = context.columns.filter(
    (column) => column.id !== "select" && column.id !== "actions"
  );
  const option = (column: { id: string; header: string }) => ({
    value: column.id,
    label: column.header,
  });
  const dateOptions = columns
    .filter((column) => column.type === "date")
    .map(option);
  const none = { value: NONE, label: label("none", "None") };
  const update = (patch: CalendarViewSettings) => {
    const next: Record<string, unknown> = { ...view, ...patch };
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === NONE) {
        Reflect.deleteProperty(next, key);
      }
    }
    context.updateSettings(next);
  };

  const fieldOptions = columns
    .filter((column) => column.id !== active.titleColumn)
    .map(option);

  return (
    <ViewSettingsPanel
      fields={[
        {
          id: "date",
          label: label("dateColumn", "Date"),
          value: active.dateColumn ?? NONE,
          options: dateOptions,
          onChange: (value) => update({ dateColumn: value }),
        },
        {
          id: "end",
          label: label("endColumn", "End date"),
          value: active.endColumn ?? NONE,
          options: [
            none,
            ...dateOptions.filter((item) => item.value !== active.dateColumn),
          ],
          onChange: (value) => update({ endColumn: value || undefined }),
        },
        ...(active.endColumn
          ? []
          : [
              {
                id: "duration",
                label: label("durationColumn", "Duration"),
                value: active.durationColumn ?? NONE,
                options: [
                  none,
                  ...columns
                    .filter((column) => DURATION_TYPES.has(column.type))
                    .map(option),
                ],
                onChange: (value: string) =>
                  update({ durationColumn: value || undefined }),
              },
              {
                id: "durationUnit",
                label: label("durationUnit", "Duration unit"),
                value: active.durationUnit ?? "minutes",
                options: DURATION_UNITS.map((unit) => ({
                  value: unit,
                  label: label(unit, DURATION_UNIT_LABELS[unit]),
                })),
                onChange: (value: string) =>
                  update({ durationUnit: value as CalendarDurationUnit }),
              },
            ]),
        {
          id: "title",
          label: label("titleColumn", "Title"),
          value: active.titleColumn ?? NONE,
          options: columns.map(option),
          onChange: (value) => update({ titleColumn: value }),
        },
        {
          id: "color",
          label: label("colorColumn", "Color"),
          value: active.colorColumn ?? NONE,
          options: [
            none,
            ...columns
              .filter((column) => COLOR_TYPES.has(column.type))
              .map(option),
          ],
          onChange: (value) => update({ colorColumn: value || undefined }),
        },
        {
          id: "layout",
          label: label("layout", "Layout"),
          value: active.layout,
          options: [
            { value: "month", label: label("month", "Month") },
            { value: "week", label: label("week", "Week") },
            { value: "list", label: label("list", "List") },
          ],
          onChange: (value) =>
            update({ layout: value as CalendarViewSettings["layout"] }),
        },
        {
          id: "weekStart",
          label: label("weekStartsOn", "Week starts on"),
          value: String(active.weekStartsOn),
          options: WEEK_STARTS.map((day) => ({
            value: String(day.value),
            label: label(day.key, day.fallback),
          })),
          onChange: (value) => update({ weekStartsOn: Number(value) }),
        },
        onOff(
          label,
          "weekends",
          label("showWeekends", "Weekends"),
          active.showWeekends,
          (showWeekends) => update({ showWeekends })
        ),
        onOff(
          label,
          "drag",
          label("allowDragUpdate", "Move by dragging"),
          active.allowDragUpdate,
          (allowDragUpdate) => update({ allowDragUpdate })
        ),
        onOff(
          label,
          "resize",
          label("allowResize", "Stretch to change the end"),
          active.allowResize,
          (allowResize) => update({ allowResize })
        ),
        onOff(
          label,
          "create",
          label("allowCreate", "Create by clicking a day"),
          active.allowCreate,
          (allowCreate) => update({ allowCreate })
        ),
      ]}
      properties={{
        label: label("properties", "Fields"),
        options: fieldOptions,
        value: (active.cardColumnIds ?? []).filter((id) =>
          fieldOptions.some((item) => item.value === id)
        ),
        onChange: (cardColumnIds) => update({ cardColumnIds }),
        showLabels: active.showCardLabels === true,
        showLabelsLabel: label("showLabels", "Show labels"),
        onShowLabelsChange: (showCardLabels) => update({ showCardLabels }),
      }}
    >
      <Button
        className="font-normal"
        disabled={Object.keys(view).length === 0}
        onClick={() => context.updateSettings(undefined)}
        size="sm"
        type="button"
        variant="outline"
      >
        {context.translate("common.reset", "Reset")}
      </Button>
    </ViewSettingsPanel>
  );
}
