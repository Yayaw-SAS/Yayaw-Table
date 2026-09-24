<script setup lang="ts">
import FullCalendar, {
  type CalendarOptions,
  type DateClickInfo,
  type DatesSetInfo,
  type EventChangeInfo,
  type EventClickInfo,
  type EventInput,
  useCalendarController,
} from "@fullcalendar/vue3";
import dayGridPlugin from "@fullcalendar/vue3/daygrid";
import interactionPlugin from "@fullcalendar/vue3/interaction";
import listPlugin from "@fullcalendar/vue3/list";
import frLocale from "@fullcalendar/vue3/locales/fr";
import classicThemePlugin from "@fullcalendar/vue3/themes/classic";
import "@fullcalendar/vue3/skeleton.css";
import "@fullcalendar/vue3/themes/classic/theme.css";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import { computed, ref, shallowRef, watch } from "vue";
import {
  addDays,
  type CalendarLayout,
  type CalendarViewSettings,
  calendarEvents,
  calendarMovePatch,
  calendarScope,
  daysBetween,
  resolveCalendarSettings,
} from "../calendar-model";
import type { DisplayModeRenderContext } from "../display-mode-renderer";
import { loadScopedRows, localDayKey } from "../scoped-rows";
import { tagAppearance } from "../tag-colors";
import "../tag-colors.css";
import "./calendar.css";
import type { TableRecord } from "../types";

const props = defineProps<{ context: DisplayModeRenderContext }>();

const VIEW_TYPES: Record<CalendarLayout, string> = {
  month: "dayGridMonth",
  week: "dayGridWeek",
  list: "listMonth",
};
const LAYOUT_LABELS: Record<CalendarLayout, string> = {
  month: "Month",
  week: "Week",
  list: "List",
};
const LAYOUTS = Object.keys(LAYOUT_LABELS) as CalendarLayout[];
const MAX_EVENTS_PER_DAY = 4;

const label = (key: string, fallback: string): string =>
  props.context.translate(`calendar.${key}`, fallback);
const settings = computed(() =>
  resolveCalendarSettings(
    props.context.columns,
    props.context.defaults as CalendarViewSettings,
    props.context.settings as CalendarViewSettings
  )
);
const controller = useCalendarController();
const range = shallowRef<{ start: Date; end: Date }>();
const title = ref("");
const rows = shallowRef<TableRecord[]>([]);
const truncated = ref(false);
const error = ref<string>();

let request: AbortController | undefined;
watch(
  () => [
    range.value,
    settings.value.dateColumn,
    settings.value.endColumn,
    props.context.list,
    props.context.listParams,
    props.context.list ? undefined : props.context.rows,
    props.context.revision,
  ],
  async () => {
    const { dateColumn, endColumn } = settings.value;
    if (!(range.value && dateColumn)) return;
    request?.abort();
    const controllerSignal = new AbortController();
    request = controllerSignal;
    try {
      const result = await loadScopedRows({
        list: props.context.list,
        rows: props.context.list ? undefined : props.context.rows,
        params: props.context.listParams,
        scope: calendarScope({ dateColumn, endColumn }, range.value.start, range.value.end),
        signal: controllerSignal.signal,
      });
      rows.value = result.rows;
      truncated.value = result.truncated;
      error.value = undefined;
    } catch (cause) {
      if (!controllerSignal.signal.aborted)
        error.value = cause instanceof Error ? cause.message : String(cause);
    }
  },
  { immediate: true }
);

const rowsById = computed(
  () => new Map(rows.value.map((row) => [props.context.getRowId(row), row]))
);
const colorColumn = computed(() =>
  props.context.columns.find((column) => column.id === settings.value.colorColumn)
);
const events = computed<EventInput[]>(() =>
  calendarEvents(rows.value, settings.value, props.context.getRowId, {
    columns: props.context.columns,
    locale: props.context.locale,
  }).map((event) => {
    const row = rowsById.value.get(event.id) ?? {};
    const editable = props.context.canEditRow(row);
    const column = colorColumn.value;
    return {
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      allDay: true,
      startEditable: settings.value.allowDragUpdate && editable,
      durationEditable:
        settings.value.allowResize && Boolean(settings.value.endColumn) && editable,
      extendedProps: {
        appearance:
          event.colorValue === undefined
            ? undefined
            : tagAppearance(
                event.colorValue,
                (column?.coloredTags as boolean | undefined) ?? true,
                column?.tagColorMap as Record<string, string> | undefined
              ),
      },
    };
  })
);

const moveEvent = async (info: EventChangeInfo): Promise<void> => {
  const row = rowsById.value.get(info.event.id);
  const start = localDayKey(info.event.start);
  if (!(row && start)) {
    info.revert();
    return;
  }
  const previousStart = localDayKey(info.oldEvent.start) ?? start;
  const previousEnd = localDayKey(info.oldEvent.end) ?? addDays(previousStart, 1);
  const end =
    localDayKey(info.event.end) ?? addDays(start, daysBetween(previousStart, previousEnd));
  const patch = calendarMovePatch(row, settings.value, start, end);
  // Show the move at once; a failed save puts the event back.
  rows.value = rows.value.map((item) => (item === row ? { ...item, ...patch } : item));
  if (!(await props.context.updateRow(row, patch))) {
    rows.value = rows.value.map((item) =>
      props.context.getRowId(item) === info.event.id ? row : item
    );
    info.revert();
  }
};

const createOn = (info: DateClickInfo): void => {
  const { allowCreate, dateColumn, endColumn } = settings.value;
  const day = localDayKey(info.date);
  if (!(allowCreate && props.context.canCreate && dateColumn && day)) return;
  props.context.createRow({
    [dateColumn]: day,
    ...(endColumn ? { [endColumn]: day } : {}),
  });
};

const setLayout = (layout: CalendarLayout): void => {
  props.context.updateSettings({ ...props.context.settings, layout });
};
watch(
  () => settings.value.layout,
  (layout) => {
    if (controller.view && controller.view.type !== VIEW_TYPES[layout]) {
      controller.changeView(VIEW_TYPES[layout]);
    }
  }
);

const options = computed<CalendarOptions>(() => ({
  plugins: [classicThemePlugin, dayGridPlugin, listPlugin, interactionPlugin],
  controller,
  borderless: true,
  headerToolbar: false,
  height: "auto",
  initialView: VIEW_TYPES[settings.value.layout],
  locale: props.context.locale.startsWith("fr") ? frLocale : props.context.locale,
  firstDay: settings.value.weekStartsOn,
  weekends: settings.value.showWeekends,
  dayMaxEvents: MAX_EVENTS_PER_DAY,
  events: events.value,
  eventClass: "yayaw-calendar-event",
  eventDrop: moveEvent,
  eventResize: moveEvent,
  dateClick: createOn,
  eventClick: (info: EventClickInfo) => {
    info.jsEvent.preventDefault();
    const row = rowsById.value.get(info.event.id);
    if (row) props.context.openRow(row, info.jsEvent);
  },
  datesSet: (info: DatesSetInfo) => {
    const current = range.value;
    if (
      current?.start.getTime() !== info.start.getTime() ||
      current.end.getTime() !== info.end.getTime()
    ) {
      range.value = { start: info.start, end: info.end };
    }
    title.value = info.view.title;
  },
}));
</script>

<template>
  <output v-if="!settings.dateColumn" class="yayaw-calendar-message yayaw-calendar-empty">
    {{ label("noDateColumn", "Add a date column to show this table as a calendar.") }}
  </output>
  <div v-else class="yayaw-calendar-view" :data-calendar-layout="settings.layout">
    <div class="yayaw-calendar-toolbar">
      <div class="yayaw-calendar-nav">
        <button type="button" class="yayaw-button yayaw-button-outline yayaw-icon-only" :aria-label="label('previous', 'Previous')" @click="controller.prev()">
          <ChevronLeft :size="16" aria-hidden="true" />
        </button>
        <button type="button" class="yayaw-button yayaw-button-outline" @click="controller.today()">
          {{ label("today", "Today") }}
        </button>
        <button type="button" class="yayaw-button yayaw-button-outline yayaw-icon-only" :aria-label="label('next', 'Next')" @click="controller.next()">
          <ChevronRight :size="16" aria-hidden="true" />
        </button>
        <h3 class="yayaw-calendar-title" data-calendar-title>{{ title }}</h3>
      </div>
      <fieldset class="yayaw-calendar-layouts">
        <legend class="yayaw-sr-only">{{ label("layout", "Layout") }}</legend>
        <button
          v-for="item in LAYOUTS"
          :key="item"
          type="button"
          class="yayaw-button"
          :class="settings.layout === item ? 'yayaw-button-secondary' : 'yayaw-button-ghost'"
          :aria-pressed="settings.layout === item"
          @click="setLayout(item)"
        >
          {{ label(item, LAYOUT_LABELS[item]) }}
        </button>
      </fieldset>
    </div>
    <div v-if="error" class="yayaw-calendar-message yayaw-calendar-error" role="alert">{{ error }}</div>
    <output v-if="truncated" class="yayaw-calendar-message">
      {{ label("truncated", "Only part of the records are shown. Narrow the filters to see all of them.") }}
    </output>
    <div class="yayaw-calendar">
      <FullCalendar :options="options">
        <template #eventContent="arg">
          <span
            class="yayaw-tag yayaw-calendar-pill"
            :class="arg.event.extendedProps.appearance?.className"
            :data-colored="arg.event.extendedProps.appearance?.colored ? 'true' : undefined"
            :data-custom-color="arg.event.extendedProps.appearance?.className ? '' : undefined"
            :style="arg.event.extendedProps.appearance?.style"
            :title="arg.event.title"
          >{{ arg.event.title }}</span>
        </template>
      </FullCalendar>
    </div>
  </div>
</template>
