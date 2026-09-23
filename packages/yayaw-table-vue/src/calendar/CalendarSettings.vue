<script setup lang="ts">
import { computed } from "vue";
import {
  type CalendarLayout,
  type CalendarViewSettings,
  resolveCalendarSettings,
} from "../calendar-model";
import ViewSettingsPanel from "../components/controls/ViewSettingsPanel.vue";
import type { DisplayModeSettingsContext } from "../display-mode-renderer";

const props = defineProps<{ context: DisplayModeSettingsContext }>();
const NONE = "";
const COLOR_TYPES = new Set(["select", "multiSelect", "text", "boolean"]);
const WEEK_STARTS = [
  { value: 1, key: "monday", fallback: "Monday" },
  { value: 0, key: "sunday", fallback: "Sunday" },
  { value: 6, key: "saturday", fallback: "Saturday" },
];

const label = (key: string, fallback: string): string =>
  props.context.translate(`calendar.${key}`, fallback);
const view = computed(() => props.context.settings as CalendarViewSettings);
const active = computed(() =>
  resolveCalendarSettings(
    props.context.columns,
    props.context.defaults as CalendarViewSettings,
    view.value
  )
);
const columns = computed(() =>
  props.context.columns.filter(
    (column) => column.id !== "select" && column.id !== "actions" && column.type !== "actions"
  )
);
const option = (column: { id: string; header: string }) => ({
  value: column.id,
  label: column.header,
});
const dateOptions = computed(() =>
  columns.value.filter((column) => column.type === "date").map(option)
);
const none = computed(() => ({ value: NONE, label: label("none", "None") }));
const update = (patch: CalendarViewSettings): void => {
  const next: Record<string, unknown> = { ...view.value, ...patch };
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined || value === NONE) Reflect.deleteProperty(next, key);
  }
  props.context.updateSettings(next);
};
const onOff = (
  id: string,
  title: string,
  value: boolean,
  onChange: (value: boolean) => void
) => ({
  id,
  label: title,
  value: value ? "on" : "off",
  options: [
    { value: "on", label: label("on", "On") },
    { value: "off", label: label("off", "Off") },
  ],
  onChange: (next: string) => onChange(next === "on"),
});
const fields = computed(() => [
  {
    id: "date",
    label: label("dateColumn", "Date"),
    value: active.value.dateColumn ?? NONE,
    options: dateOptions.value,
    onChange: (value: string) => update({ dateColumn: value }),
  },
  {
    id: "end",
    label: label("endColumn", "End date"),
    value: active.value.endColumn ?? NONE,
    options: [
      none.value,
      ...dateOptions.value.filter((item) => item.value !== active.value.dateColumn),
    ],
    onChange: (value: string) => update({ endColumn: value || undefined }),
  },
  {
    id: "title",
    label: label("titleColumn", "Title"),
    value: active.value.titleColumn ?? NONE,
    options: columns.value.map(option),
    onChange: (value: string) => update({ titleColumn: value }),
  },
  {
    id: "color",
    label: label("colorColumn", "Color"),
    value: active.value.colorColumn ?? NONE,
    options: [
      none.value,
      ...columns.value
        .filter((column) => COLOR_TYPES.has(String(column.type ?? "text")))
        .map(option),
    ],
    onChange: (value: string) => update({ colorColumn: value || undefined }),
  },
  {
    id: "layout",
    label: label("layout", "Layout"),
    value: active.value.layout,
    options: [
      { value: "month", label: label("month", "Month") },
      { value: "week", label: label("week", "Week") },
      { value: "list", label: label("list", "List") },
    ],
    onChange: (value: string) => update({ layout: value as CalendarLayout }),
  },
  {
    id: "weekStart",
    label: label("weekStartsOn", "Week starts on"),
    value: String(active.value.weekStartsOn),
    options: WEEK_STARTS.map((day) => ({
      value: String(day.value),
      label: label(day.key, day.fallback),
    })),
    onChange: (value: string) => update({ weekStartsOn: Number(value) }),
  },
  onOff("weekends", label("showWeekends", "Weekends"), active.value.showWeekends, (showWeekends) => update({ showWeekends })),
  onOff("drag", label("allowDragUpdate", "Move by dragging"), active.value.allowDragUpdate, (allowDragUpdate) => update({ allowDragUpdate })),
  onOff("resize", label("allowResize", "Stretch to change the end"), active.value.allowResize, (allowResize) => update({ allowResize })),
  onOff("create", label("allowCreate", "Create by clicking a day"), active.value.allowCreate, (allowCreate) => update({ allowCreate })),
]);
</script>

<template>
  <ViewSettingsPanel :fields="fields">
    <button
      type="button"
      class="yayaw-button yayaw-button-outline"
      :disabled="Object.keys(view).length === 0"
      @click="props.context.updateSettings(undefined)"
    >
      {{ props.context.translate("reset", "Reset") }}
    </button>
  </ViewSettingsPanel>
</template>
