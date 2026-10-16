<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useTableContext } from "../../context";
import {
  calendarDay,
  type RelativeDateToken,
  RELATIVE_DATE_UNITS,
  relativeDateLabel,
  relativeDateTokenOf,
  todayCalendarDay,
} from "../../date-filter-days";
import {
  DATE_PRESET_ROWS,
  type DateRuleMode,
  dateRuleMode,
  filterDayText,
  filterMenuText,
  type FilterMenuTextKey,
  filterPeriodSentence,
  type RollingDate,
  rollingDateOf,
  rollingDateToken,
} from "../../filter-menu";
import { tableFilterContext } from "../../table-contracts";

/**
 * A date rule's days, as Notion picks them: relative choices first (today,
 * this week, the last 30 days…), a rolling period of any length, an exact
 * day, or two days. Each choice changes the rule at once.
 */
const props = defineProps<{ operator: string; values: unknown }>();
const emit = defineEmits<{ change: [rule: { operator: string; values: unknown }] }>();
const context = useTableContext();
const translate = (key: string): string | undefined => {
  const value = context.translations.value[key];
  return typeof value === "string" ? value : undefined;
};
const text = (key: FilterMenuTextKey): string => filterMenuText(key, context.locale, translate);
const token = computed(() => relativeDateTokenOf(props.values));
const ruleMode = computed(() => dateRuleMode({ id: "", columnId: "", operator: props.operator, values: props.values }));
const mode = ref<DateRuleMode>(ruleMode.value);
watch(ruleMode, (value) => {
  if (value !== "relative" || token.value) mode.value = value;
});
/** Two days only make sense for "is": the other operators compare with one. */
const canRange = computed(() => ["equals", "between"].includes(props.operator));
const label = (value: RelativeDateToken): string => relativeDateLabel(value, context.locale, translate);
const rolling = ref<RollingDate>(rollingDateOf(token.value) ?? { direction: "last", count: 30, unit: "Days" });
watch(token, (value) => {
  const parts = rollingDateOf(value);
  if (parts) rolling.value = parts;
});
const pickOperator = (): string => (props.operator === "between" ? "equals" : props.operator);
const pick = (value: RelativeDateToken): void => emit("change", { operator: pickOperator(), values: value });
const applyRolling = (): void => {
  const value = rollingDateToken({ ...rolling.value, count: Math.max(1, Number(rolling.value.count) || 1) });
  if (value) pick(value);
};
const day = (index: number): string => {
  const values = Array.isArray(props.values) ? props.values : [props.values];
  return token.value ? "" : (calendarDay(values[index]) ?? "");
};
const setMode = (next: DateRuleMode): void => {
  mode.value = next;
  if (next === "relative") return;
  const today = todayCalendarDay(context.config.table.timeZone);
  if (next === "range") emit("change", { operator: "between", values: [day(0) || today, day(1) || day(0) || today] });
  else emit("change", { operator: pickOperator(), values: day(0) || today });
};
const changeDay = (index: number, event: Event): void => {
  const value = (event.target as HTMLInputElement).value;
  if (mode.value === "range") {
    const next = [day(0), day(1)];
    next[index] = value;
    emit("change", { operator: "between", values: next });
  } else emit("change", { operator: pickOperator(), values: value || undefined });
};
const sentence = computed(() =>
  filterPeriodSentence(
    token.value ?? (Array.isArray(props.values) ? undefined : props.values),
    context.locale,
    translate,
    tableFilterContext(context.config.table, context.locale)
  )
);
const rangeSentence = computed(() => {
  if (mode.value !== "range" || !(day(0) && day(1))) return "";
  return text("period").replace("{start}", filterDayText(day(0), context.locale)).replace("{end}", filterDayText(day(1), context.locale));
});
</script>

<template>
  <div class="yayaw-date-editor" data-date-value-editor="">
    <div class="yayaw-segmented" role="group" :aria-label="text('value')">
      <button type="button" :aria-pressed="mode === 'relative'" @click="setMode('relative')">{{ text('relative') }}</button>
      <button type="button" :aria-pressed="mode === 'exact'" @click="setMode('exact')">{{ text('exact') }}</button>
      <button v-if="canRange" type="button" :aria-pressed="mode === 'range'" @click="setMode('range')">{{ text('range') }}</button>
    </div>
    <template v-if="mode === 'relative'">
      <div class="yayaw-date-presets" role="group" :aria-label="text('relative')">
        <template v-for="row in DATE_PRESET_ROWS" :key="row[0]">
          <button v-for="choice in row" :key="choice" type="button" class="yayaw-menu-choice" :aria-pressed="token === choice" :data-relative-date="choice" @click="pick(choice)">{{ label(choice) }}</button>
        </template>
      </div>
      <form class="yayaw-date-rolling" :aria-label="text('custom')" @submit.prevent="applyRolling">
        <select v-model="rolling.direction" class="yayaw-select" :aria-label="text('custom')" data-rolling-direction="" @change="applyRolling">
          <option value="last">{{ text('last') }}</option>
          <option value="next">{{ text('next') }}</option>
        </select>
        <input v-model.number="rolling.count" class="yayaw-input" type="number" min="1" max="3660" inputmode="numeric" :aria-label="text('value')" data-rolling-count="" @change="applyRolling" />
        <select v-model="rolling.unit" class="yayaw-select" :aria-label="text('value')" data-rolling-unit="" @change="applyRolling">
          <option v-for="unit in RELATIVE_DATE_UNITS" :key="unit" :value="unit">{{ text(unit) }}</option>
        </select>
      </form>
    </template>
    <label v-else-if="mode === 'exact'" class="yayaw-field-inline">
      <span>{{ text('value') }}</span>
      <input class="yayaw-input" type="date" :value="day(0)" data-date-exact="" @change="changeDay(0, $event)" />
    </label>
    <div v-else class="yayaw-date-range">
      <label class="yayaw-field-inline"><span>{{ text('from') }}</span><input class="yayaw-input" type="date" :value="day(0)" data-date-from="" @change="changeDay(0, $event)" /></label>
      <label class="yayaw-field-inline"><span>{{ text('to') }}</span><input class="yayaw-input" type="date" :value="day(1)" data-date-to="" @change="changeDay(1, $event)" /></label>
    </div>
    <p class="yayaw-date-sentence" role="status">{{ rangeSentence || sentence }}</p>
  </div>
</template>
