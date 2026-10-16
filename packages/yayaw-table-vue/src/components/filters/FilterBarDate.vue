<script setup lang="ts">
import { computed } from "vue";
import { CalendarDays, ChevronDown } from "lucide-vue-next";
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui";
import { useTableContext, useTableTranslation } from "../../context";
import { isRelativeDateToken, RELATIVE_DATE_CHOICES, relativeDateFieldLabel, relativeDateLabel, todayCalendarDay } from "../../date-filter-days";
import { type FilterBarDateValue, filterBarDateValue, replaceFilterBarDateRule } from "../../filter-bar";
import type { AdvancedFilter, ColumnDefinition } from "../../types";

/** The filter bar's period of a date column, kept as one advanced rule: it filters every display mode. */
const props = defineProps<{ column: ColumnDefinition }>();
const context = useTableContext();
const translate = useTableTranslation();
const ANY = "";
const FIXED = "fixed";
const value = computed(() => filterBarDateValue(context.state.advancedFilters.value.filters, props.column.id));
const custom = computed(() => !value.value.token && Boolean(value.value.from || value.value.to));
const relativeTranslate = (key: string): string | undefined => {
  const text = context.translations.value[key];
  return typeof text === "string" ? text : undefined;
};
const tokenText = (token: (typeof RELATIVE_DATE_CHOICES)[number]) => relativeDateLabel(token, context.locale, relativeTranslate);
const summary = computed(() => {
  const { token, from, to } = value.value;
  if (token) return tokenText(token);
  if (from && to) return `${from} – ${to}`;
  return from ? `≥ ${from}` : to ? `≤ ${to}` : "";
});
const update = (next: FilterBarDateValue): void => {
  context.state.advancedFilters.value = {
    ...context.state.advancedFilters.value,
    filters: replaceFilterBarDateRule(context.state.advancedFilters.value.filters, props.column.id, next) as AdvancedFilter[],
  };
};
const choose = (event: Event): void => {
  const choice = (event.target as HTMLSelectElement).value;
  if (isRelativeDateToken(choice)) update({ token: choice });
  else if (choice === FIXED) update({ from: value.value.from ?? todayCalendarDay() });
  else update({});
};
const changeDay = (key: "from" | "to", event: Event): void => {
  update({ from: value.value.from, to: value.value.to, [key]: (event.target as HTMLInputElement).value || undefined });
};
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <button type="button" class="yayaw-button yayaw-button-outline yayaw-filter-trigger" :aria-label="column.header" :data-date-filter="column.id">
        <CalendarDays :size="16" aria-hidden="true" />
        <span>{{ column.header }}</span>
        <span v-if="summary" class="yayaw-filter-count">{{ summary }}</span>
        <ChevronDown :size="12" aria-hidden="true" />
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent class="yayaw-filter-picker" :data-yayaw-filter-picker="context.config.id" :aria-label="column.header" align="start" :side-offset="4" :collision-padding="8">
        <p class="yayaw-filter-heading">{{ column.header }}</p>
        <label class="yayaw-field-inline">
          <span>{{ relativeDateFieldLabel('label', context.locale, relativeTranslate) }}</span>
          <select class="yayaw-select" data-date-filter-period="" :value="value.token ?? (custom ? FIXED : ANY)" @change="choose">
            <option :value="ANY">{{ translate('filters.anyDate', context.locale.toLowerCase().startsWith('fr') ? 'Toutes les dates' : 'Any date') }}</option>
            <option v-for="token in RELATIVE_DATE_CHOICES" :key="token" :value="token">{{ tokenText(token) }}</option>
            <option :value="FIXED">{{ relativeDateFieldLabel('fixed', context.locale, relativeTranslate) }}</option>
          </select>
        </label>
        <template v-if="custom">
          <label class="yayaw-field-inline">
            <span>{{ translate('filters.value', 'Filter value') }}</span>
            <input class="yayaw-input" type="date" data-date-filter-from="" :value="value.from ?? ''" @change="changeDay('from', $event)" />
          </label>
          <label class="yayaw-field-inline">
            <span>{{ translate('filters.value_to', 'Filter value to') }}</span>
            <input class="yayaw-input" type="date" data-date-filter-to="" :value="value.to ?? ''" @change="changeDay('to', $event)" />
          </label>
        </template>
        <button type="button" class="yayaw-button yayaw-button-outline" :disabled="!summary" @click="update({})">{{ translate('clearFilters', 'Clear filters') }}</button>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
