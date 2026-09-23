<script setup lang="ts">
import { Play } from "lucide-vue-next";
import { computed, onMounted, ref, useId } from "vue";
import type { DataDestinationContext } from "../../data-destinations";
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
} from "../../schedule-model";
import ViewSettingsPanel from "../controls/ViewSettingsPanel.vue";

/**
 * Scheduling settings of one Connect destination for the current view. The
 * table edits and previews them; the host saves and runs the schedule.
 */
const props = defineProps<{
  schedule: DataDestinationSchedule<DataDestinationContext>;
  context: () => DataDestinationContext;
  locale: string;
  translate: ScheduleTranslate;
  running: boolean;
  /** Appended to the summary, e.g. "Keep in sync" for a connector's direction. */
  summarySuffix?: () => Promise<string | null>;
}>();
const emit = defineEmits<{
  runNow: [];
  saved: [message: string];
  error: [message: string];
  done: [];
}>();
const id = useId();
const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, index) => index + 1);
// The view the screen was opened on owns the schedule; load it once.
const opened = { schedule: props.schedule, context: props.context() };
const settings = ref<ScheduleSettings>();
const status = ref<ScheduleStatus | null>(null);
const saving = ref(false);
const suffix = ref<string | null>(null);
const label = (key: ScheduleLabelKey): string => scheduleLabel(key, props.locale, props.translate);
const frequencies = computed(() => scheduleFrequencies(props.schedule.frequencies));
const visible = computed(() => scheduleFields(settings.value?.frequency ?? "manual"));
const update = (patch: Partial<ScheduleSettings>): void => {
  if (settings.value) settings.value = { ...settings.value, ...patch };
};

onMounted(async () => {
  props
    .summarySuffix?.()
    .then((value) => {
      suffix.value = value;
    })
    .catch(() => undefined);
  const loaded = await loadDestinationSchedule(opened.schedule, opened.context);
  settings.value = loaded.settings;
  status.value = loaded.status;
  if (loaded.error) emit("error", loaded.error);
});

// Frequency, day, week day and time zone choices for the current frequency.
interface ScheduleChoiceField {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}
const fields = computed((): ScheduleChoiceField[] => {
  const current = settings.value;
  if (!current) return [];
  const list: ScheduleChoiceField[] = [
    {
      id: "frequency",
      label: label("frequency"),
      value: current.frequency,
      options: frequencies.value.map((frequency) => ({ value: frequency, label: label(frequency) })),
      onChange: (value: string) => update({ frequency: value as ScheduleFrequency }),
    },
  ];
  if (visible.value.weekday) {
    list.push({
      id: "weekday",
      label: label("weekday"),
      value: String(current.weekday),
      options: orderedWeekdays(props.locale).map((day) => ({ value: String(day.value), label: day.label })),
      onChange: (value: string) => update({ weekday: Number(value) }),
    });
  }
  if (visible.value.dayOfMonth) {
    list.push({
      id: "dayOfMonth",
      label: label("dayOfMonth"),
      value: String(current.dayOfMonth),
      options: [
        ...DAYS_OF_MONTH.map((day) => ({ value: String(day), label: String(day) })),
        { value: "last", label: label("lastDay") },
      ],
      onChange: (value: string) => update({ dayOfMonth: value === "last" ? "last" : Number(value) }),
    });
  }
  if (visible.value.timing) {
    list.push({
      id: "timeZone",
      label: label("timeZone"),
      value: current.timeZone,
      options: scheduleTimeZones(current.timeZone).map((zone) => ({ value: zone, label: zone })),
      onChange: (value: string) => update({ timeZone: value }),
    });
  }
  return list;
});
const summary = computed(() =>
  settings.value
    ? [describeSchedule(settings.value, props.locale, props.translate), suffix.value].filter(Boolean).join(" · ")
    : ""
);
const next = computed(() =>
  settings.value
    ? describeNextRun(settings.value, props.locale, props.translate, new Date(), status.value?.nextRunAt)
    : null
);
const lastRun = computed(() =>
  settings.value ? describeLastRun(status.value, settings.value.timeZone, props.locale, props.translate) : null
);
const save = async (): Promise<void> => {
  if (!settings.value) return;
  saving.value = true;
  const result = await saveDestinationSchedule(opened.schedule, settings.value, opened.context);
  saving.value = false;
  if (result.ok) {
    emit("saved", label("saved"));
    emit("done");
  } else {
    emit("error", result.error);
  }
};
</script>

<template>
  <div class="yayaw-schedule-panel" data-schedule-panel>
    <p v-if="!settings" class="yayaw-schedule-loading">
      <span class="yayaw-spinner" aria-hidden="true" />{{ label("loading") }}
    </p>
    <ViewSettingsPanel v-else :fields="fields">
      <div v-if="visible.minute" class="yayaw-control-field yayaw-schedule-field">
        <label :for="`${id}-minute`">{{ label("minute") }}</label>
        <input :id="`${id}-minute`" class="yayaw-input" type="number" min="0" max="59" :value="settings.minute"
          @input="update({ minute: Number(($event.target as HTMLInputElement).value) })" />
      </div>
      <div v-if="visible.time" class="yayaw-control-field yayaw-schedule-field">
        <label :for="`${id}-time`">{{ label("time") }}</label>
        <input :id="`${id}-time`" class="yayaw-input" type="time" :value="settings.time"
          @input="update({ time: ($event.target as HTMLInputElement).value })" />
      </div>
      <div v-if="visible.timing" class="yayaw-control-field yayaw-schedule-field">
        <label :for="`${id}-start`">{{ label("startDate") }}</label>
        <input :id="`${id}-start`" class="yayaw-input" type="date" :value="settings.startDate ?? ''"
          @input="update({ startDate: ($event.target as HTMLInputElement).value || undefined })" />
      </div>
      <div class="yayaw-schedule-summary" aria-live="polite" data-schedule-summary>
        <p>{{ summary }}</p>
        <p v-if="next" class="yayaw-schedule-muted" data-schedule-next>{{ next }}</p>
        <p v-if="lastRun" class="yayaw-schedule-muted" data-schedule-last-run>{{ lastRun }}</p>
      </div>
      <div class="yayaw-schedule-actions">
        <button type="button" class="yayaw-button" :disabled="saving" :aria-busy="saving" @click="save">
          <span v-if="saving" class="yayaw-spinner" aria-hidden="true" />{{ label("save") }}
        </button>
        <button type="button" class="yayaw-button yayaw-button-outline" @click="emit('done')">{{ label("cancel") }}</button>
      </div>
      <button type="button" class="yayaw-button yayaw-button-ghost yayaw-schedule-run" :disabled="running" :aria-busy="running"
        @click="emit('runNow')">
        <span v-if="running" class="yayaw-spinner" aria-hidden="true" />
        <Play v-else :size="16" aria-hidden="true" />
        {{ label("runNow") }}
      </button>
    </ViewSettingsPanel>
  </div>
</template>
