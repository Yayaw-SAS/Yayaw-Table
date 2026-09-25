<script setup lang="ts">
import { ChevronDown, ChevronLeft, ChevronRight, FileText, Layers, RotateCw } from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useTableContext } from "../../context";
import { useCardRows } from "../../composables/use-card-rows";
import { exportColumns } from "../../core";
import { dateDay, dayDate } from "../../planning/calendar";
import { normalizeGanttView } from "../../planning/engine";
import { planningFormatters } from "../../planning/format";
import { planningLabelOverrides, planningLabels } from "../../planning/labels";
import {
  TIMELINE_HEADER_HEIGHT,
  TIMELINE_ROW_HEIGHT,
  timelineBar,
  timelineCanEdit,
  timelineCanResize,
  timelineDateMutation,
  timelineDayCells,
  timelineFirstDate,
  timelineGeometry,
  timelineLinks,
  timelineMonths,
  timelineOffDays,
  timelinePeriodStep,
  timelineRows,
  timelineToday,
  timelineTodayOffset,
} from "../../planning/timeline";
import { comparePlanningTasks, planningTaskMatches } from "../../planning/query";
import { planningKey, type PlanningRef, type PlanningTask } from "../../planning/types";
import type { ColumnDefinition, TableRecord } from "../../types";
import TableCheckbox from "../controls/TableCheckbox.vue";
import CellRenderer from "../table/CellRenderer.vue";
import TableEmptyState from "../table/TableEmptyState.vue";

type DragOperation = "move" | "start" | "end";
const TREE_INDENT = 16;
const LABEL_PADDING = 8;
const KEYBOARD_WEEK = 7;
const MIN_BAR_WIDTH = 8;

const context = useTableContext();
const rows = useCardRows();
const viewport = ref<HTMLElement>();
const scrollTop = ref(0);
const scrollLeft = ref(0);
const available = ref(0);
const collapsed = ref(new Set<string>());
const drag = ref<{ key: string; operation: DragOperation; originX: number; days: number; moved: boolean }>();
let observer: ResizeObserver | undefined;

const translate = (key: string): string => {
  const value = context.translations.value[key];
  return typeof value === "string" ? value : key;
};
const labels = computed(() => planningLabels(context.locale, planningLabelOverrides(translate)));
const planning = computed(() => context.planning);
const snapshot = computed(() => context.planningState?.value?.snapshot);
const busy = computed(() => context.planningState?.value?.busy === true);
const error = computed(() => context.planningState?.value?.error);
const view = computed(() => normalizeGanttView({ ...context.config.table.gantt, ...context.state.gantt.value }));
const sourceId = computed(() => context.config.table.planning?.sourceId);

const rowsById = computed(() => {
  const index = new Map<string, TableRecord>();
  for (const row of rows.value) {
    index.set(context.getRowId(row), row);
  }
  return index;
});
const recordFor = (task: PlanningTask): TableRecord | undefined =>
  task.ref.source === sourceId.value ? rowsById.value.get(task.ref.id) : undefined;

// The configured title column, else the first visible data column, as in React.
const titleColumn = computed<ColumnDefinition | undefined>(() => {
  const configured = context.config.table.gantt?.titleColumn;
  const definitions = context.config.columns.definitions;
  return (
    definitions.find((item) => item.id === configured) ??
    exportColumns(
      definitions,
      context.state.visibility.value,
      context.state.order.value
    ).find((item) => item.id !== "select" && item.id !== "actions")
  );
});

// Names and days read as the table shows the title, start and end columns.
const formatters = computed(() =>
  planningFormatters(
    context.config.columns.definitions,
    context.config.table.gantt,
    context.locale,
    titleColumn.value?.id
  )
);

/** The timeline projects the same search, filters and sort as the rest of the table. */
const matches = computed(() => {
  const query = {
    search: context.state.search.value,
    filters: context.state.filters.value,
    advancedFilters: context.state.advancedFilters.value,
    columns: context.config.columns.definitions,
  };
  return (task: PlanningTask) => planningTaskMatches(task, query);
});
const order = computed(() => {
  const query = { sorting: context.state.sorting.value, columns: context.config.columns.definitions };
  return (a: PlanningTask, b: PlanningTask) => comparePlanningTasks(a, b, query);
});
const timeline = computed(() =>
  snapshot.value
    ? timelineRows(snapshot.value, {
        hierarchy: context.config.table.planning?.hierarchy,
        visible: matches.value,
        compare: order.value,
        collapsed: collapsed.value,
      })
    : []
);
const geometry = computed(() =>
  timelineGeometry({
    rowCount: timeline.value.length,
    view: view.value,
    availableWidth: available.value,
    height: context.config.table.gantt?.height,
    scrollTop: scrollTop.value,
    scrollLeft: scrollLeft.value,
    firstDate: timelineFirstDate(snapshot.value),
  })
);
const visibleRows = computed(() => timeline.value.slice(geometry.value.firstRow, geometry.value.lastRow));
const links = computed(() =>
  view.value.showDependencies === false || !snapshot.value ? [] : timelineLinks(timeline.value, snapshot.value, geometry.value)
);
const days = computed(() => timelineDayCells(geometry.value, view.value));
const months = computed(() => timelineMonths(geometry.value));
const todayOffset = computed(() => timelineTodayOffset(geometry.value));
const anchorDay = computed(() => dateDay(view.value.anchorDate ?? timelineFirstDate(snapshot.value)));
const periodLabel = computed(() =>
  new Intl.DateTimeFormat(context.locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${dayDate(geometry.value.from)}T00:00:00Z`)
  )
);
const weekdayFormat = computed(
  () => new Intl.DateTimeFormat(context.locale, { weekday: view.value.zoom === "day" ? "short" : "narrow", timeZone: "UTC" })
);
const monthFormat = computed(() => new Intl.DateTimeFormat(context.locale, { month: "long", year: "numeric", timeZone: "UTC" }));
const formatUtc = (format: Intl.DateTimeFormat, date: string): string => format.format(new Date(`${date}T00:00:00Z`));

const navigate = (anchorDate: string): void => {
  context.state.gantt.value = { ...context.state.gantt.value, anchorDate };
};
const toggle = (key: string): void => {
  const next = new Set(collapsed.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  collapsed.value = next;
};
const request = (task: PlanningTask, operation: DragOperation, amount: number): void => {
  const mutations = timelineDateMutation(task, operation, amount);
  if (mutations.length) {
    planning.value?.request(mutations).catch(() => undefined);
  }
};
const open = (ref_: PlanningRef): void => planning.value?.open(ref_);
const activate = (task: PlanningTask): void => {
  const record = recordFor(task);
  if (record && context.openDetails) {
    context.openDetails(record);
    return;
  }
  open(task.ref);
};
const editable = (task: PlanningTask, hasChildren: boolean): boolean =>
  Boolean(planning.value && snapshot.value) &&
  timelineCanEdit({ task, hasChildren, session: planning.value!, snapshot: snapshot.value! });
const resizable = (hasChildren: boolean): boolean =>
  Boolean(planning.value) && timelineCanResize({ hasChildren, session: planning.value! });
const summary = (hasChildren: boolean): boolean =>
  hasChildren && context.config.table.planning?.parentDates !== "independent";
const shift = (key: string, operation: DragOperation): number =>
  drag.value?.key === key && drag.value.operation === operation ? drag.value.days * geometry.value.width : 0;

const startDrag = (event: PointerEvent, key: string, operation: DragOperation): void => {
  if (event.button !== 0) {
    return;
  }
  drag.value = { key, operation, originX: event.clientX, days: 0, moved: false };
};
const moveDrag = (event: PointerEvent): void => {
  if (!drag.value) {
    return;
  }
  const days = Math.round((event.clientX - drag.value.originX) / geometry.value.width);
  if (days !== drag.value.days) {
    drag.value = { ...drag.value, days, moved: true };
  }
};
const endDrag = (): void => {
  const current = drag.value;
  drag.value = undefined;
  if (!current) {
    return;
  }
  const target = timeline.value.find((row) => planningKey(row.task.ref) === current.key);
  if (!target) {
    return;
  }
  if (current.moved && current.days) {
    request(target.task, current.operation, current.days);
  } else if (current.operation === "move") {
    // The drag layer swallows the click, so a press without movement still opens the task.
    open(target.task.ref);
  }
};
const keyAdjust = (event: KeyboardEvent, task: PlanningTask, operation: DragOperation): void => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
    return;
  }
  event.preventDefault();
  request(task, operation, (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? KEYBOARD_WEEK : 1));
};
const hasQuery = computed(() => {
  const advanced = context.state.advancedFilters.value;
  const active = Array.isArray(advanced) ? advanced : (advanced?.filters ?? []);
  return (
    Boolean(context.state.search.value) ||
    Object.keys(context.state.filters.value ?? {}).length > 0 ||
    active.length > 0
  );
});
const onScroll = (): void => {
  scrollTop.value = viewport.value?.scrollTop ?? 0;
  scrollLeft.value = viewport.value?.scrollLeft ?? 0;
};
const toggleSelection = (record: TableRecord, checked: boolean): void => {
  context.selection.value[context.getRowId(record)] = checked;
};

onMounted(() => {
  const element = viewport.value;
  if (!element || typeof ResizeObserver === "undefined") {
    return;
  }
  observer = new ResizeObserver(() => {
    available.value = element.clientWidth;
  });
  observer.observe(element);
  available.value = element.clientWidth;
});
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <p v-if="!planning" class="yayaw-gantt-message" role="alert">{{ labels.noAdapter }}</p>
  <p v-else-if="!snapshot" class="yayaw-gantt-message" role="status">
    {{ busy ? labels.loading : labels.noAdapter }}
  </p>
  <div v-else-if="!timeline.length" class="yayaw-gantt-empty">
    <TableEmptyState />
    <button v-if="hasQuery" type="button" class="yayaw-ghost-button" @click="context.state.resetFilters()">{{ labels.clear }}</button>
  </div>
  <section v-else class="yayaw-gantt" :aria-label="labels.planning">
    <div class="yayaw-gantt-toolbar">
      <h3>{{ periodLabel }}</h3>
      <div class="yayaw-gantt-nav">
        <button type="button" class="yayaw-icon-button" :title="labels.previous" :aria-label="labels.previous" @click="navigate(dayDate(anchorDay - timelinePeriodStep(view.zoom)))">
          <ChevronLeft :size="16" aria-hidden="true" />
        </button>
        <button type="button" class="yayaw-ghost-button" @click="navigate(timelineToday())">{{ labels.today }}</button>
        <button type="button" class="yayaw-icon-button" :title="labels.next" :aria-label="labels.next" @click="navigate(dayDate(anchorDay + timelinePeriodStep(view.zoom)))">
          <ChevronRight :size="16" aria-hidden="true" />
        </button>
        <button type="button" class="yayaw-icon-button" :disabled="busy" :title="labels.retry" :aria-label="labels.retry" @click="planning?.load()">
          <RotateCw :size="16" aria-hidden="true" />
        </button>
      </div>
    </div>
    <p v-if="error" class="yayaw-gantt-error" role="alert">{{ error }}</p>
    <div ref="viewport" class="yayaw-gantt-viewport" :style="{ height: `${geometry.height}px` }" @scroll="onScroll">
      <div class="yayaw-gantt-canvas" :style="{ width: `${geometry.totalWidth}px`, height: `${geometry.canvasHeight}px` }">
        <div class="yayaw-gantt-header" :style="{ height: `${TIMELINE_HEADER_HEIGHT}px` }">
          <div class="yayaw-gantt-label yayaw-gantt-heading" :style="{ width: `${geometry.labelWidth}px` }">
            <FileText :size="16" aria-hidden="true" /><span>{{ labels.task }}</span>
          </div>
          <div v-for="month in months" :key="month.date" class="yayaw-gantt-month" :style="{ left: `${month.left}px`, width: `${month.width}px` }">
            {{ formatUtc(monthFormat, month.date) }}
          </div>
          <div
            v-for="cell in days"
            :key="cell.date"
            class="yayaw-gantt-date"
            :class="{ today: cell.isToday }"
            :title="formatters.day(cell.date)"
            :aria-current="cell.isToday ? 'date' : undefined"
            :style="{ left: `${cell.left}px`, width: `${cell.width}px` }"
          >
            <span v-if="cell.weekday" class="yayaw-gantt-weekday">{{ formatUtc(weekdayFormat, cell.date) }}</span>
            <span v-if="cell.number" class="yayaw-gantt-day">{{ cell.number }}</span>
          </div>
        </div>
        <div
          v-for="(row, index) in visibleRows"
          :key="planningKey(row.task.ref)"
          class="yayaw-gantt-row"
          :class="{ summary: row.hasChildren }"
          :style="{ top: `${TIMELINE_HEADER_HEIGHT + (geometry.firstRow + index) * TIMELINE_ROW_HEIGHT}px`, height: `${TIMELINE_ROW_HEIGHT}px` }"
        >
          <div class="yayaw-gantt-label" :style="{ width: `${geometry.labelWidth}px`, paddingLeft: `${LABEL_PADDING + row.depth * TREE_INDENT}px` }">
            <button
              v-if="row.hasChildren"
              type="button"
              class="yayaw-icon-button yayaw-gantt-toggle"
              :aria-expanded="!collapsed.has(planningKey(row.task.ref))"
              :aria-label="collapsed.has(planningKey(row.task.ref)) ? labels.expand : labels.collapse"
              @click="toggle(planningKey(row.task.ref))"
            >
              <ChevronRight v-if="collapsed.has(planningKey(row.task.ref))" :size="16" aria-hidden="true" />
              <ChevronDown v-else :size="16" aria-hidden="true" />
            </button>
            <span v-else class="yayaw-gantt-spacer" aria-hidden="true" />
            <span v-if="context.config.table.enableRowSelection && recordFor(row.task)" class="yayaw-gantt-select" @click.stop>
              <TableCheckbox
                :label="`${translate('selectRow')} ${formatters.task(row.task)}`"
                :model-value="Boolean(context.selection.value[context.getRowId(recordFor(row.task)!)])"
                :disabled="context.config.table.canSelectRow?.(recordFor(row.task)!) === false"
                @update:model-value="toggleSelection(recordFor(row.task)!, $event)"
              />
            </span>
            <Layers v-if="row.hasChildren" :size="16" aria-hidden="true" class="yayaw-gantt-kind" />
            <FileText v-else :size="16" aria-hidden="true" class="yayaw-gantt-kind" />
            <CellRenderer
              v-if="recordFor(row.task) && titleColumn"
              :column="titleColumn"
              :row="recordFor(row.task)!"
              :value="recordFor(row.task)![titleColumn.accessorKey ?? titleColumn.id]"
            />
            <button v-else type="button" class="yayaw-gantt-title" :title="`${row.task.ref.source} · ${formatters.task(row.task)}`" @click="activate(row.task)">
              {{ formatters.task(row.task) }}
            </button>
          </div>
          <div
            class="yayaw-gantt-track"
            :style="{ left: `${geometry.labelWidth}px`, width: `${geometry.count * geometry.width}px`, backgroundSize: `${geometry.width}px 100%` }"
          >
            <span
              v-for="off in timelineOffDays(row.task, snapshot, geometry)"
              :key="off.left"
              class="yayaw-gantt-off"
              aria-hidden="true"
              :style="{ left: `${off.left}px`, width: `${off.width}px` }"
            />
            <div
              v-if="timelineBar(row.task, geometry)"
              class="yayaw-gantt-bar"
              :class="{ summary: summary(row.hasChildren) }"
              :style="{
                left: `${timelineBar(row.task, geometry)!.left + shift(planningKey(row.task.ref), 'move') + shift(planningKey(row.task.ref), 'start')}px`,
                width: `${Math.max(MIN_BAR_WIDTH, timelineBar(row.task, geometry)!.width - shift(planningKey(row.task.ref), 'start') + shift(planningKey(row.task.ref), 'end'))}px`,
              }"
            >
              <button
                type="button"
                class="yayaw-gantt-bar-body"
                :aria-label="`${labels.move} ${formatters.task(row.task)}: ${formatters.day(row.task.start, 'start')} – ${formatters.day(row.task.end, 'end')}`"
                :title="`${formatters.task(row.task)}: ${formatters.day(row.task.start, 'start')} – ${formatters.day(row.task.end, 'end')}`"
                @click="open(row.task.ref)"
                @keydown="editable(row.task, row.hasChildren) && keyAdjust($event, row.task, 'move')"
                @pointerdown="editable(row.task, row.hasChildren) && startDrag($event, planningKey(row.task.ref), 'move')"
              >
                {{ formatters.task(row.task) }}
              </button>
              <template v-if="editable(row.task, row.hasChildren) && resizable(row.hasChildren)">
                <button
                  v-for="side in (['start', 'end'] as const)"
                  :key="side"
                  type="button"
                  class="yayaw-gantt-handle"
                  :class="side"
                  :aria-label="`${side === 'start' ? labels.resizeStart : labels.resizeEnd} ${formatters.task(row.task)}`"
                  @keydown="keyAdjust($event, row.task, side)"
                  @pointerdown="startDrag($event, planningKey(row.task.ref), side)"
                />
              </template>
            </div>
            <span v-else class="yayaw-gantt-unscheduled">{{ labels.unscheduled }}</span>
          </div>
        </div>
        <svg v-if="links.length" class="yayaw-gantt-links" aria-hidden="true" :width="geometry.totalWidth" :height="geometry.canvasHeight">
          <title>{{ labels.dependencies }}</title>
          <path v-for="link in links" :key="link.id" :d="link.d" fill="none" stroke="currentColor" />
        </svg>
        <span
          v-if="todayOffset !== undefined"
          class="yayaw-gantt-today"
          aria-hidden="true"
          :style="{ left: `${todayOffset}px`, top: `${TIMELINE_HEADER_HEIGHT}px`, height: `${geometry.canvasHeight - TIMELINE_HEADER_HEIGHT}px` }"
        />
      </div>
    </div>
    <div v-if="drag" class="yayaw-gantt-drag-layer" aria-hidden="true" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag" />
  </section>
</template>
