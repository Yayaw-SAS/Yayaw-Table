<script setup lang="ts">
import { type DateValue, parseDate } from "@internationalized/date";
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-vue-next";
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
  RangeCalendarCell,
  RangeCalendarCellTrigger,
  RangeCalendarGrid,
  RangeCalendarGridBody,
  RangeCalendarGridHead,
  RangeCalendarGridRow,
  RangeCalendarHeadCell,
  RangeCalendarHeader,
  RangeCalendarHeading,
  RangeCalendarNext,
  RangeCalendarPrev,
  RangeCalendarRoot,
} from "reka-ui";
import { useId } from "vue";
import { formWeekStart } from "../form-view";
import { tagAppearance } from "../tag-colors";
import "../tag-colors.css";
import {
  type DashboardDateRange,
  type DashboardFilter,
  type DashboardTableInfo,
  type DashboardTranslate,
  dashboardDateRangeText,
  dashboardFilterColoredTags,
  dashboardFilterColumn,
  dashboardFilterOptions,
  dashboardFilterTargetsLabel,
  isDashboardFilterActive,
} from "./dashboard-model";
import type { DashboardLabel } from "./dashboard-types";

/** The dashboard's filters; each joins the widgets it targets. */
const props = defineProps<{
  filters: DashboardFilter[];
  tables: Record<string, DashboardTableInfo>;
  editing: boolean;
  label: DashboardLabel;
  locale: string;
  translate: DashboardTranslate;
}>();
const emit = defineEmits<{
  change: [filterId: string, value: DashboardDateRange | string[] | undefined];
  remove: [filterId: string];
  add: [];
}>();

type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const rangeOf = (filter: DashboardFilter): DashboardDateRange =>
  (filter.value && !Array.isArray(filter.value) ? filter.value : {}) as DashboardDateRange;
const dayOf = (value?: string): DateValue | undefined =>
  value && DATE_ONLY.test(value) ? parseDate(value) : undefined;
const calendarValue = (filter: DashboardFilter) => {
  const range = rangeOf(filter);
  return { start: dayOf(range.start), end: dayOf(range.end) };
};
const pickRange = (filter: DashboardFilter, next: { start?: DateValue; end?: DateValue } | undefined) =>
  emit("change", filter.id, { start: next?.start?.toString(), end: next?.end?.toString() });
const hasRange = (filter: DashboardFilter) => Boolean(rangeOf(filter).start || rangeOf(filter).end);
const weekStart = () => formWeekStart(props.locale) as WeekStart;
const rangeText = (filter: DashboardFilter) =>
  dashboardDateRangeText(filter.value, props.locale, props.translate, dashboardFilterColumn(filter, props.tables));

const selected = (filter: DashboardFilter): string[] => (Array.isArray(filter.value) ? filter.value : []);
const chosen = (filter: DashboardFilter) =>
  dashboardFilterOptions(filter, props.tables).filter((option) => selected(filter).includes(option.value));
const toggle = (filter: DashboardFilter, value: string) => {
  const values = selected(filter);
  const next = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  emit("change", filter.id, next.length ? next : undefined);
};
const tag = (filter: DashboardFilter, value: string) =>
  tagAppearance(value, dashboardFilterColoredTags(filter, props.tables));
// "Applies to …" describes each filter's button.
const prefix = useId();
const targetsId = (filter: DashboardFilter) => `${prefix}-${filter.id}-targets`;
</script>

<template>
  <section
    v-if="props.filters.length || props.editing"
    class="yayaw-dashboard-filters"
    :data-editing="props.editing ? '' : undefined"
    :aria-label="props.label('filters')"
    data-dashboard-filters=""
  >
    <fieldset v-for="filter in props.filters" :key="filter.id" class="yayaw-dashboard-filter" :data-dashboard-filter="filter.id">
      <legend :class="{ 'yayaw-dashboard-sr-only': !props.editing }">
        {{ filter.label }}
        <button
          v-if="props.editing"
          type="button"
          class="yayaw-dashboard-icon-button"
          data-size="xs"
          :aria-label="props.label('removeFilter', { name: filter.label })"
          @click="emit('remove', filter.id)"
        >
          <X :size="12" aria-hidden="true" />
        </button>
      </legend>
      <div class="yayaw-dashboard-filter-row">
        <PopoverRoot v-if="filter.type === 'dateRange'">
          <PopoverTrigger as-child>
            <button
              type="button"
              class="yayaw-button yayaw-button-outline yayaw-dashboard-filter-trigger yayaw-dashboard-date-trigger"
              data-filter-trigger=""
              :aria-label="`${filter.label}: ${rangeText(filter)}`"
              :aria-describedby="targetsId(filter)"
            >
              <CalendarIcon :size="16" aria-hidden="true" class="yayaw-dashboard-muted" />
              <span v-if="!props.editing" class="yayaw-dashboard-filter-name" data-filter-name="">{{ filter.label }}</span>
              <span class="yayaw-dashboard-filter-value" data-filter-value="" :data-empty="!hasRange(filter) || undefined">{{ rangeText(filter) }}</span>
              <ChevronDown :size="16" aria-hidden="true" class="yayaw-dashboard-muted" />
            </button>
          </PopoverTrigger>
          <PopoverPortal>
            <PopoverContent class="yayaw-form-popover yayaw-form-calendar-popover" :data-dashboard-filter-popup="filter.id" align="start" :side-offset="4" :collision-padding="8">
              <RangeCalendarRoot
                v-slot="{ weekDays, grid }"
                :model-value="calendarValue(filter)"
                :default-placeholder="calendarValue(filter).start ?? calendarValue(filter).end"
                :locale="props.locale"
                :week-starts-on="weekStart()"
                weekday-format="short"
                initial-focus
                class="yayaw-form-calendar yayaw-dashboard-range"
                @update:model-value="pickRange(filter, $event as { start?: DateValue; end?: DateValue })"
              >
                <RangeCalendarHeader class="yayaw-form-calendar-header">
                  <RangeCalendarPrev class="yayaw-button yayaw-button-ghost yayaw-form-calendar-nav">
                    <ChevronLeft :size="16" aria-hidden="true" />
                  </RangeCalendarPrev>
                  <RangeCalendarHeading class="yayaw-form-calendar-heading" />
                  <RangeCalendarNext class="yayaw-button yayaw-button-ghost yayaw-form-calendar-nav">
                    <ChevronRight :size="16" aria-hidden="true" />
                  </RangeCalendarNext>
                </RangeCalendarHeader>
                <RangeCalendarGrid v-for="month in grid" :key="month.value.toString()" class="yayaw-form-calendar-grid">
                  <RangeCalendarGridHead>
                    <RangeCalendarGridRow class="yayaw-form-calendar-row">
                      <RangeCalendarHeadCell v-for="day in weekDays" :key="day" class="yayaw-form-calendar-weekday">{{ day }}</RangeCalendarHeadCell>
                    </RangeCalendarGridRow>
                  </RangeCalendarGridHead>
                  <RangeCalendarGridBody>
                    <RangeCalendarGridRow v-for="(week, index) in month.rows" :key="`week-${index}`" class="yayaw-form-calendar-row">
                      <RangeCalendarCell v-for="day in week" :key="day.toString()" :date="day" class="yayaw-form-calendar-cell">
                        <RangeCalendarCellTrigger :day="day" :month="month.value" class="yayaw-form-calendar-day" />
                      </RangeCalendarCell>
                    </RangeCalendarGridRow>
                  </RangeCalendarGridBody>
                </RangeCalendarGrid>
              </RangeCalendarRoot>
              <div v-if="hasRange(filter)" class="yayaw-form-calendar-footer">
                <button type="button" class="yayaw-button yayaw-button-ghost" @click="emit('change', filter.id, undefined)">{{ props.label("clear") }}</button>
              </div>
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>
        <PopoverRoot v-else>
          <PopoverTrigger as-child>
            <button
              type="button"
              class="yayaw-button yayaw-button-outline yayaw-dashboard-filter-trigger"
              data-filter-trigger=""
              :aria-label="filter.label"
              :aria-describedby="targetsId(filter)"
            >
              <span v-if="!props.editing" class="yayaw-dashboard-filter-name" data-filter-name="">{{ filter.label }}</span>
              <span class="yayaw-dashboard-filter-value yayaw-dashboard-filter-tags" data-filter-value="">
                <template v-if="chosen(filter).length">
                  <span
                    v-for="option in chosen(filter)"
                    :key="option.value"
                    class="yayaw-tag yayaw-dashboard-tag"
                    :class="tag(filter, option.value).className"
                    :data-colored="tag(filter, option.value).colored"
                    :data-custom-color="tag(filter, option.value).className ? '' : undefined"
                    :style="tag(filter, option.value).style"
                  >{{ option.label }}</span>
                </template>
                <span v-else>{{ props.label("any") }}</span>
              </span>
              <ChevronDown :size="16" aria-hidden="true" class="yayaw-dashboard-muted" />
            </button>
          </PopoverTrigger>
          <PopoverPortal>
            <PopoverContent class="yayaw-filter-picker yayaw-dashboard-options" :data-dashboard-filter-popup="filter.id" :aria-label="filter.label" align="start" :side-offset="4" :collision-padding="8">
              <fieldset class="yayaw-dashboard-choices" :aria-label="filter.label">
                <label class="yayaw-filter-choice">
                  <input type="checkbox" :checked="!selected(filter).length" @change="emit('change', filter.id, undefined)" />
                  <span>{{ props.label("any") }}</span>
                </label>
                <label v-for="option in dashboardFilterOptions(filter, props.tables)" :key="option.value" class="yayaw-filter-choice">
                  <input type="checkbox" :aria-label="option.label" :checked="selected(filter).includes(option.value)" @change="toggle(filter, option.value)" />
                  <span
                    class="yayaw-tag yayaw-dashboard-tag"
                    :class="tag(filter, option.value).className"
                    :data-colored="tag(filter, option.value).colored"
                    :data-custom-color="tag(filter, option.value).className ? '' : undefined"
                    :style="tag(filter, option.value).style"
                  >{{ option.label }}</span>
                </label>
              </fieldset>
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>
        <button
          v-if="isDashboardFilterActive(filter)"
          type="button"
          class="yayaw-button yayaw-button-ghost"
          @click="emit('change', filter.id, undefined)"
        >
          {{ props.label("clear") }}
        </button>
      </div>
      <p :id="targetsId(filter)" class="yayaw-dashboard-targets" :class="{ 'yayaw-dashboard-sr-only': !props.editing }" data-filter-targets="">
        {{ props.label("appliesTo", { targets: dashboardFilterTargetsLabel(filter, props.tables) }) }}
      </p>
    </fieldset>
    <button v-if="props.editing" type="button" class="yayaw-button yayaw-button-outline" @click="emit('add')">
      {{ props.label("addFilter") }}
    </button>
  </section>
</template>
