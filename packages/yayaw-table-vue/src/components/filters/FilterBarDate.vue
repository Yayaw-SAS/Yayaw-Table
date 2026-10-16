<script setup lang="ts">
import { CalendarDays, ChevronDown, X } from "lucide-vue-next";
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui";
import { computed } from "vue";
import { useTableContext } from "../../context";
import { relativeDateLabel, relativeDateTokenOf } from "../../date-filter-days";
import { filterBarDateRuleId } from "../../filter-bar";
import {
  filterMenuText,
  type FilterMenuTextKey,
  filterOperatorLabel,
  filterPeriodDates,
  filterRuleComplete,
  filterRuleSummary,
} from "../../filter-menu";
import { tableFilterContext } from "../../table-contracts";
import type { AdvancedFilter, AdvancedFilterOperator, ColumnDefinition } from "../../types";
import DateValueEditor from "./DateValueEditor.vue";

/**
 * A date column's period, always at hand: in the filter bar, or in the
 * toolbar (`table.toolbarDateFilter`) where it shows the period and its days
 * ("This month · 1 – 31 Oct"). It is one advanced rule, so every display mode
 * filters by it, and its chip is this button.
 */
const props = withDefaults(defineProps<{ column: ColumnDefinition; variant?: "bar" | "toolbar"; compact?: boolean }>(), { variant: "bar" });
const context = useTableContext();
const menu = context.filterMenu;
const translate = (key: string): string | undefined => {
  const value = context.translations.value[key];
  return typeof value === "string" ? value : undefined;
};
const text = (key: FilterMenuTextKey): string => filterMenuText(key, context.locale, translate);
const id = computed(() => filterBarDateRuleId(props.column.id));
const rule = computed<AdvancedFilter>(
  () =>
    menu.rules.value.find((item) => item.id === id.value) ?? {
      id: id.value,
      columnId: props.column.id,
      type: "date",
      operator: "equals",
      values: undefined,
      isActive: true,
    }
);
const active = computed(() => filterRuleComplete(rule.value));
const token = computed(() => relativeDateTokenOf(rule.value.values));
/** "This month", "Is before 1 Oct 2026"… */
const label = computed(() => {
  if (!active.value) return text("anyDate");
  if (token.value && rule.value.operator === "equals") return relativeDateLabel(token.value, context.locale, translate);
  return filterRuleSummary(rule.value, { id: props.column.id, header: props.column.header, type: "date" }, context.locale, translate).value;
});
/** The days a relative period stands for today: "1 – 31 Oct". */
const days = computed(() =>
  active.value && token.value ? filterPeriodDates(token.value, context.locale, tableFilterContext(context.config.table, context.locale)) : ""
);
const change = (next: { operator: string; values: unknown }): void =>
  menu.update({ ...rule.value, type: "date", operator: next.operator as AdvancedFilterOperator, values: next.values, isActive: true });
const operators = ["equals", "before", "after", "lessThanOrEqual", "greaterThanOrEqual"];
const clear = (): void => menu.remove(id.value);
/**
 * Picking this column from the Filter button opens this period: the
 * toolbar's when the column is there, otherwise the filter bar's.
 */
const owner = computed(() => props.variant === "toolbar" || context.config.table.toolbarDateFilter !== props.column.id);
const open = computed({
  get: () => owner.value && menu.periodOpen.value === props.column.id,
  set: (value: boolean) => {
    menu.periodOpen.value = value ? props.column.id : undefined;
  },
});
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        class="yayaw-button yayaw-button-outline yayaw-filter-trigger yayaw-date-period"
        :data-active="active"
        :data-variant="variant"
        :data-date-filter="column.id"
        :aria-label="`${column.header}: ${label}${days ? ` (${days})` : ''}`"
      >
        <CalendarDays :size="16" aria-hidden="true" />
        <span v-if="variant === 'bar'">{{ column.header }}</span>
        <span v-if="variant === 'bar' ? active : !compact || active" class="yayaw-date-period-label">{{ label }}</span>
        <span v-if="days && !compact" class="yayaw-date-period-days">{{ days }}</span>
        <ChevronDown v-if="variant === 'bar'" :size="12" aria-hidden="true" />
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent class="yayaw-filter-popover" :data-yayaw-filter-picker="context.config.id" :aria-label="column.header" :align="variant === 'toolbar' ? 'end' : 'start'" :side-offset="6" :collision-padding="8">
        <div class="yayaw-rule-editor" data-date-period-editor="">
          <div class="yayaw-rule-editor-head">
            <span class="yayaw-rule-editor-name">{{ column.header }}</span>
            <select class="yayaw-rule-operator yayaw-rule-operator-select" :value="rule.operator === 'between' ? 'equals' : rule.operator" :aria-label="text('operator')" @change="change({ operator: ($event.target as HTMLSelectElement).value, values: rule.values })">
              <option v-for="operator in operators" :key="operator" :value="operator">{{ filterOperatorLabel('date', operator, context.locale, translate) }}</option>
            </select>
            <button v-if="active" type="button" class="yayaw-icon-button" :aria-label="text('anyDate')" data-date-period-clear="" @click="clear"><X :size="16" aria-hidden="true" /></button>
          </div>
          <DateValueEditor :operator="rule.operator" :values="rule.values" @change="change" />
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
