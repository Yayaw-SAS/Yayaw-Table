<script setup lang="ts">
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import { computed, ref, useId, watch } from "vue";
import { useTableContext } from "../../context";
import {
  type CalendarDay,
  calendarDay,
  RELATIVE_DATE_UNITS,
  type RelativeDateUnit,
  relativeDateTokenOf,
  todayCalendarDay,
} from "../../date-filter-days";
import {
  addCalendarMonths,
  calendarMonthTitle,
  calendarMonthWeeks,
  calendarWeekdays,
  calendarWeekStart,
  type DateRuleMode,
  dateRuleDays,
  dateRuleMode,
  filterDayText,
  filterMenuText,
  type FilterMenuTextKey,
  filterPeriodSentence,
  pickRangeDay,
  RELATIVE_DATE_DIRECTIONS,
  type RelativeDateDirection,
  type RelativeDateParts,
  relativeDateParts,
  relativeDatePartsToken,
} from "../../filter-menu";
import { tableFilterContext } from "../../table-contracts";

/**
 * A date rule's days, as Notion picks them: relative to today with two lists
 * ("This" + "week", "Past" + 30 + "days"…), an exact day or two days, over a
 * calendar that highlights them. Each choice changes the rule at once.
 */
const props = defineProps<{ operator: string; values: unknown }>();
const emit = defineEmits<{ change: [rule: { operator: string; values: unknown }] }>();
const context = useTableContext();
const translate = (key: string): string | undefined => {
  const value = context.translations.value[key];
  return typeof value === "string" ? value : undefined;
};
const text = (key: FilterMenuTextKey): string => filterMenuText(key, context.locale, translate);
const DIRECTION_TEXT: Record<RelativeDateDirection, FilterMenuTextKey> = { this: "this", last: "lastOne", next: "nextOne", past: "past", coming: "coming" };
const UNIT_TEXT: Record<RelativeDateUnit, FilterMenuTextKey> = { Days: "day", Weeks: "week", Months: "month", Years: "year" };
const rolls = (direction: RelativeDateDirection): boolean => direction === "past" || direction === "coming";
const name = useId();
const token = computed(() => relativeDateTokenOf(props.values));
const ruleMode = computed(() => dateRuleMode({ id: "", columnId: "", operator: props.operator, values: props.values }));
const mode = ref<DateRuleMode>(ruleMode.value);
watch(ruleMode, (value) => {
  if (value !== "relative" || token.value) mode.value = value;
});
/** Two days only make sense for "is": the other operators compare with one. */
const canRange = computed(() => ["equals", "between"].includes(props.operator));
const modes = computed<DateRuleMode[]>(() => (canRange.value ? ["relative", "exact", "range"] : ["relative", "exact"]));
const parts = ref<RelativeDateParts>(relativeDateParts(token.value) ?? { direction: "this", count: 1, unit: "Weeks" });
watch(token, (value) => {
  const next = relativeDateParts(value);
  if (next) parts.value = next;
});
const filterContext = computed(() => tableFilterContext(context.config.table, context.locale));
const today = computed(() => todayCalendarDay(context.config.table.timeZone));
// The second click of a range ends it.
const rangePending = ref(false);
const pickOperator = (): string => (props.operator === "between" ? "equals" : props.operator);
const applyParts = (next: RelativeDateParts): void => {
  parts.value = next;
  const value = relativeDatePartsToken(next);
  if (value) emit("change", { operator: pickOperator(), values: value });
};
const changeParts = (key: "direction" | "unit", event: Event): void => {
  applyParts({ ...parts.value, [key]: (event.target as HTMLSelectElement).value });
};
const day = (index: number): string => {
  const values = Array.isArray(props.values) ? props.values : [props.values];
  return token.value ? "" : (calendarDay(values[index]) ?? "");
};
const setMode = (next: DateRuleMode): void => {
  mode.value = next;
  rangePending.value = false;
  // The lists name no period until one is chosen.
  if (next === "relative") return;
  if (next === "range") emit("change", { operator: "between", values: [day(0) || today.value, day(1) || day(0) || today.value] });
  else emit("change", { operator: pickOperator(), values: day(0) || today.value });
};
const changeDay = (index: number, event: Event): void => {
  const value = (event.target as HTMLInputElement).value;
  if (mode.value === "range") {
    const next = [day(0), day(1)];
    next[index] = value;
    emit("change", { operator: "between", values: next });
  } else emit("change", { operator: pickOperator(), values: value || undefined });
};
const pickDay = (picked: CalendarDay): void => {
  if (mode.value === "range") {
    emit("change", { operator: "between", values: pickRangeDay([day(0), day(1)], picked, rangePending.value) });
    rangePending.value = !rangePending.value;
    return;
  }
  // A day picked on a relative rule makes it exact, as in Notion.
  mode.value = "exact";
  emit("change", { operator: pickOperator(), values: picked });
};
const days = computed(() => dateRuleDays(props.values, filterContext.value));
const weekStartsOn = computed(() => calendarWeekStart(filterContext.value));
const month = ref((days.value?.start ?? today.value).slice(0, 7));
watch(() => (days.value?.start ?? today.value).slice(0, 7), (value) => {
  month.value = value;
});
const weeks = computed(() => calendarMonthWeeks(month.value, weekStartsOn.value));
const weekdays = computed(() => calendarWeekdays(context.locale, weekStartsOn.value));
const monthTitle = computed(() => calendarMonthTitle(month.value, context.locale));
const inRange = (value: CalendarDay): boolean => Boolean(days.value && value >= days.value.start && value <= days.value.end);
const isEdge = (value: CalendarDay): boolean => Boolean(days.value && (value === days.value.start || value === days.value.end));
const sentence = computed(() =>
  filterPeriodSentence(
    token.value ?? (Array.isArray(props.values) ? undefined : props.values),
    context.locale,
    translate,
    filterContext.value
  )
);
const rangeSentence = computed(() => {
  if (mode.value !== "range" || !(day(0) && day(1))) return "";
  return text("period").replace("{start}", filterDayText(day(0), context.locale)).replace("{end}", filterDayText(day(1), context.locale));
});
</script>

<template>
  <div class="yayaw-date-editor" data-date-value-editor="">
    <fieldset class="yayaw-date-modes" data-date-mode="">
      <legend class="yayaw-sr-only">{{ text('value') }}</legend>
      <div class="yayaw-date-mode-track">
        <label v-for="item in modes" :key="item">
          <input type="radio" class="yayaw-sr-only" :name="`${name}-mode`" :value="item" :checked="mode === item" :data-date-mode-option="item" @change="setMode(item)" />
          {{ text(item) }}
        </label>
      </div>
    </fieldset>
    <div v-if="mode === 'relative'" class="yayaw-date-relative" :data-rolling="Boolean(token && rolls(parts.direction))" data-relative-date-parts="">
      <select class="yayaw-select" :aria-label="text('relative')" :value="token ? parts.direction : ''" data-relative-direction="" @change="changeParts('direction', $event)">
        <option v-if="!token" value="" disabled>{{ text('choose') }}</option>
        <option v-for="direction in RELATIVE_DATE_DIRECTIONS" :key="direction" :value="direction">{{ text(DIRECTION_TEXT[direction]) }}</option>
      </select>
      <input v-if="token && rolls(parts.direction)" class="yayaw-input" type="number" min="1" max="3660" inputmode="numeric" :aria-label="text('value')" :value="parts.count || ''" data-rolling-count=""
        @input="parts = { ...parts, count: Number(($event.target as HTMLInputElement).value) }" @change="applyParts(parts)" @keydown.enter.prevent="applyParts(parts)" />
      <select class="yayaw-select" :aria-label="text('unit')" :value="parts.unit" data-relative-unit="" @change="changeParts('unit', $event)">
        <option v-for="unit in RELATIVE_DATE_UNITS" :key="unit" :value="unit">{{ text(rolls(parts.direction) ? unit : UNIT_TEXT[unit]) }}</option>
      </select>
    </div>
    <input v-else-if="mode === 'exact'" class="yayaw-input" type="date" :aria-label="text('exact')" :value="day(0)" data-date-exact="" @change="changeDay(0, $event)" />
    <div v-else class="yayaw-date-range">
      <input class="yayaw-input" type="date" :aria-label="text('from')" :value="day(0)" data-date-from="" @change="changeDay(0, $event)" />
      <input class="yayaw-input" type="date" :aria-label="text('to')" :value="day(1)" data-date-to="" @change="changeDay(1, $event)" />
    </div>
    <div class="yayaw-date-calendar" data-date-calendar="">
      <div class="yayaw-date-calendar-head">
        <span data-calendar-month="">{{ monthTitle }}</span>
        <span>
          <button type="button" class="yayaw-icon-button" :aria-label="text('previousMonth')" data-calendar-previous="" @click="month = addCalendarMonths(month, -1)"><ChevronLeft :size="16" aria-hidden="true" /></button>
          <button type="button" class="yayaw-icon-button" :aria-label="text('nextMonth')" data-calendar-next="" @click="month = addCalendarMonths(month, 1)"><ChevronRight :size="16" aria-hidden="true" /></button>
        </span>
      </div>
      <table :aria-label="monthTitle" data-date-calendar="">
        <thead>
          <tr><th v-for="weekday in weekdays" :key="weekday" scope="col">{{ weekday }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="week in weeks" :key="week[0]">
            <td v-for="value in week" :key="value" :data-in-range="inRange(value)" :data-start="value === days?.start" :data-end="value === days?.end">
              <button type="button" :aria-label="filterDayText(value, context.locale)" :aria-pressed="inRange(value)" :data-calendar-day="value"
                :data-today="value === today || undefined" :data-edge="isEdge(value)" :data-outside="value.slice(0, 7) !== month" @click="pickDay(value)">{{ Number(value.slice(8)) }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="yayaw-date-sentence" role="status">{{ rangeSentence || (mode === 'relative' && token ? `${sentence} · ${text('relativeHint')}` : sentence) }}</p>
  </div>
</template>
