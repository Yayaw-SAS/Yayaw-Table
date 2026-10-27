<script setup lang="ts">
import { ChevronDown, Plus } from "lucide-vue-next";
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui";
import { computed, ref } from "vue";
import { useTableContext } from "../../context";
import { filterBarDateRuleId } from "../../filter-bar";
import {
  filterChipsLayout,
  filterMenuText,
  type FilterMenuTextKey,
  filterRulesCountText,
} from "../../filter-menu";
import AdvancedFilterEditor from "./AdvancedFilterEditor.vue";
import FilterChip from "./FilterChip.vue";
import FilterPropertyPicker from "./FilterPropertyPicker.vue";

/**
 * The rules under the toolbar, as Notion shows them: one chip per rule, or
 * one chip for the advanced filter, then "+ Filter" and "Clear". Date periods
 * pinned to the filter bar or the toolbar show there instead. The add button
 * stays visible without rules so the first filter needs no settings menu.
 */
const context = useTableContext();
const menu = context.filterMenu;
const translate = (key: string): string | undefined => {
  const value = context.translations.value[key];
  return typeof value === "string" ? value : undefined;
};
const text = (key: FilterMenuTextKey): string => filterMenuText(key, context.locale, translate);
const pinned = menu.pinnedDates;
const layout = computed(() =>
  filterChipsLayout(menu.rules.value, context.state.advancedFilters.value.joinOperator, {
    advanced: menu.advanced.value,
    pinnedColumns: pinned.value,
  })
);
const adding = ref(false);
const pick = (columnId: string): void => {
  adding.value = false;
  menu.add(columnId);
};
const advanced = (): void => {
  adding.value = false;
  menu.openAdvanced();
};
</script>

<template>
  <div v-if="menu.columns.value.length || layout.chips.length || layout.advanced.length" class="yayaw-filter-chips" role="group" :aria-label="text('filter')" data-filter-chips="">
    <FilterChip v-for="rule in layout.chips" :key="rule.id" :rule="rule" />
    <PopoverRoot v-if="layout.advanced.length" v-model:open="menu.advancedOpen.value">
      <PopoverTrigger as-child>
        <button type="button" class="yayaw-filter-chip" data-complete="true" data-filter-chip-advanced="">
          <span class="yayaw-filter-chip-property">{{ filterRulesCountText(layout.advanced.length, context.locale, translate) }}</span>
          <ChevronDown :size="12" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent class="yayaw-filter-popover yayaw-filter-popover-wide" :data-yayaw-filter-picker="context.config.id" align="start" :side-offset="6" :collision-padding="8" :aria-label="filterRulesCountText(layout.advanced.length, context.locale, translate)">
          <AdvancedFilterEditor />
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
    <PopoverRoot v-model:open="adding">
      <PopoverTrigger as-child>
        <button type="button" class="yayaw-filter-chip yayaw-filter-chip-add" data-filter-chip-add=""><Plus :size="14" aria-hidden="true" />{{ text('addFilter') }}</button>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent class="yayaw-filter-popover" :data-yayaw-filter-picker="context.config.id" align="start" :side-offset="6" :collision-padding="8" :aria-label="text('filterBy')" @close-auto-focus.prevent>
          <FilterPropertyPicker :advanced="!layout.advanced.length" @pick="pick" @advanced="advanced" />
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
    <button v-if="layout.chips.length || layout.advanced.length" type="button" class="yayaw-filter-chips-clear" data-filter-chips-clear="" @click="menu.clear(pinned.map(filterBarDateRuleId))">{{ text('clear') }}</button>
  </div>
</template>
