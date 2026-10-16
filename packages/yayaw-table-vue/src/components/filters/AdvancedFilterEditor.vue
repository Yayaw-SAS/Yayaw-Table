<script setup lang="ts">
import { ChevronDown, Plus, Trash2, X } from "lucide-vue-next";
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui";
import { useTableContext } from "../../context";
import {
  changeFilterOperator,
  defaultFilterOperator,
  filterMenuOperators,
  filterMenuText,
  type FilterMenuTextKey,
  filterOperatorLabel,
  filterOperatorNeedsValue,
  filterRuleSummary,
} from "../../filter-menu";
import type { AdvancedFilter, AdvancedFilterOperator } from "../../types";
import FilterValueEditor from "./FilterValueEditor.vue";

/**
 * The advanced filter, as in Notion: one row per rule ("Where", then "And" or
 * "Or"), each with its property, operator and value; rules can be added and
 * the whole filter deleted. Changes filter at once.
 */
const context = useTableContext();
const menu = context.filterMenu;
const translate = (key: string): string | undefined => {
  const value = context.translations.value[key];
  return typeof value === "string" ? value : undefined;
};
const text = (key: FilterMenuTextKey): string => filterMenuText(key, context.locale, translate);
const columnOf = (rule: AdvancedFilter) => context.config.columns.definitions.find((item) => item.id === rule.columnId);
const typeOf = (rule: AdvancedFilter) => menu.typeOf(columnOf(rule));
const inline = (rule: AdvancedFilter): boolean => ["text", "number"].includes(typeOf(rule)) && rule.operator !== "between";
const summary = (rule: AdvancedFilter): string => {
  const column = columnOf(rule);
  if (!column) return "";
  return filterRuleSummary(rule, menu.menuColumn(column, { yes: text("checked"), no: text("unchecked") }), context.locale, translate).value;
};
const changeColumn = (rule: AdvancedFilter, event: Event): void => {
  const column = menu.columns.value.find((item) => item.id === (event.target as HTMLSelectElement).value);
  if (!column) return;
  const type = menu.typeOf(column);
  menu.update({
    ...rule,
    columnId: column.id,
    type,
    operator: (menu.isFolderColumn(column) ? "isAnyOf" : defaultFilterOperator(type)) as AdvancedFilterOperator,
    values: undefined,
  });
};
const changeOperator = (rule: AdvancedFilter, event: Event): void => {
  const operator = (event.target as HTMLSelectElement).value;
  menu.update({ ...changeFilterOperator(rule, operator, typeOf(rule)), type: typeOf(rule) });
};
const changeInline = (rule: AdvancedFilter, event: Event): void => {
  const raw = (event.target as HTMLInputElement).value;
  const values = typeOf(rule) === "number" ? (raw.trim() === "" ? undefined : Number(raw)) : raw;
  menu.update({ ...rule, type: typeOf(rule), values });
};
const inlineValue = (rule: AdvancedFilter): string =>
  typeof rule.values === "string" || typeof rule.values === "number" ? String(rule.values) : "";
const join = (event: Event): void => menu.setJoin((event.target as HTMLSelectElement).value as "and" | "or");
</script>

<template>
  <div class="yayaw-advanced-editor" data-advanced-filter="">
    <div v-for="(rule, index) in menu.rules.value" :key="rule.id" class="yayaw-advanced-row" :data-advanced-rule="rule.columnId">
      <span v-if="index === 0" class="yayaw-advanced-join">{{ text('where') }}</span>
      <select v-else-if="index === 1" class="yayaw-select yayaw-advanced-join" :value="context.state.advancedFilters.value.joinOperator" :aria-label="`${text('and')} / ${text('or')}`" data-advanced-join="" @change="join">
        <option value="and">{{ text('and') }}</option>
        <option value="or">{{ text('or') }}</option>
      </select>
      <span v-else class="yayaw-advanced-join">{{ context.state.advancedFilters.value.joinOperator === 'or' ? text('or') : text('and') }}</span>
      <select class="yayaw-select" :value="rule.columnId" :aria-label="text('property')" @change="changeColumn(rule, $event)">
        <option v-if="!columnOf(rule)" :value="rule.columnId" disabled>{{ rule.columnId }}</option>
        <option v-for="column in menu.columns.value" :key="column.id" :value="column.id">{{ column.header }}</option>
      </select>
      <select v-if="!menu.isFolderColumn(columnOf(rule))" class="yayaw-select" :value="rule.operator" :aria-label="text('operator')" @change="changeOperator(rule, $event)">
        <option v-for="operator in filterMenuOperators(typeOf(rule), rule.operator)" :key="operator" :value="operator">{{ filterOperatorLabel(typeOf(rule), operator, context.locale, translate) }}</option>
      </select>
      <span v-else />
      <template v-if="filterOperatorNeedsValue(rule.operator)">
        <input v-if="inline(rule)" class="yayaw-input" :type="typeOf(rule) === 'number' ? 'number' : 'text'" step="any" :value="inlineValue(rule)" :placeholder="text('typeValue')" :aria-label="text('value')" @change="changeInline(rule, $event)" />
        <PopoverRoot v-else>
          <PopoverTrigger as-child>
            <button type="button" class="yayaw-select yayaw-advanced-value" :aria-label="text('value')"><span>{{ summary(rule) || text('value') }}</span><ChevronDown :size="12" aria-hidden="true" /></button>
          </PopoverTrigger>
          <PopoverPortal>
            <PopoverContent class="yayaw-filter-popover yayaw-filter-menu-layer" align="start" :side-offset="4" :collision-padding="8">
              <FilterValueEditor :rule="rule" :column="columnOf(rule)" autofocus @update="menu.update" />
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>
      </template>
      <span v-else />
      <button type="button" class="yayaw-icon-button" :aria-label="text('deleteFilter')" @click="menu.remove(rule.id)"><X :size="16" aria-hidden="true" /></button>
    </div>
    <div class="yayaw-advanced-foot">
      <button type="button" class="yayaw-button yayaw-button-ghost" data-advanced-add="" @click="menu.add(undefined, false)"><Plus :size="16" aria-hidden="true" />{{ text('addRule') }}</button>
      <button v-if="menu.rules.value.length" type="button" class="yayaw-button yayaw-button-ghost" data-advanced-delete="" @click="menu.clear()"><Trash2 :size="16" aria-hidden="true" />{{ text('deleteAdvanced') }}</button>
    </div>
  </div>
</template>
